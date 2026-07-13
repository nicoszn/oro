import katex from "katex";
import type { BlockTool, API, BlockToolData } from "@editorjs/editorjs";

interface MathData extends BlockToolData {
  math: string;
}

export default class MathTool implements BlockTool {
  private api: API;
  private data: MathData;
  private wrapper: HTMLDivElement | null = null;
  private inputElement: HTMLTextAreaElement | null = null;
  private previewElement: HTMLDivElement | null = null;

  constructor({ data, api }: { data: MathData; api: API }) {
    this.api = api;
    this.data = {
      math: data.math || "\\sigma(x) = \\frac{1}{1 + e^{-x}}",
    };
  }

  static get toolbox() {
    return {
      title: "Math Block",
      icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M4 7v2M20 7v2M9 7v11a2 2 0 0 0 2 2h2"/></svg>`,
    };
  }

  render() {
    this.wrapper = document.createElement("div");
    this.wrapper.classList.add("cdx-math-block");

    // 1. Math Preview Area
    this.previewElement = document.createElement("div");
    this.previewElement.classList.add("cdx-math-preview");
    this.previewElement.contentEditable = "false";
    
    // 2. Raw Code Textarea Input
    this.inputElement = document.createElement("textarea");
    this.inputElement.classList.add("cdx-math-input");
    this.inputElement.value = this.data.math;
    this.inputElement.placeholder = "Enter LaTeX equation here...";

    // Prevent input event bubbling from triggering unwanted editor selection jumps
    this.inputElement.addEventListener("keydown", (e) => {
      e.stopPropagation();
    });

    this.inputElement.addEventListener("input", () => {
      this.data.math = this.inputElement?.value || "";
      this.updatePreview();
    });

    this.wrapper.appendChild(this.previewElement);
    this.wrapper.appendChild(this.inputElement);

    // Initial rendering invocation
    this.updatePreview();

    return this.wrapper;
  }

  /**
   * FIXED: Clears stale DOM traces before printing new nodes 
   * to eliminate duplication anomalies during React StrictMode mount steps.
   */
  private updatePreview() {
    if (!this.previewElement) return;
    
    // Crucial Step: Erase past elements completely before updating math strings
    this.previewElement.innerHTML = ""; 
    
    try {
      const expression = this.data.math.trim();
      
      if (expression === "") {
        this.previewElement.innerHTML = `<span class="text-zinc-400 italic text-sm">Empty Equation block</span>`;
        return;
      }

      katex.render(expression, this.previewElement, {
        displayMode: true,
        throwOnError: false,
      });
    } catch (err) {
      this.previewElement.innerHTML = `<span class="text-red-500 text-sm font-medium">Invalid LaTeX syntax</span>`;
    }
  }

  save(): MathData {
    return {
      math: this.data.math,
    };
  }
}
