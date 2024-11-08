/* eslint-disable @typescript-eslint/naming-convention */
declare module "react-quill" {
  import type { Component } from "react";

  type QuillOptions = object;

  interface ReactQuillProps {
    value?: string;
    defaultValue?: string;
    readOnly?: boolean;
    theme?: string;
    modules?: QuillOptions;
    formats?: string[];
    bounds?: string | HTMLElement;
    placeholder?: string;
    tabIndex?: number;
    onChange?: (
      content: string,
      delta: Delta,
      source: Sources,
      editor: Quill,
    ) => void;
    onFocus?: (range: RangeStatic, source: Sources, editor: Quill) => void;
    onBlur?: (
      previousRange: RangeStatic,
      source: Sources,
      editor: Quill,
    ) => void;
    onKeyPress?: (event: React.KeyboardEvent) => void;
    onKeyDown?: (event: React.KeyboardEvent) => void;
    onKeyUp?: (event: React.KeyboardEvent) => void;
    style?: React.CSSProperties;
    className?: string;
  }

  class ReactQuill extends Component<ReactQuillProps> {
    focus(): void;
    blur(): void;
    getEditor(): Quill;
  }

  export default ReactQuill;
}
