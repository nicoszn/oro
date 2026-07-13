import katex from "katex";
import type { InlineTool, API } from "@editorjs/editorjs";

export default class InlineMath implements InlineTool {
  private api: API;
  private button: HTMLButtonElement | null = null;
  private tag = "SPAN";
  private classname = "oro-inline-math";

  static get isInline() {
    return true;
  }

  // --- ADD THIS HYDRATOR METHOD ---
  /**
   * Scans the editor DOM canvas and processes plain text equations
   * into compiled math notation vectors on startup.
   */
  static hydrate(holderElement: HTMLElement) {
    const formulas = holderElement.querySelectorAll(".oro-inline-math");
    formulas.forEach((element) => {
      const texExpression = element.getAttribute("data-tex");
      if (texExpression) {
        // Suppress typing cursors from corrupting the layout
        (element as HTMLElement).contentEditable = "false";
        katex.render(texExpression, element as HTMLElement, {
          throwOnError: false,
        });
      }
    });
  }

  constructor({ api }: { api: API }) {
    this.api = api;
  }

  render() {
    this.button = document.createElement("button");
    this.button.type = "button";
    this.button.classList.add(this.api.styles.inlineToolButton);
    this.button.innerHTML = `<span style="font-weight: bold; font-family: serif;">f(x)</span>`;
    return this.button;
  }

  surround(range: Range) {
    if (!range) return;

    const termWrapper = this.api.selection.findParentTag(this.tag, this.classname);

    if (termWrapper) {
      const existingTex = termWrapper.getAttribute("data-tex") || "";
      const updatedTex = prompt("Edit LaTeX Equation:", existingTex);
      
      if (updatedTex === null) return;
      
      if (updatedTex.trim() === "") {
        this.unwrap(termWrapper);
      } else {
        termWrapper.setAttribute("data-tex", updatedTex);
        katex.render(updatedTex, termWrapper, { throwOnError: false });
      }
    } else {
      const selectedText = range.toString() || "\\chi^2";
      const formulaTex = prompt("Enter LaTeX Equation:", selectedText);
      
      if (!formulaTex) return;

      const mathSpan = document.createElement(this.tag);
      mathSpan.classList.add(this.classname);
      mathSpan.setAttribute("data-tex", formulaTex);
      mathSpan.contentEditable = "false";

      katex.render(formulaTex, mathSpan, { throwOnError: false });

      range.deleteContents();
      range.insertNode(mathSpan);
    }
  }

  checkState(selection: Selection): boolean {
    const termWrapper = this.api.selection.findParentTag(this.tag, this.classname);
    const isActive = !!termWrapper;
    this.button?.classList.toggle(this.api.styles.inlineToolButtonActive, isActive);
    return isActive;
  }

  private unwrap(wrapper: HTMLElement) {
    const textNode = document.createTextNode(wrapper.getAttribute("data-tex") || "");
    wrapper.parentNode?.replaceChild(textNode, wrapper);
  }
}
