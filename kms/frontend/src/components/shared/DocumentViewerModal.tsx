import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Loader2, FileText, File, Copy, Check } from 'lucide-react';
import { documentApi } from '@/services/documentApi';
import { Document } from '@/types';
import DocumentStatusBadge from './DocumentStatusBadge';
import dayjs from 'dayjs';

interface DocumentViewerModalProps {
  document: Document;
  onClose: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentViewerModal({ document: doc, onClose }: DocumentViewerModalProps) {
  const [copied, setCopied] = useState(false);

  const { data: content, isLoading, error } = useQuery({
    queryKey: ['document-content', doc.id],
    queryFn: () => documentApi.getContent(doc.id),
    enabled: doc.status === 'ready',
    staleTime: Infinity,
  });

  const handleCopy = () => {
    if (content) {
      navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const fileIcon =
    doc.fileType === 'pdf'
      ? <File className="w-5 h-5 text-red-500" />
      : <FileText className="w-5 h-5 text-blue-500" />;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col z-10">
        {/* Header */}
        <div className="flex items-start gap-3 px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="mt-0.5">{fileIcon}</div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-slate-900 truncate">{doc.title}</h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <DocumentStatusBadge status={doc.status} />
              <span className="text-xs text-slate-400">{doc.fileName}</span>
              <span className="text-xs text-slate-400">•</span>
              <span className="text-xs text-slate-400">{formatBytes(doc.fileSize)}</span>
              {doc.chunkCount > 0 && (
                <>
                  <span className="text-xs text-slate-400">•</span>
                  <span className="text-xs text-slate-400">{doc.chunkCount} chunks</span>
                </>
              )}
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5 shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Metadata strip */}
        <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center gap-4 text-xs text-slate-500 shrink-0">
          <span>By {doc.uploadedBy.firstName} {doc.uploadedBy.lastName}</span>
          {doc.uploadedBy.department && <span>• {doc.uploadedBy.department}</span>}
          <span>• {dayjs(doc.createdAt).format('DD MMM YYYY')}</span>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {doc.status !== 'ready' ? (
            <div className="flex flex-col items-center justify-center h-full py-16 text-center px-6">
              <DocumentStatusBadge status={doc.status} />
              <p className="text-sm text-slate-500 mt-3">
                {doc.status === 'processing'
                  ? 'Document is still being processed. Please check back shortly.'
                  : doc.status === 'failed'
                  ? `Processing failed: ${doc.errorMessage ?? 'Unknown error'}`
                  : 'Document has been uploaded and is queued for processing.'}
              </p>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center h-full py-16">
              <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full py-16 text-sm text-red-500">
              Failed to load content
            </div>
          ) : (
            <div className="relative">
              <button
                onClick={handleCopy}
                className="absolute top-3 right-3 btn-ghost py-1.5 px-2.5 text-xs z-10"
                title="Copy text"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <pre className="p-5 text-xs text-slate-700 whitespace-pre-wrap font-mono leading-relaxed">
                {content}
              </pre>
            </div>
          )}
        </div>

        {doc.description && (
          <div className="px-5 py-3 border-t border-slate-100 shrink-0">
            <p className="text-xs text-slate-500">{doc.description}</p>
          </div>
        )}
      </div>
    </div>
  );
}
