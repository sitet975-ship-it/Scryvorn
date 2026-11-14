import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { INPUT_MAX_CHARS } from "@/lib/constants";
import { click, contrastRatio, paste, render, submit, typeValue, type Rendered } from "@/test/dom";
import { LOADING_TEXT, LoadingState } from "./LoadingState";
import { SAMPLE_TRAP_LABELS, SampleTrapButtons, type SampleTrap } from "./SampleTrapButtons";
import {
  INPUT_REQUIRED_MESSAGE,
  INPUT_TOO_LONG_MESSAGE,
  SUBMIT_LABEL,
  ScannerInput,
} from "./ScannerInput";

// Clearly synthetic fixtures (.example / .test domains only).
const SAMPLES: SampleTrap[] = [
  { id: "job", label: "Fake Remote Job DM", content: "Synthetic job offer. Apply at https://jobs.example/apply" },
  { id: "pay", label: "Phishing Payment Link", content: "Synthetic invoice. Pay at https://pay.example.test/invoice" },
  { id: "bank", label: "Legitimate Bank Alert", content: "Synthetic bank notice from Example Bank (bank.example)." },
];

let mounted: Rendered[] = [];
function mount(ui: Parameters<typeof render>[0]) {
  const r = render(ui);
  mounted.push(r);
  return r;
}
afterEach(() => {
  mounted.forEach((r) => r.unmount());
  mounted = [];
});

/** Owns the textarea value like the real page will. */
function Harness({
  initial = "",
  loading = false,
  onSubmit = () => {},
}: {
  initial?: string;
  loading?: boolean;
  onSubmit?: (v: string) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <div>
      <SampleTrapButtons samples={SAMPLES} onSelect={setValue} disabled={loading} />
      <ScannerInput value={value} onChange={setValue} onSubmit={onSubmit} loading={loading} />
    </div>
  );
}

function parts(container: HTMLElement) {
  return {
    textarea: container.querySelector("textarea")!,
    counter: container.querySelector("[data-counter]")!,
    error: container.querySelector('p[aria-live="polite"]')!,
    form: container.querySelector("form")!,
    submitButton: container.querySelector('button[type="submit"]') as HTMLButtonElement,
  };
}

