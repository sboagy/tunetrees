"use client";

import parse from "html-react-parser";
import { useTheme } from "next-themes";
import dynamic from "next/dynamic";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import "./AutoResizingRichTextarea.css";
// import JoditEditor from "jodit-react";

// Dynamically import JoditEditor to ensure it only loads on the client side
// eslint-disable-next-line @typescript-eslint/naming-convention
const JoditEditor = dynamic(
  () => import("jodit-react").then((mod) => mod.default),
  {
    ssr: false,
  },
);

interface IAutoResizingRichTextareaProps {
  id: string;
  value: string;
  onChange: (content: string) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  readOnly?: boolean;
}

const AutoResizingRichTextarea: React.FC<IAutoResizingRichTextareaProps> = ({
  id,
  value,
  onChange,
  className,
  style,
  readOnly,
}) => {
  console.log(
    `render ===> AutoResizingRichTextarea.tsx:39 ~ id=${id}, value=${value}, className=${className}, readOnly=${readOnly}`,
  );
  const [editorValue, setEditorValue] = useState(value);

  useEffect(() => {
    // Convert plain text to HTML if necessary
    if (!/<[a-z][\S\s]*>/i.test(value)) {
      setEditorValue(`<p>${value}</p>`);
    } else {
      setEditorValue(value);
    }
  }, [value]);

  const handleChange = (content: string) => {
    setEditorValue(content);
    onChange(content);
  };

  const { theme, resolvedTheme } = useTheme();

  // Determine if the theme is dark
  const isDarkMode = theme === "dark" || resolvedTheme === "dark";

  const config = useMemo(
    () => ({
      ic: id,
      readonly: false,
      theme: isDarkMode ? "dark" : "default",
      style: {
        background: "var(--jd-color-background-default)",
        border: "1px solid var(--jd-color-border)",
        panel: "var(--jd-color-panel)",
        icon: "var(--jd-color-icon)",
      },
      toolbar: false, // Initially hide the toolbar
      // placeholder: placeholder,
      toolbarSticky: false,
      toolbarAdaptive: false,
      spellcheck: true,
      showCharsCounter: false,
      showWordsCounter: false,
      showXPathInStatusbar: false,
      buttons: [
        "bold",
        "italic",
        "underline",
        "strikethrough",
        "|",
        "ul",
        "ol",
        "|",
        "font",
        "fontsize",
        "brush",
        "|",
        "link",
        "image",
        "|",
        "align",
        "undo",
        "redo",
        "|",
        "hr",
        "eraser",
        "fullsize",
      ],
      buttonsXS: [
        "bold",
        "italic",
        "underline",
        "strikethrough",
        "|",
        "ul",
        "ol",
        "|",
        "font",
        "fontsize",
        "brush",
        "|",
        "link",
        "image",
        "|",
        "align",
        "undo",
        "redo",
        "|",
        "hr",
        "eraser",
        "fullsize",
      ],
      i18n: {
        en: {
          "Type something": "Type something",
          // Add other necessary localization strings here
        },
      },
    }),
    [id, isDarkMode],
  );

  return (
    <div
      className="read-only-rich"
      style={{ ...style, overflow: "hidden", resize: "vertical" }}
    >
      {readOnly ? (
        <div className={className}>{parse(editorValue)}</div>
      ) : (
        <JoditEditor
          value={editorValue}
          config={config}
          onBlur={handleChange}
          onChange={(newContent) => {
            handleChange(newContent);
          }}
        />
      )}
    </div>
  );
};

export default AutoResizingRichTextarea;
