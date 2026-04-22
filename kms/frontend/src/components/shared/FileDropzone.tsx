import { useCallback, useState } from 'react';
import { Upload, FileText, File, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';

const ACCEPTED_TYPES: Record<string, string> = {
  'text/plain': '.txt',
  'text/markdown': '.md',
  'text/x-markdown': '.md',
  'application/pdf': '.pdf',
};
const ACCEPTED_EXT = ['.txt', '.md', '.pdf'];
const MAX_MB = 50;

interface FileDropzoneProps {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
}

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return <File className="w-5 h-5 text-red-500" />;
  return <FileText className="w-5 h-5 text-blue-500" />;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileDropzone({ onFileSelected, disabled }: FileDropzoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const validate = (file: File): string | null => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    const mimeOk = !!ACCEPTED_TYPES[file.type];
    const extOk = ACCEPTED_EXT.includes(ext);
    if (!mimeOk && !extOk)
      return `File type not supported. Accepted: .txt, .md, .pdf`;
    if (file.size > MAX_MB * 1024 * 1024)
      return `File exceeds ${MAX_MB} MB limit`;
    return null;
  };

  const handleFile = useCallback(
    (file: File) => {
      const err = validate(file);
      if (err) { setError(err); setSelectedFile(null); return; }
      setError(null);
      setSelectedFile(file);
      onFileSelected(file);
    },
    [onFileSelected]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (disabled) return;
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile, disabled]
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-2">
      <label
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={clsx(
          'flex flex-col items-center justify-center gap-3 w-full rounded-xl border-2 border-dashed',
          'px-6 py-10 cursor-pointer transition-all duration-150',
          disabled
            ? 'opacity-50 cursor-not-allowed bg-slate-50 border-slate-200'
            : dragOver
            ? 'border-primary-500 bg-primary-50 scale-[1.01]'
            : selectedFile
            ? 'border-green-400 bg-green-50'
            : 'border-slate-300 bg-slate-50 hover:border-primary-400 hover:bg-primary-50'
        )}
      >
        {selectedFile ? (
          <>
            {getFileIcon(selectedFile.name)}
            <div className="text-center">
              <p className="text-sm font-medium text-slate-800 truncate max-w-[240px]">
                {selectedFile.name}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">{formatBytes(selectedFile.size)}</p>
            </div>
            <span className="text-xs text-green-600 font-medium">✓ Ready to upload — click to change</span>
          </>
        ) : (
          <>
            <div className={clsx(
              'w-10 h-10 rounded-xl flex items-center justify-center',
              dragOver ? 'bg-primary-100' : 'bg-white border border-slate-200'
            )}>
              <Upload className={clsx('w-5 h-5', dragOver ? 'text-primary-600' : 'text-slate-400')} />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-slate-700">
                {dragOver ? 'Drop to upload' : 'Drag & drop or click to browse'}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                .txt, .md, .pdf — max {MAX_MB} MB
              </p>
            </div>
          </>
        )}
        <input
          type="file"
          className="sr-only"
          accept=".txt,.md,.pdf,text/plain,text/markdown,application/pdf"
          onChange={onInputChange}
          disabled={disabled}
        />
      </label>

      {error && (
        <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}
