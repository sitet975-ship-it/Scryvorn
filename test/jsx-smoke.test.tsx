import { describe, expect, it } from "vitest";
import { useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { click, render } from "./dom";

function Counter() {
  const [n, setN] = useState(0);
  return (
    <button type="button" onClick={() => setN(n + 1)}>
      count {n}
    </button>
  );
}

describe("JSX smoke test", () => {
  it("compiles JSX and renders static markup", () => {
    expect(renderToStaticMarkup(<p className="x">hello</p>)).toBe('<p class="x">hello</p>');
  });

  it("renders and updates a stateful component in jsdom with act", () => {
    const { container, unmount } = render(<Counter />);
    const button = container.querySelector("button")!;
    expect(button.textContent).toBe("count 0");
    click(button);
    expect(button.textContent).toBe("count 1");
    unmount();
  });
});
