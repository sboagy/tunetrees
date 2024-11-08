import { useState, useEffect } from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import parse from "html-react-parser";

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
  console.log("AutoResizingRichTextarea ignoring id value: ", id);

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

  const modules = {
    toolbar: [
      [{ header: "1" }, { header: "2" }, { font: [] }],
      [{ size: [] }],
      ["bold", "italic", "underline", "strike", "blockquote"],
      [
        { list: "ordered" },
        { list: "bullet" },
        { indent: "-1" },
        { indent: "+1" },
      ],
      ["link", "image"],
      ["clean"],
    ],
  };

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
          theme="snow"
          modules={modules}
        />
      )}
    </div>
  );
};

export default AutoResizingRichTextarea;
