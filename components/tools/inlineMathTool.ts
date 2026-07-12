import katex from "katex";

const CSS_CLASS = "oro-inline-math";

function renderTex(el, tex) {
  try {
    katex.render(tex, el, { throwOnError: false, output: "html" });
  } catch {
    el.textContent = tex;
  }
}

/**
 * Inline Tool for Editor.js — select text (raw LaTeX), click to render it inline with KaTeX.
 * Clicking again on rendered math unwraps it back to editable source.
 * The raw LaTeX is kept in the `data-tex` attribute, so saved content survives
 * sanitization and can always be re-rendered on load — see `InlineMathTool.hydrate`.
 */
export default class InlineMathTool {
  static get isInline() {
    return true;
  }

  static get title() {
    return "Math";
  }

  static get CSS() {
    return CSS_CLASS;
  }

  constructor({ api }) {
    this.api = api;
    this.button = null;
    this.tag = "SPAN";
  }

  render() {
    this.button = document.createElement("button");
    this.button.type = "button";
    this.button.classList.add(this.api.styles.inlineToolButton);
    this.button.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><text x="10" y="15" font-size="13" text-anchor="middle" fill="currentColor" font-family="Georgia, serif" font-style="italic">&#8747;</text></svg>';
    return this.button;
  }

  surround(range) {
    if (!range) return;

    const existing = this.api.selection.findParentTag(this.tag, InlineMathTool.CSS);

    if (existing) {
      this.unwrap(existing);
    } else {
      this.wrap(range);
    }
  }

  wrap(range) {
    const tex = range.toString();
    if (!tex.trim()) return;

    const span = document.createElement(this.tag);
    span.classList.add(InlineMathTool.CSS);
    span.dataset.tex = tex;

    range.deleteContents();
    range.insertNode(span);
    renderTex(span, tex);

    this.api.selection.expandToTag(span);
  }

  unwrap(span) {
    const tex = span.dataset.tex || span.textContent || "";
    const textNode = document.createTextNode(tex);
    span.replaceWith(textNode);

    const range = document.createRange();
    range.selectNodeContents(textNode);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  checkState() {
    const span = this.api.selection.findParentTag(this.tag, InlineMathTool.CSS);
    this.button?.classList.toggle(this.api.styles.inlineToolButtonActive, !!span);
  }

  static get sanitize() {
    return {
      span: {
        class: InlineMathTool.CSS,
        "data-tex": true,
      },
    };
  }

  /**
   * Re-render every inline math span inside `container` from its `data-tex` source.
   * Needed once after loading saved content, since Editor.js's HTML sanitizer only
   * knows how to keep the wrapper span (per the rule above) — not KaTeX's inner markup.
   */
  static hydrate(container) {
    container.querySelectorAll(`.${InlineMathTool.CSS}[data-tex]`).forEach((el) => {
      renderTex(el, el.dataset.tex || "");
    });
  }
}
