import { marked } from "marked";
import DOMPurify from "dompurify";
import { BlockTool, BlockToolConstructorOptions, BlockToolData, ToolboxConfig } from "@editorjs/editorjs";

marked.setOptions({ breaks: true, gfm: true });

interface MarkdownToolData extends BlockToolData {
  text: string;
}

/**
 * Block Tool for Editor.js — write raw Markdown, see it rendered live below.
 * Output data: { text: string } — the raw Markdown source.
 */
export default class MarkdownTool implements BlockTool {
  private data: MarkdownToolData;
  private wrapper: HTMLDivElement | null = null;
  private input: HTMLTextAreaElement | null = null;
  private preview: HTMLDivElement | null = null;

  static get toolbox(): ToolboxConfig {
    return {
      title: "Markdown",
      icon: '<svg width="18" height="18" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="3" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.4"/><text x="10" y="14.5" font-size="7.5" font-weight="700" text-anchor="middle" fill="currentColor" font-family="monospace">M↓</text></svg>',
    };
  }

  constructor({ data }: BlockToolConstructorOptions<MarkdownToolData>) {
    this.data = { text: data?.text || "" };
  }

  render(): HTMLElement {
    this.wrapper = document.createElement("div");
    this.wrapper.classList.add("oro-md");

    const label = document.createElement("div");
    label.classList.add("oro-block-label");
    label.textContent = "Markdown";

    this.input = document.createElement("textarea");
    this.input.classList.add("oro-md__input");
    this.input.placeholder = "# Write markdown here…";
    this.input.value = this.data.text;
    this.input.rows = 2;
    this.input.spellcheck = false;
    this.input.addEventListener("input", () => {
      this.autoGrow();
      this.update();
    });

    this.preview = document.createElement("div");
    this.preview.classList.add("oro-md__preview");

    this.wrapper.append(label, this.input, this.preview);
    this.update();
    requestAnimationFrame(() => this.autoGrow());

    return this.wrapper;
  }

  private autoGrow(): void {
    if (!this.input) return;
    this.input.style.height = "auto";
    this.input.style.height = `${this.input.scrollHeight}px`;
  }

  private update(): void {
    if (!this.input || !this.preview) return;
    this.data.text = this.input.value;
    
    // marked.parse can return a Promise if async options are set, 
    // but with default gfm/breaks settings it returns a string.
    const html = marked.parse(this.data.text || "") as string;
    this.preview.innerHTML = DOMPurify.sanitize(html);
  }

  save(): MarkdownToolData {
    return this.data;
  }

  static get sanitize(){
    // Raw markdown source, not HTML — trust it as-is (rendering is sanitized separately).
    return { text: true };
  }
}
