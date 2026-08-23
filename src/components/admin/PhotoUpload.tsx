import React, { useState, useRef } from 'react';
import { Upload, X, Loader2, CheckCircle2, Image as ImageIcon, ExternalLink, Trash2 } from 'lucide-react';
import { uploadImageToCloudinary } from '../../lib/cloudinary';

interface PhotoUploadProps {
  label?: string;
  value: string;
  onChange: (url: string) => void;
  folder?: string;
  helpText?: string;
  required?: boolean;
  aspectRatio?: string;
}

export const PhotoUpload: React.FC<PhotoUploadProps> = ({
  label = 'Upload Photo',
  value,
  onChange,
  helpText = 'PNG, JPG, WEBP up to 10MB. Uploads directly to Cloudinary CDN.',
  required = false,
  aspectRatio = 'aspect-video'
}) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (PNG, JPG, WEBP, etc.)');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('Photo size exceeds 10MB limit.');
      return;
    }

    setError(null);
    setUploading(true);

    try {
      const result = await uploadImageToCloudinary(file);
      onChange(result.secureUrl || result.url);
    } catch (err: any) {
      console.error('Cloudinary upload failed:', err);
      setError(err.message || 'Failed to upload photo to Cloudinary. Check settings or network.');
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
          {label} {required && <span className="text-brand-red">*</span>}
        </label>
        {value && (
          <span className="text-[11px] font-medium text-green-600 dark:text-green-400 flex items-center gap-1">
            <CheckCircle2 size={12} /> Photo Attached
          </span>
        )}
      </div>

      {error && (
        <div className="p-2.5 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-lg text-xs font-medium border border-red-200 dark:border-red-800">
          {error}
        </div>
      )}

      {/* Main Upload / Preview Area */}
      {value ? (
        <div className="relative rounded-xl overflow-hidden border-2 border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 group">
          <div className={`${aspectRatio} w-full max-h-72 overflow-hidden flex items-center justify-center bg-slate-950/20`}>
            <img 
              src={value} 
              alt="Uploaded photo" 
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              referrerPolicy="no-referrer"
            />
          </div>

          {/* Action Overlay */}
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 p-4">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-2 bg-white text-gray-900 text-xs font-bold rounded-lg shadow-lg hover:bg-gray-100 transition-all flex items-center gap-1.5"
            >
              <Upload size={14} /> Change Photo
            </button>
            <a
              href={value}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 bg-white/20 hover:bg-white/40 text-white rounded-lg backdrop-blur-sm transition-all"
              title="Open photo in new tab"
            >
              <ExternalLink size={16} />
            </a>
            <button
              type="button"
              onClick={handleRemove}
              className="px-3.5 py-2 bg-red-600 text-white text-xs font-bold rounded-lg shadow-lg hover:bg-red-700 transition-all flex items-center gap-1.5"
            >
              <Trash2 size={14} /> Delete Photo
            </button>
          </div>

          <div className="p-2.5 border-t border-gray-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 flex items-center justify-between text-xs">
            <span className="font-mono text-gray-500 truncate max-w-[280px]">{value}</span>
            <button
              type="button"
              onClick={handleRemove}
              className="text-red-500 hover:text-red-700 font-bold text-xs flex items-center gap-1 shrink-0 ml-2"
            >
              <X size={13} /> Remove
            </button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
            isDragging 
              ? 'border-brand-red bg-brand-red/5 dark:bg-brand-red/10' 
              : 'border-gray-300 dark:border-slate-700 hover:border-brand-red dark:hover:border-brand-red bg-gray-50/50 dark:bg-slate-900/50'
          }`}
        >
          {uploading ? (
            <div className="py-4 flex flex-col items-center justify-center">
              <Loader2 className="animate-spin text-brand-red h-8 w-8 mb-2" />
              <p className="text-sm font-bold text-gray-800 dark:text-gray-200">Uploading photo to Cloudinary...</p>
              <p className="text-xs text-gray-400 mt-1">Optimizing and storing on Cloud CDN</p>
            </div>
          ) : (
            <div className="py-3 flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-brand-red/10 text-brand-red flex items-center justify-center mb-3">
                <Upload size={22} />
              </div>
              <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
                Click to Upload Photo or Drag and Drop
              </p>
              <p className="text-xs text-gray-400 mt-1 max-w-sm">
                {helpText}
              </p>
              <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-brand-red text-white text-xs font-bold rounded-lg shadow-sm">
                <ImageIcon size={13} /> Select Photo
              </div>
            </div>
          )}
        </div>
      )}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Manual URL input toggle fallback */}
      {!value && !uploading && (
        <div className="pt-1 flex items-center gap-2">
          <input
            type="url"
            placeholder="Or paste an image URL directly..."
            className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                const target = e.target as HTMLInputElement;
                if (target.value.trim()) onChange(target.value.trim());
              }
            }}
            onBlur={(e) => {
              if (e.target.value.trim()) onChange(e.target.value.trim());
            }}
          />
        </div>
      )}
    </div>
  );
};

export default PhotoUpload;
