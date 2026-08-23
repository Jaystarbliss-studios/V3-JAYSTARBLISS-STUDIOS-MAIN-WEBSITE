import React, { useState, useRef } from 'react';
import { UploadCloud, Image as ImageIcon, Check, Loader2, X, Link as LinkIcon } from 'lucide-react';
import { uploadImageToCloudinary } from '../../lib/cloudinary';

interface CloudinaryImageUploadProps {
  value?: string;
  onChange: (url: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  helpText?: string;
}

export const CloudinaryImageUpload: React.FC<CloudinaryImageUploadProps> = ({
  value = '',
  onChange,
  label = 'Image (Cloudinary / URL)',
  placeholder = 'https://res.cloudinary.com/... or paste image URL',
  className = '',
  helpText
}) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (PNG, JPG, WebP, SVG).');
      return;
    }

    try {
      setUploading(true);
      setError(null);
      const result = await uploadImageToCloudinary(file);
      onChange(result.secureUrl || result.url);
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Upload failed. You can paste a direct Cloudinary link below or configure Cloud Name in Admin Settings.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleCopy = () => {
    if (value) {
      navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <div className="flex items-center justify-between">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            {label}
          </label>
          {value && (
            <button
              type="button"
              onClick={handleCopy}
              className="text-[11px] font-semibold text-brand-red hover:underline flex items-center gap-1"
            >
              {copied ? <Check size={12} /> : <LinkIcon size={12} />}
              {copied ? 'Copied' : 'Copy Link'}
            </button>
          )}
        </div>
      )}

      {/* Input row */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-red font-mono"
          />
          {value && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              title="Clear Image URL"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
          id={`cloudinary-upload-${label.replace(/\s+/g, '-').toLowerCase()}`}
        />

        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className="px-3.5 py-2.5 bg-brand-slate dark:bg-slate-700 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors disabled:opacity-50"
          title="Upload image directly to Cloudinary"
        >
          {uploading ? (
            <>
              <Loader2 size={14} className="animate-spin text-brand-red" />
              <span>Uploading...</span>
            </>
          ) : (
            <>
              <UploadCloud size={14} />
              <span>Upload</span>
            </>
          )}
        </button>
      </div>

      {helpText && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          {helpText}
        </p>
      )}

      {error && (
        <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs">
          {error}
        </div>
      )}

      {/* Live Preview */}
      {value && (
        <div className="relative mt-2 p-2 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="w-16 h-16 rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-800 shrink-0 border border-slate-300 dark:border-slate-700 flex items-center justify-center">
            <img
              src={value}
              alt="Preview"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/logo.png';
              }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate flex items-center gap-1">
              <ImageIcon size={13} className="text-brand-red" />
              <span>Active Image Asset</span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate mt-0.5">
              {value}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CloudinaryImageUpload;
