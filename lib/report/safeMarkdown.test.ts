import { describe, expect, it } from "vitest";
import { toSafeMarkdownText as md } from "./safeMarkdown";

/**
 * True if any `ch` is unescaped: preceded by an even number (including zero)
 * of consecutive backslashes. "\<" is escaped; "\\<" is a literal backslash
 * followed by a live "<".
 */
function hasUnescaped(text: string, ch: string): boolean {
  for (let i = text.indexOf(ch); i !== -1; i = text.indexOf(ch, i + 1)) {
    let backslashes = 0;
    for (let j = i - 1; j >= 0 && text[j] === "\\"; j--) backslashes++;
    if (backslashes % 2 === 0) return true;
  }
  return false;
}

/** No Markdown link, image, autolink, raw HTML tag, code fence, or live URL. */
function expectInert(out: string) {
  expect(out).not.toMatch(/\]\(/); // [text](url)
  expect(hasUnescaped(out, "<")).toBe(false); // raw HTML or <autolink>
  expect(hasUnescaped(out, "`")).toBe(false); // code span or fence
  expect(hasUnescaped(out, "[")).toBe(false); // link or image text
  expect(hasUnescaped(out, "&")).toBe(false); // HTML entity
  expect(out).not.toMatch(/https?:\/\//i);
  expect(out).not.toMatch(/www\./i);
  expect(out).not.toMatch(/[\r\n]/);
}

describe("hasUnescaped (test helper)", () => {
  it("counts consecutive backslashes", () => {
    expect(hasUnescaped("<b>", "<")).toBe(true); // 0 backslashes
    expect(hasUnescaped("\\<b>", "<")).toBe(false); // 1: escaped
    expect(hasUnescaped("\\\\<b>", "<")).toBe(true); // 2: literal "\" then live "<"
    expect(hasUnescaped("\\\\\\<b>", "<")).toBe(false); // 3: escaped
    expect(hasUnescaped("\\<a> <b>", "<")).toBe(true); // second "<" is live
    expect(hasUnescaped("no angle", "<")).toBe(false);
  });
});

describe("toSafeMarkdownText", () => {
  it("escapes input that already contains backslashes", () => {
    // Input "\<script>": the backslash must not cancel the escape of "<".
    expect(md("\\<script>")).toBe("\\\\\\<script\\>");
    // Input "\\<b>" (two backslashes): each is escaped, then "<" is escaped.
    expect(md("\\\\<b>")).toBe("\\\\\\\\\\<b\\>");
    for (const input of [
      "\\<script>alert(1)</script>",
      "\\\\<img src=x onerror=y>",
      "\\[click](https://evil.example)",
      "\\`code\\`",
      "\\&lt;b\\&gt;",
      "trailing backslash \\",
    ]) {
      expectInert(md(input));
    }
  });

  it("neutralizes Markdown links", () => {
    const out = md("[Click here](https://evil.example/login)");
    expect(out).toBe("\\[Click here\\]\\(hxxps://evil\\[\\.\\]example/login\\)");
    expectInert(out);
  });

  it("neutralizes images", () => {
    const out = md("![logo](http://evil.example/a.png)");
    expect(out.startsWith("\\!\\[logo\\]")).toBe(true);
    expectInert(out);
  });

  it("neutralizes raw HTML and entities", () => {
    const out = md('<script>alert(1)</script><img src=x onerror="y"> &#x3C;b&#x3E;');
    // Every "<" is backslash-escaped, so no tag can open.
    expect(out).toContain("\\<script\\>");
    expect(out).toContain("\\<img ");
    expect(out).toContain("\\&\\#x3C;");
    expectInert(out);
  });

  it("neutralizes angle-bracket autolinks and bare www links", () => {
    expectInert(md("<https://evil.example>"));
    expect(md("go to www.evil.example now")).toBe("go to www\\[\\.\\]evil\\[\\.\\]example now");
  });

  it("neutralizes code fences and block syntax by keeping one line", () => {
    const out = md("```js\nalert(1)\n```\n# Heading\n> quote\n- item\n| a | b |");
    expect(out).not.toContain("```");
    expect(out.startsWith("\\`\\`\\`")).toBe(true);
    expect(out).toContain("\\# Heading");
    expectInert(out);
  });

  it("defangs disguised links", () => {
    expect(md("HTTPS://EVIL.EXAMPLE")).toBe("HxxPS://EVIL\\[\\.\\]EXAMPLE");
    expect(md("evil\uFF0Eexample")).toBe("evil\\[\\.\\]example"); // full-width dot
    expect(md("evil\u3002example")).toBe("evil\\[\\.\\]example"); // ideographic dot
    expect(md("//evil.example/x")).toBe("//evil\\[\\.\\]example/x"); // protocol-relative
    expect(md("ftp://files.example")).toBe("ftp\\[://\\]files\\[\\.\\]example");
    expect(md("user@evil.example")).toBe("user@evil\\[\\.\\]example");
  });

  it("replaces invisible and bidirectional-override characters", () => {
    const out = md("invoice\u202Efdp.exe ev\u200Bil.example");
    expect(out).not.toMatch(/[\u202E\u200B]/);
    expect(out).toContain("\uFFFD");
  });

  it("leaves decimals undefanged but escaped", () => {
    expect(md("pay 3.5 BTC")).toBe("pay 3\\.5 BTC");
  });

  it("returns an empty string for non-string input", () => {
    expect(md(undefined)).toBe("");
    expect(md(42)).toBe("");
  });
});
