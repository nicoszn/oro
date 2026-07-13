import katex from "katex";
import { InlineTool, InlineToolConstructorOptions, API, SanitizeConfig } from "@editorjs/editorjs";

const CSS_CLASS = "oro-inline-math";

function renderTex(el: HTMLElement, tex: string): void {
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
export default class InlineMathTool implements InlineTool {
  private api: API;
  private button: HTMLButtonElement | null = null;
  private readonly tag = "SPAN";

  static get isInline(): boolean {
    return true;
  }

  static get title(): string {
    return "Math";
  }

  static get CSS(): string {
    return CSS_CLASS;
  }

  constructor({ api }: InlineToolConstructorOptions) {
    this.api = api;
  }

  render(): HTMLElement {
    this.button = document.createElement("button");
    this.button.type = "button";
    this.button.classList.add(this.api.styles.inlineToolButton);
    this.button.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><text x="10" y="15" font-size="13" text-anchor="middle" fill="currentColor" font-family="Georgia, serif" font-style="italic">∫</text></svg>';
    return this.button;
  }

  surround(range: Range | null): void {
    if (!range) return;

    const existing = this.api.selection.findParentTag(this.tag, InlineMathTool.CSS) as HTMLElement | null;

    if (existing) {
      this.unwrap(existing);
    } else {
      this.wrap(range);
    }
  }

  private wrap(range: Range): void {
    const tex = range.toString();
    if (!tex.trim()) return;

    const span = document.createElement(this.tag) as HTMLElement;
    span.classList.add(InlineMathTool.CSS);
    span.dataset.tex = tex;

    range.deleteContents();
    range.insertNode(span);
    renderTex(span, tex);

    this.api.selection.expandToTag(span);
  }

  private unwrap(span: HTMLElement): void {
    const tex = span.dataset.tex || span.textContent || "";
    const textNode = document.createTextNode(tex);
    span.replaceWith(textNode);

    const range = document.createRange();
    range.selectNodeContents(textNode);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  checkState(): void {
    const span = this.api.selection.findParentTag(this.tag, InlineMathTool.CSS);
    this.button?.classList.toggle(this.api.styles.inlineToolButtonActive, !!span);
  }

  static get sanitize(): SanitizeConfig {
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
  static hydrate(container: HTMLElement): void {
    container.querySelectorAll<HTMLElement>(`.${InlineMathTool.CSS}[data-tex]`).forEach((el) => {
      renderTex(el, el.dataset.tex || "");
    });
  }
}
