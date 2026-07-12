import katex from "katex";

/**
 * Block Tool for Editor.js — a standalone, display-mode LaTeX equation.
 * Output data: { tex: string } — the raw LaTeX source.
 */
export default class MathTool {
  static get toolbox() {
    return {
      title: "Math",
      icon: '<svg width="18" height="18" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><text x="10" y="15" font-size="14" text-anchor="middle" fill="currentColor" font-family="Georgia, serif">&#8721;</text></svg>',
    };
  }

  constructor({ data }) {
    this.data = { tex: data.tex || "" };
  }

  render() {
    this.wrapper = document.createElement("div");
    this.wrapper.classList.add("oro-math");

    const label = document.createElement("div");
    label.classList.add("oro-block-label");
    label.textContent = "Math";

    this.preview = document.createElement("div");
    this.preview.classList.add("oro-math__preview");

    this.input = document.createElement("input");
    this.input.type = "text";
    this.input.classList.add("oro-math__input");
    this.input.placeholder = "\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}";
    this.input.value = this.data.tex;
    this.input.spellcheck = false;
    this.input.addEventListener("input", () => this.update());

    this.wrapper.append(label, this.preview, this.input);
    this.update();

    return this.wrapper;
  }

  update() {
    this.data.tex = this.input.value;
    const tex = this.data.tex.trim();

    if (!tex) {
      this.preview.innerHTML = "";
      this.preview.classList.remove("oro-math__preview--error");
      return;
    }

    try {
      katex.render(tex, this.preview, { throwOnError: true, displayMode: true });
      this.preview.classList.remove("oro-math__preview--error");
    } catch {
      this.preview.textContent = "Invalid LaTeX";
      this.preview.classList.add("oro-math__preview--error");
    }
  }

  save() {
    return this.data;
  }

  static get sanitize() {
    // Raw LaTeX source, not HTML.
    return { tex: true };
  }
}
