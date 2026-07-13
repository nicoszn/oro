import mermaid from "mermaid";
import { BlockTool, BlockToolConstructorOptions, BlockToolData, ToolboxConfig, SanitizeConfig } from "@editorjs/editorjs";

let initialized = false;
let renderCount = 0;

function ensureMermaid(): void {
  if (initialized) return;
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: "neutral",
    fontFamily: "inherit",
  });
  initialized = true;
}

const DEFAULT_CODE = `flowchart LR
  A[Start] --> B{Decision}
  B -- Yes --> C[Result]
  B -- No --> D[Other result]`;

interface MermaidToolData extends BlockToolData {
  code: string;
}

/**
 * Block Tool for Editor.js — write Mermaid diagram syntax, see it rendered live below.
 * Output data: { code: string } — the raw Mermaid source.
 */
export default class MermaidTool implements BlockTool {
  private data: MermaidToolData;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private wrapper: HTMLDivElement | null = null;
  private preview: HTMLDivElement | null = null;
  private input: HTMLTextAreaElement | null = null;

  static get toolbox(): ToolboxConfig {
    return {
      title: "Mermaid",
      icon: '<svg width="18" height="18" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="4" cy="5" r="2.2"/><circle cx="16" cy="5" r="2.2"/><circle cx="10" cy="15" r="2.2"/><path d="M6 6.4 9 13M14 6.4 11 13"/></svg>',
    };
  }

  constructor({ data }: BlockToolConstructorOptions<MermaidToolData>) {
    this.data = { code: data?.code || DEFAULT_CODE };
  }

  render(): HTMLElement {
    ensureMermaid();

    this.wrapper = document.createElement("div");
    this.wrapper.classList.add("oro-mmd");

    const label = document.createElement("div");
    label.classList.add("oro-block-label");
    label.textContent = "Mermaid diagram";

    this.preview = document.createElement("div");
    this.preview.classList.add("oro-mmd__preview");

    this.input = document.createElement("textarea");
    this.input.classList.add("oro-mmd__input");
    this.input.value = this.data.code;
    this.input.rows = 3;
    this.input.spellcheck = false;
    this.input.addEventListener("input", () => {
      this.autoGrow();
      this.scheduleRender();
    });

    this.wrapper.append(label, this.preview, this.input);
    this.renderDiagram();
    requestAnimationFrame(() => this.autoGrow());

    return this.wrapper;
  }

  private autoGrow(): void {
    if (!this.input) return;
    this.input.style.height = "auto";
    this.input.style.height = `${this.input.scrollHeight}px`;
  }

  private scheduleRender(): void {
    if (!this.input) return;
    this.data.code = this.input.value;
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => this.renderDiagram(), 400);
  }

  private async renderDiagram(): Promise<void> {
    if (!this.input || !this.preview) return;
    this.data.code = this.input.value;
    const code = this.data.code.trim();

    if (!code) {
      this.preview.innerHTML = "";
      this.preview.classList.remove("oro-mmd__preview--error");
      return;
    }

    try {
      const id = `oro-mmd-${Date.now()}-${renderCount++}`;
      const { svg } = await mermaid.render(id, code);
      this.preview.innerHTML = svg;
      this.preview.classList.remove("oro-mmd__preview--error");
    } catch {
      this.preview.textContent = "Could not render diagram — check the syntax.";
      this.preview.classList.add("oro-mmd__preview--error");
    }
  }

  save(): MermaidToolData {
    return this.data;
  }

  static get sanitize(): SanitizeConfig {
    // Raw diagram source, not HTML.
    return { code: true };
  }
}
