/**
 * Minimal React test helpers built only on React 19's `act`, react-dom/client,
 * and jsdom (no component-testing library).
 *
 * Limitations: jsdom does not compute layout or CSS, so these helpers cannot
 * verify visual focus rings, real tab order, or browser focus styles.
 */
import { act, type ReactElement } from "react";
import { createRoot } from "react-dom/client";

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

export interface Rendered {
  container: HTMLDivElement;
  rerender(ui: ReactElement): void;
  unmount(): void;
}

export function render(ui: ReactElement): Rendered {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(ui));
  return {
    container,
    rerender(next) {
      act(() => root.render(next));
    },
    unmount() {
      act(() => root.unmount());
      container.remove();
    },
  };
}

/** Types into a React-controlled textarea or input (native setter + input event). */
export function typeValue(el: HTMLTextAreaElement | HTMLInputElement, value: string): void {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")!.set!;
  act(() => {
    setter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/**
 * Dispatches a cancelable paste event carrying `text`. Returns true if the
 * component prevented the default (that is, blocked the paste).
 */
export function paste(el: HTMLElement, text: string): boolean {
  const event = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clipboardData", {
    value: { getData: (type: string) => (type === "text" || type === "text/plain" ? text : "") },
  });
  let prevented = false;
  act(() => {
    el.dispatchEvent(event);
    prevented = event.defaultPrevented;
  });
  return prevented;
}

export function click(el: HTMLElement): void {
  act(() => {
    el.click();
  });
}

/** Submits a form the way a submit button would (cancelable submit event). */
export function submit(form: HTMLFormElement): void {
  act(() => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

/** Relative luminance and WCAG contrast ratio for #RRGGBB colors. */
export function contrastRatio(hexA: string, hexB: string): number {
  const lum = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  };
  const [hi, lo] = [lum(hexA), lum(hexB)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
