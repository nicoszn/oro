declare module '@editorjs/header' {
  import { BlockToolConstructable } from '@editorjs/editorjs';
  const Header: BlockToolConstructable;
  export default Header;
}

declare module '@editorjs/list' {
  import { BlockToolConstructable } from '@editorjs/editorjs';
  const List: BlockToolConstructable;
  export default EditorjsList;
}

declare module '@editorjs/quote' {
  import { BlockToolConstructable } from '@editorjs/editorjs';
  const Quote: BlockToolConstructable;
  export default Quote;
}

declare module '@editorjs/code' {
  import { BlockToolConstructable } from '@editorjs/editorjs';
  const Code: BlockToolConstructable;
  export default Code;
}

declare module '@editorjs/table' {
  import { BlockToolConstructable } from '@editorjs/editorjs';
  const Table: BlockToolConstructable;
  export default Table;
}

declare module '@editorjs/delimiter' {
  import { BlockToolConstructable } from '@editorjs/editorjs';
  const Delimiter: BlockToolConstructable;
  export default Delimiter;
}

declare module '@editorjs/inline-code' {
  import { InlineToolConstructable } from '@editorjs/editorjs';
  const InlineCode: InlineToolConstructable;
  export default InlineCode;
}

declare module '@editorjs/marker' {
  import { InlineToolConstructable } from '@editorjs/editorjs';
  const Marker: InlineToolConstructable;
  export default Marker;
}

// Optional: Include this if your Citation tool is an installed package
declare module '@editorjs/citation' {
  import { BlockToolConstructable } from '@editorjs/editorjs';
  const Citation: BlockToolConstructable;
  export default Citation;
}

declare module '@editorjs/paragraph' {
  import { BlockToolConstructable } from '@editorjs/editorjs';
  const Paragraph: BlockToolConstructable;
  export default Paragraph;
}

declare module '@editorjs/underline' {
  import { InlineToolConstructable } from '@editorjs/editorjs';
  const Underline: InlineToolConstructable;
  export default Underline;
}

declare module '@editorjs/image' {
  import { BlockToolConstructable } from '@editorjs/editorjs';
  const ImageTool: BlockToolConstructable;
  export default ImageTool;
}

declare module '@editorjs/attaches' {
  import { BlockToolConstructable } from '@editorjs/editorjs';
  const AttachesTool: BlockToolConstructable;
  export default AttachesTool;
}

declare module '@editorjs/footnotes' {
  import { BlockTuneConstructable } from '@editorjs/editorjs';
  const FootnotesTune: BlockTuneConstructable;
  export default FootnotesTune;
}

declare module '@phigoro/editorjs-toc' {
  import { BlockToolConstructable } from '@editorjs/editorjs';
  const TOC: BlockToolConstructable;
  export default TOC;
}

declare module 'editorjs-text-alignment-blocktune' {
  import { BlockTuneConstructable } from '@editorjs/editorjs';
  const AlignmentTune: BlockTuneConstructable;
  export default AlignmentTune;
}

declare module 'editorjs-mathcyou' {
  import { InlineToolConstructable, BlockToolConstructable } from '@editorjs/editorjs';
  export const InlineMathTool: InlineToolConstructable;
  export const MathBlock: BlockToolConstructable;
}

declare module '*.pcss' {
  const content: { [className: string]: string };
  export default content;
}

declare module '@codexteam/shortcuts' {
  interface ShortcutOptions {
    name: string;
    on: HTMLElement;
    callback: (event?: KeyboardEvent) => void;
  }

  class Shortcut {
    constructor(options: ShortcutOptions);
    public remove(): void;
  }

  export default Shortcut;
}





