import katex from "katex";
import { BlockTool, BlockToolConstructorOptions, BlockToolData, ToolboxConfig, SanitizeConfig } from "@editorjs/editorjs";

interface MathToolData extends BlockToolData {
  tex: string;
}

/**
 * Block Tool for Editor.js — a standalone, display-mode LaTeX equation.
 * Output data: { tex: string } — the raw LaTeX source.
 */
export default class MathTool implements BlockTool {
  private data: MathToolData;
  private wrapper: HTMLDivElement | null = null;
  private preview: HTMLDivElement | null = null;
  private input: HTMLTextAreaElement | null = null;

  static get toolbox(): ToolboxConfig {
    return {
      title: "Math",
      icon: '<svg width="18" height="18" viewBox="0 0 20 20" xmlns="http://w3.org"><text x="10" y="15" font-size="14" text-anchor="middle" fill="currentColor" font-family="Georgia, serif">∑</text></svg>',
    };
  }

  constructor({ data }: BlockToolConstructorOptions<MathToolData>) {
    this.data = { tex: data?.tex || "" };
  }

  render(): HTMLElement {
    this.wrapper = document.createElement("div");
    this.wrapper.classList.add("cdx-math-block");

    this.preview = document.createElement("div");
    this.preview.classList.add("cdx-math-preview");

    this.input = document.createElement("textarea");
    this.input.classList.add("cdx-math-input");
    this.input.placeholder = "\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}";
    this.input.value = this.data.tex;
    this.input.spellcheck = false;
    this.input.addEventListener("input", () => this.update());

    this.wrapper.append(this.preview, this.input);
    this.update();

    return this.wrapper;
  }

  private update(): void {
    if (!this.input || !this.preview) return;

    this.data.tex = this.input.value;
    const tex = this.data.tex.trim();

    if (!tex) {
      this.preview.innerHTML = "";
      return;
    }

    try {
      katex.render(tex, this.preview, { throwOnError: true, displayMode: true });
    } catch {
      this.preview.textContent = "Invalid LaTeX";
    }
  }

  save(): MathToolData {
    return this.data;
  }

  static get sanitize(): SanitizeConfig {
    // Raw LaTeX source, not HTML.
    return { tex: true };
  }
}
