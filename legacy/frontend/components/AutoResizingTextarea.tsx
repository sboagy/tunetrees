import { useEffect, useRef } from "react";
import { Textarea } from "./ui/textarea";

interface IAutoResizingTextareaProps {
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  className?: string;
  readOnly?: boolean;
  style?: React.CSSProperties;
}

const AutoResizingTextarea: React.FC<IAutoResizingTextareaProps> = ({
  id,
  value,
  onChange,
  placeholder,
  className,
  readOnly,
  style,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, []);

  return (
    <Textarea
      id={id}
      ref={textareaRef}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
      style={{ ...style, overflow: "hidden", resize: "vertical" }}
      readOnly={readOnly}
    />
  );
};

export default AutoResizingTextarea;
