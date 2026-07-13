"use client";

import { useEffect, useRef } from "react";
import type EditorJS from "@editorjs/editorjs";
import type { OutputData, ToolConstructable, ToolSettings } from "@editorjs/editorjs";
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
      type: "list",
      data: {
        style: "unordered",
        items: [
          "Verify dynamic code-splitting modules load successfully.",
          "Check toolbar alignment boundaries against page edges.",
          "Ensure autosave loops handle complex block arrays."
        ],
      },
    },
     {
      type: "list",
      data: {
        style: "ordered",
        items: [
          "Initialize core script packages.",
          "Hydrate document node structure maps.",
          "Mount interactive state hooks onto client frameworks."
        ],
      },
    },
        {
      type: "table",
      data: {
        withHeadings: true,
        content: [
          ["Plugin Name", "Status", "Bundle Size"],
          ["@editorjs/header", "Operational", "Lightweight"],
          ["@editorjs/list", "Operational", "Standard"],
          ["@editorjs/table", "Operational", "Medium"]
        ],
      },
    },
    {
      id: "math_para_inline",
      type: "paragraph",
      data: { 
        text: "You can embed notation seamlessly inside a sentence like <span class=\"oro-inline-math\" data-tex=\"\\lim_{x \\to \\infty} f(x)\" contenteditable=\"false\">\\lim_{x \\to \\infty} f(x)</span> to discuss variables directly." 
      },
    },
    {
      id: "math_block_structural",
      type: "math", // Targets our registered Math Block tool
      data: {
        math: "\\nabla \\times \\mathbf{E} = -\\frac{\\partial \\mathbf{B}}{\\partial t}"
      },
    },
    {
      type: "paragraph",
      data: {
        text: 'The quadratic formula, <span class="oro-inline-math" data-tex="x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}">x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}</span>, solves for x.',
      },
    },
    // {
    //   type: "list",
    //   data: {
    //     style: "unordered",
    //     items: [
    //       { content: "<b>Markdown</b> block with a live preview", items: [] },
    //       { content: "<b>Mermaid</b> diagrams", items: [] },
    //       { content: "<b>Math</b> blocks and inline math", items: [] },
    //       { content: "Headers, lists, quotes, code, and tables", items: [] },
    //     ],
    //   },
    // },
    // {
    //   type: "markdown",
    //   data: {
    //     text: "### Markdown block\nWrite **Markdown** directly — it renders live underneath.\n\n- supports lists\n- and `code`",
    //   },
    // },
    {
      type: "mermaid",
      data: {
        code: "flowchart LR\n  A[Write] --> B{Happy?}\n  B -- Yes --> C[Publish]\n  B -- No --> A",
      },
    },
    {
      id: "mermaid_block_example",
      type: "mermaid", // TARGET KEY SPECIFIER MATCHING TOOLS MAP CONFIG BELOW
      data: {
        code: "graph LR\n  A[Input String] --> B(Local Parser)\n  B --> C[Vector Output Rendering]"
      },
    },
     { type: "math", data: { math: "e^{i\\pi} + 1 = 0" } },
    // { type: "delimiter", data: {} },
    // {
    //   type: "quote",
    //   data: {
    //     text: "Everything should be made as simple as possible, but not simpler.",
    //     caption: "",
    //     alignment: "left",
    //   },
    // },
  ],
};



export default function NoteEditor() {
  const holderRef = useRef<HTMLDivElement | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorRef = useRef<EditorJS | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      // Load only core EditorJS and Header plugin
      const [
        { default: EditorJSClass }, 
        { default: Header },
        { default: EditorjsList },
        { default: Table },
        { default: InlineMath },
        { default: MathTool },
        { default: MermaidTool },

      ] = await Promise.all([
        import("@editorjs/editorjs"),
        import("@editorjs/header"),
        import("@editorjs/list"),
        import("@editorjs/table"),
        import("./tools/inlineMath"),
        import("./tools/mathTool"),
        import("./tools/mermaidTool"),
      ]);

      if (cancelled || !holderRef.current) return;

      // Hydrate from LocalStorage
      let initialData = DEFAULT_DATA;
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved) initialData = JSON.parse(saved);
      } catch {
        // Fall back to default data if empty or corrupt
      }

      // Initialize stripped-down editor instance
      const instance = new EditorJSClass({
        holder: holderRef.current,
        placeholder: "Start writing, or press '/' for commands…",
        autofocus: true,
        data: initialData,
        inlineToolbar: true,
        tools: {
          // Paragraph is built into EditorJS by default; no plugin import needed
          header: {
            class: Header as any,
            config: {
              placeholder: "Enter a heading",
              levels: [1, 2, 3, 4],
              defaultLevel: 2,
            },
          } as ToolSettings,
            list: {
            class: EditorjsList,
            inlineToolbar: true,
            config: {
              defaultStyle: "unordered"
            }
          } as ToolSettings,

          // Table block configuration
          table: {
            class: Table,
            inlineToolbar: true,
            config: {
              rows: 2,
              cols: 2,
              withHeadings: true
            }
          } as ToolSettings,

          inlineMath: InlineMath,
          math: MathTool,
          mermaid: MermaidTool,
        },

         onReady: () => {
    if (holderRef.current) {
      InlineMath.hydrate(holderRef.current);
    }
  },

        onChange: (api) => {
          if (saveTimer.current) clearTimeout(saveTimer.current);
          
          saveTimer.current = setTimeout(async () => {
            try {
              const output = await api.saver.save();
              window.localStorage.setItem(STORAGE_KEY, JSON.stringify(output));
            } catch {
              // Best-effort autosave handling
            }
          }, 500);
        },
      });

      editorRef.current = instance;
    }

    init();

    return () => {
      cancelled = true;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      
      const activeEditor = editorRef.current;
      if (activeEditor) {
        Promise.resolve(activeEditor.isReady)
          .then(() => {
            activeEditor.destroy();
            editorRef.current = null;
          })
          .catch(() => {});
      }
    };
  }, []);

  return <div ref={holderRef} className="oro-editor prose max-w-none min-h-[300px]" />;
}
