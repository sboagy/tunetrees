"use client";

import parse from "html-react-parser";
// import type { Jodit } from "jodit";
import { useTheme } from "next-themes";
import dynamic from "next/dynamic";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import "./AutoResizingRichTextarea.css";
// type JoditConfig = Partial<Jodit["options"]>;

// Dynamically import JoditEditor to ensure it only loads on the client side
const JoditEditor = dynamic(
	() => import("jodit-react").then((mod) => mod.default),
	{ ssr: false },
);
// import JoditEditor from "jodit-react";

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
	readOnly = false,
}) => {
	const [editorValue, setEditorValue] = useState(value);
	const editorRef = useRef(null);

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
	const isDarkMode = theme === "dark" || resolvedTheme === "dark";

	// Simplified configuration that works with Jodit 5.x
	const config = useMemo(
    () => ({
      id,
      readonly: false,
      theme: isDarkMode ? "dark" : "default",

      // Set fixed dimensions to prevent layout issues
      width: "100%",
      height: 250,
      minHeight: 150,

      // Simplified toolbar setup
      toolbar: true,
      toolbarSticky: false,

      // Focus points need to be explicitly set for Jodit 5.x
      defaultMode: 1, // 1 = WYSIWYG mode
      enter: "p" as const, // Explicitly set the type to "p"

      // Completely disable all UI elements you don't need
      statusbar: false,
      showCharsCounter: false,
      showWordsCounter: false,
      showXPathInStatusbar: false,

      // Use a limited set of buttons
      buttons: [
        "bold",
        "italic",
        "underline",
        // "strikethrough",
        "|",
        "ul",
        "ol",
        "|",
        // "font",
        // "fontsize",
        // "brush",
        // "|",
        // "link",
        // "image",
        // "|",
        // "align",
        "undo",
        "redo",
        // "|",
        // "hr",
        // "eraser",
        // "fullsize",
      ],

      // Disable plugins that may cause issues
      disablePlugins: ["mobile", "speech-recognize", "stat"],

      // Set these to prevent focus issues
      askBeforePasteHTML: false,
      askBeforePasteFromWord: false,

      // Other essential settings
      spellcheck: true,
    }),
    [id, isDarkMode],
  );

	return (
    <div
      className={`jodit-wrapper ${readOnly ? "read-only" : ""}`}
      style={{
        ...style,
        overflow: "auto",
        resize: "vertical",
        border: readOnly ? "none" : "1px solid #ccc",
        borderRadius: "4px",
      }}
    >
      {readOnly ? (
        <div className={className}>{parse(editorValue)}</div>
      ) : (
        <>
          {!JoditEditor && <div>Loading editor...</div>}
          <JoditEditor
            ref={editorRef}
            key={`jodit-${id}-${isDarkMode ? "dark" : "light"}`}
            value={editorValue}
            config={config}
            onBlur={handleChange}
            onChange={handleChange} // Use the same handler for both events
            tabIndex={0} // Changed from 1 to 0 to follow accessibility best practices
          />
        </>
      )}
    </div>
  );
};

export default AutoResizingRichTextarea;
