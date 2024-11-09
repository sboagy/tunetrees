"use client";

import { useState, useEffect } from "react";
import type React from "react";
import dynamic from "next/dynamic";
import "react-quill/dist/quill.snow.css";
import "./AutoResizingRichTextarea.css";
import parse from "html-react-parser";

// Dynamically import ReactQuill to ensure it only loads on the client side
// eslint-disable-next-line @typescript-eslint/naming-convention
const ReactQuill = dynamic(() => import("react-quill"), { ssr: false });

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
  placeholder,
  className,
  style,
  readOnly,
}) => {
  const [editorValue, setEditorValue] = useState(value);

  console.log("AutoResizingRichTextarea: id: ", id);

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

  // const modules = {
  //   toolbar: [
  //     [{ header: "1" }, { header: "2" }, { font: [] }],
  //     [{ size: [] }],
  //     ["bold", "italic", "underline", "strike", "blockquote"],
  //     [
  //       { list: "ordered" },
  //       { list: "bullet" },
  //       { indent: "-1" },
  //       { indent: "+1" },
  //     ],
  //     ["link", "image"],
  //     ["clean"],
  //   ],
  // };

  // const modules = {
  //   toolbar: [
  //     [{ header: [1, 2, false] }], // Combine header options
  //     ["bold", "italic", "underline", "strike"], // Common formatting options
  //     [{ list: "ordered" }, { list: "bullet" }], // List options
  //     [{ color: [] }, { background: [] }], // Color and background
  //     ["link", "image"], // Links and images
  //     ["clean"], // Clean formatting
  //   ],
  // };

  const modules = {
    toolbar: [
      [{ header: [1, 2, false] }],
      [
        "bold",
        "italic",
        "underline",
        "strike",
        { list: "ordered" },
        { list: "bullet" },
      ], // Combined formatting and lists
      [{ color: [] }, { background: [] }, "link", "image"], // Combined colors, links, and images
      ["clean"],
    ],
  };

  // const modules = {
  //   toolbar: [
  //     [{ header: [1, 2, false] }],
  //     [
  //       {
  //         list: [
  //           {
  //             label: "Style",
  //             value: ["bold", "italic", "underline", "strike"],
  //           }, // Add style options here
  //           { list: "ordered" },
  //           { list: "bullet" },
  //         ],
  //       },
  //     ],
  //     [{ color: [] }, { background: [] }, "link", "image"],
  //     ["clean"],
  //   ],
  // };

  return (
    <div
      className="quill-container"
      style={{ ...style, overflow: "hidden", resize: "vertical" }}
    >
      {readOnly ? (
        <div className={className}>{parse(editorValue)}</div>
      ) : (
        <ReactQuill
          // id={id}
          value={editorValue}
          onChange={handleChange}
          placeholder={placeholder}
          className={className}
          readOnly={readOnly}
          theme="snow"
          modules={modules}
        />
      )}
    </div>
  );
};

export default AutoResizingRichTextarea;
