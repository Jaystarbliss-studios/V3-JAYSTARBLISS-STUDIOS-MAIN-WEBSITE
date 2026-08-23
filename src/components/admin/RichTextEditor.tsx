import React from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
}

const modules = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['link', 'blockquote', 'code-block'],
    ['clean'],
  ],
};

const formats = [
  'header',
  'bold', 'italic', 'underline', 'strike',
  'list',
  'link', 'blockquote', 'code-block',
];

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder,
  className = '',
  minHeight = '180px',
}) => {
  return (
    <div className={`rich-text-editor-wrapper bg-white text-slate-900 rounded-xl overflow-hidden ${className}`}>
      <ReactQuill
        theme="snow"
        value={value || ''}
        onChange={onChange}
        placeholder={placeholder || 'Write your content here...'}
        modules={modules}
        formats={formats}
        style={{ minHeight }}
      />
    </div>
  );
};

export default RichTextEditor;