describe("ScannerInput", () => {
  it("renders a labeled textarea, the counter, and the submit button", () => {
    const { container } = mount(<Harness />);
    const { textarea, counter, submitButton } = parts(container);
    const label = container.querySelector("label")!;
    expect(label.getAttribute("for")).toBe(textarea.id);
    expect(textarea.hasAttribute("maxlength")).toBe(false); // no silent truncation
    expect(counter.textContent).toBe("0 / 10,000");
    expect(submitButton.textContent).toBe(SUBMIT_LABEL);
    expect(SUBMIT_LABEL).toBe("Inspect for Traps");
    expect(submitButton.className).toContain("bg-pumpkin-orange");
    expect(submitButton.className).toContain("text-dark-ink");
    expect(submitButton.className).toContain("font-bold");
  });

  it("updates the counter using string length (UTF-16 code units)", () => {
    const { container } = mount(<Harness />);
    const { textarea, counter } = parts(container);
    typeValue(textarea, "hello");
    expect(counter.textContent).toBe("5 / 10,000");
    typeValue(textarea, "a".repeat(1234));
    expect(counter.textContent).toBe("1,234 / 10,000");
    typeValue(textarea, "😀"); // one emoji is two UTF-16 code units
    expect(counter.textContent).toBe("2 / 10,000");
  });

  it("blocks an empty submit, keeps the content, and shows Input required.", () => {
    const onSubmit = vi.fn();
    const { container } = mount(<Harness onSubmit={onSubmit} />);
    const { textarea, error, form } = parts(container);
    typeValue(textarea, "   \n  ");
    submit(form);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(error.textContent).toBe(INPUT_REQUIRED_MESSAGE);
    expect(INPUT_REQUIRED_MESSAGE).toBe("Input required.");
    expect(textarea.value).toBe("   \n  ");
    expect(textarea.getAttribute("aria-invalid")).toBe("true");
  });

  it("submits non-empty input and clears any previous error", () => {
    const onSubmit = vi.fn();
    const { container } = mount(<Harness onSubmit={onSubmit} />);
    const { textarea, error, form } = parts(container);
    submit(form);
    expect(error.textContent).toBe(INPUT_REQUIRED_MESSAGE);
    typeValue(textarea, "Check this message");
    submit(form);
    expect(onSubmit).toHaveBeenCalledWith("Check this message");
    expect(error.textContent).toBe("");
    expect(textarea.hasAttribute("aria-invalid")).toBe(false);
  });

  it("rejects input that would exceed the limit without truncating, and blocks submission", () => {
    const onSubmit = vi.fn();
    const { container } = mount(<Harness onSubmit={onSubmit} />);
    const { textarea, counter, error, form } = parts(container);
    typeValue(textarea, "keep me");
    typeValue(textarea, "x".repeat(INPUT_MAX_CHARS + 1));
    expect(textarea.value).toBe("keep me");
    expect(counter.textContent).toBe("7 / 10,000");
    expect(error.textContent).toBe(INPUT_TOO_LONG_MESSAGE);
    expect(INPUT_TOO_LONG_MESSAGE).toBe("Maximum input length exceeded (10,000 characters).");
    submit(form);
    expect(onSubmit).not.toHaveBeenCalled();
    // The next accepted edit clears the error and allows submission again.
    typeValue(textarea, "keep me too");
    expect(error.textContent).toBe("");
    submit(form);
    expect(onSubmit).toHaveBeenCalledWith("keep me too");
  });

  it("accepts input of exactly the limit", () => {
    const { container } = mount(<Harness />);
    const { textarea, error } = parts(container);
    typeValue(textarea, "y".repeat(INPUT_MAX_CHARS));
    expect(textarea.value.length).toBe(INPUT_MAX_CHARS);
    expect(error.textContent).toBe("");
  });

  it("blocks an oversized paste, keeps the existing content, and blocks submission", () => {
    const onSubmit = vi.fn();
    const { container } = mount(<Harness initial="original text" onSubmit={onSubmit} />);
    const { textarea, error, form } = parts(container);
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    const blocked = paste(textarea, "z".repeat(INPUT_MAX_CHARS));
    expect(blocked).toBe(true);
    expect(textarea.value).toBe("original text");
    expect(error.textContent).toBe(INPUT_TOO_LONG_MESSAGE);
    submit(form);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("allows a paste that fits, accounting for the selected text it replaces", () => {
    const { container } = mount(<Harness initial={"a".repeat(INPUT_MAX_CHARS)} />);
    const { textarea, error } = parts(container);
    textarea.setSelectionRange(0, 10); // replacing 10 characters with 10 fits exactly
    expect(paste(textarea, "b".repeat(10))).toBe(false);
    expect(error.textContent).toBe("");
  });

  it("disables submission while loading", () => {
    const onSubmit = vi.fn();
    const { container } = mount(<Harness initial="ready" loading onSubmit={onSubmit} />);
    const { submitButton, form } = parts(container);
    expect(submitButton.disabled).toBe(true);
    submit(form);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("announces errors through an aria-live region linked to the textarea", () => {
    const { container } = mount(<Harness />);
    const { textarea, error } = parts(container);
    expect(error.getAttribute("aria-live")).toBe("polite");
    expect(textarea.getAttribute("aria-describedby")!.split(" ")).toContain(error.id);
  });

  it("uses native, keyboard-focusable controls", () => {
    const { container } = mount(<Harness />);
    const { textarea, submitButton } = parts(container);
    for (const el of [textarea, submitButton]) {
      expect(el.getAttribute("tabindex")).toBeNull();
      el.focus();
      expect(document.activeElement).toBe(el);
      expect(el.className).toContain("focus-visible:outline");
    }
  });

  it("meets 4.5:1 contrast for the submit label (Dark Ink on Pumpkin Orange)", () => {
    const projectInk = contrastRatio("#1A1614", "#FF5A1F");
    const requestedInk = contrastRatio("#1C1917", "#FF5A1F");
    expect(projectInk).toBeGreaterThanOrEqual(4.5);
    expect(requestedInk).toBeGreaterThanOrEqual(4.5);
    expect(projectInk.toFixed(2)).toBe("5.76");
    expect(requestedInk.toFixed(2)).toBe("5.61");
  });
});

describe("SampleTrapButtons", () => {
  it("renders exactly the three required labels", () => {
    expect([...SAMPLE_TRAP_LABELS]).toEqual(["Fake Remote Job DM", "Phishing Payment Link", "Legitimate Bank Alert"]);
    const { container } = mount(<SampleTrapButtons samples={SAMPLES} onSelect={() => {}} />);
    const labels = Array.from(container.querySelectorAll("button")).map((b) => b.textContent);
    expect(labels).toEqual(["Fake Remote Job DM", "Phishing Payment Link", "Legitimate Bank Alert"]);
  });

  it("replaces any existing textarea content with the selected sample", () => {
    const { container } = mount(<Harness initial="user's own draft" />);
    const { textarea, counter } = parts(container);
    const button = (label: string) =>
      Array.from(container.querySelectorAll("button")).find((b) => b.textContent === label)!;

    click(button("Phishing Payment Link"));
    expect(textarea.value).toBe(SAMPLES[1].content);
    expect(counter.textContent).toBe(`${SAMPLES[1].content.length} / 10,000`);
    click(button("Fake Remote Job DM"));
    expect(textarea.value).toBe(SAMPLES[0].content);
  });

  it("uses keyboard-focusable buttons that do not submit the form", () => {
    const onSelect = vi.fn();
    const { container } = mount(<SampleTrapButtons samples={SAMPLES} onSelect={onSelect} />);
    for (const b of Array.from(container.querySelectorAll("button"))) {
      expect(b.getAttribute("type")).toBe("button");
      expect(b.getAttribute("tabindex")).toBeNull();
      b.focus();
      expect(document.activeElement).toBe(b);
      expect(b.className).toContain("focus-visible:outline");
    }
    expect(container.querySelector('[role="group"]')!.getAttribute("aria-label")).toBe("Sample messages");
  });

  it("does not call onSelect when disabled", () => {
    const onSelect = vi.fn();
    const { container } = mount(<SampleTrapButtons samples={SAMPLES} onSelect={onSelect} disabled />);
    click(container.querySelector("button")!);
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe("LoadingState", () => {
  it("is a polite status region that shows the loading text only while active", () => {
    const { container, rerender } = mount(<LoadingState active={false} />);
    const status = container.querySelector('[role="status"]')!;
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.textContent).toBe("");

    rerender(<LoadingState active />);
    expect(container.querySelector('[role="status"]')).toBe(status); // same live region
    expect(status.textContent).toBe(LOADING_TEXT);
    expect(LOADING_TEXT).toBe("Inspecting message and links…");

    rerender(<LoadingState active={false} />);
    expect(status.textContent).toBe("");
  });

  it("shows no per-check progress and animates only with motion-safe", () => {
    const { container } = mount(<LoadingState active />);
    const status = container.querySelector('[role="status"]')!;
    expect(status.textContent).not.toMatch(/\d+\s*(\/|of)\s*\d+|%|check/i);
    const spinner = container.querySelector("[data-spinner]")!;
    expect(spinner.getAttribute("aria-hidden")).toBe("true");
    const classes = spinner.getAttribute("class")!.split(/\s+/);
    expect(classes).toContain("motion-safe:animate-spin");
    expect(classes).not.toContain("animate-spin");
  });
});
