"use client";

import { useEffect, useRef } from "react";
import type EditorJS from "@editorjs/editorjs";
import type { OutputData, ToolConstructable } from "@editorjs/editorjs";
import "katex/dist/katex.min.css";
import "./editor.css";

const STORAGE_KEY = "oro-editor-content";

const DEFAULT_DATA: OutputData = {
  time: Date.now(),
  version: "2.31.6",
  blocks: [
    { type: "header", data: { text: "Welcome to Oro", level: 1 } },
    {
      type: "paragraph",
      data: {
        text: "A small block editor. Type <code>/</code> for the toolbox, or use the <b>+</b> button on the left of each line. Select text to format it — including inline math like this one:",
      },
    },
    {
      type: "paragraph",
      data: {
        text: 'The quadratic formula, <span class="oro-inline-math" data-tex="x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}">x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}</span>, solves for x.',
      },
    },
    {
      type: "list",
      data: {
        style: "unordered",
        items: [
          { content: "<b>Markdown</b> block with a live preview", items: [] },
          { content: "<b>Mermaid</b> diagrams", items: [] },
          { content: "<b>Math</b> blocks and inline math", items: [] },
          { content: "Headers, lists, quotes, code, and tables", items: [] },
        ],
      },
    },
    {
      type: "markdown",
      data: {
        text: "### Markdown block\nWrite **Markdown** directly — it renders live underneath.\n\n- supports lists\n- and `code`",
      },
    },
    {
      type: "mermaid",
      data: {
        code: "flowchart LR\n  A[Write] --> B{Happy?}\n  B -- Yes --> C[Publish]\n  B -- No --> A",
      },
    },
    { type: "math", data: { tex: "e^{i\\pi} + 1 = 0" } },
    { type: "delimiter", data: {} },
    {
      type: "quote",
      data: {
        text: "Everything should be made as simple as possible, but not simpler.",
        caption: "",
        alignment: "left",
      },
    },
  ],
};

export default function NoteEditor() {
  const holderRef = useRef<HTMLDivElement | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    let editor: EditorJS | null = null;

    async function init() {
      const [
        { default: EditorJSClass },
        { default: Header },
        { default: EditorjsList },
        { default: Quote },
        { default: CodeTool },
        { default: Table },
        { default: Delimiter },
        { default: Marker },
        { default: InlineCode },
        { default: Underline },
        { default: MarkdownTool },
        { default: MermaidTool },
        { default: MathTool },
        { default: InlineMathTool },
      ] = await Promise.all([
        import("@editorjs/editorjs"),
        import("@editorjs/header"),
        import("@editorjs/list"),
        import("@editorjs/quote"),
        import("@editorjs/code"),
        import("@editorjs/table"),
        import("@editorjs/delimiter"),
        import("@editorjs/marker"),
        import("@editorjs/inline-code"),
        import("@editorjs/underline"),
        import("./tools/markdownTool"),
        import("./tools/mermaidTool"),
        import("./tools/mathTool"),
        import("./tools/inlineMathTool"),
      ]);

      if (cancelled || !holderRef.current) return;

      let initialData = DEFAULT_DATA;
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved) initialData = JSON.parse(saved);
      } catch {
        // ignore corrupt storage, fall back to the default content
      }

      editor = new EditorJSClass({
        holder: holderRef.current,
        placeholder: "Start writing, or press '/' for commands…",
        autofocus: true,
        data: initialData,
        inlineToolbar: true,
        tools: {
          header: { class: Header, config: { levels: [1, 2, 3, 4], defaultLevel: 2 } },
          list: { class: EditorjsList, inlineToolbar: true, config: { defaultStyle: "unordered" } },
          quote: { class: Quote, inlineToolbar: true },
          code: CodeTool,
          table: {
            class: Table as unknown as ToolConstructable,
            inlineToolbar: true,
            config: { withHeadings: true },
          },
          delimiter: Delimiter,
          markdown: MarkdownTool,
          mermaid: MermaidTool,
          math: MathTool,
          marker: Marker,
          inlineCode: InlineCode,
          underline: Underline,
          inlineMath: InlineMathTool,
        },
        onChange: (api) => {
          if (saveTimer.current) clearTimeout(saveTimer.current);
          saveTimer.current = setTimeout(async () => {
            try {
              const output = await api.saver.save();
              window.localStorage.setItem(STORAGE_KEY, JSON.stringify(output));
            } catch {
              // best-effort autosave only
            }
          }, 500);
        },
        onReady: () => {
          if (holderRef.current) InlineMathTool.hydrate(holderRef.current);
        },
      });
    }

    init();

    return () => {
      cancelled = true;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (editor) {
        Promise.resolve(editor.isReady)
          .then(() => editor?.destroy())
          .catch(() => {});
      }
    };
  }, []);

  return <div ref={holderRef} className="oro-editor" />;
}
