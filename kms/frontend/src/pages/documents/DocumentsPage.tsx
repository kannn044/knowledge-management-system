import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import {
  Upload, Search, Trash2, Eye, RefreshCw,
  FileText, File, Filter, AlertTriangle
} from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import DocumentStatusBadge from '@/components/shared/DocumentStatusBadge';
import UploadModal from '@/components/shared/UploadModal';
import DocumentViewerModal from '@/components/shared/DocumentViewerModal';
import { documentApi } from '@/services/documentApi';
import { Document, DocStatus, FileType } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { clsx } from 'clsx';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

// ─── Helpers ─────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileTypeIcon({ type }: { type: FileType }) {
  if (type === 'pdf') return <File className="w-4 h-4 text-red-500 shrink-0" />;
  return <FileText className="w-4 h-4 text-blue-500 shrink-0" />;
}

// ─── Delete confirmation dialog ──────────────────────────────────

function DeleteConfirmDialog({
  doc,
  onConfirm,
  onCancel,
  isLoading,
}: {
  doc: Document;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 z-10">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 text-sm">Delete Document</h3>
            <p className="text-xs text-slate-500 mt-0.5">This action cannot be undone</p>
          </div>
        </div>
        <p className="text-sm text-slate-600 mb-5">
          Are you sure you want to delete <strong>"{doc.title}"</strong>?
          The file and all its search vectors will be permanently removed.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={isLoading} className="btn-secondary flex-1">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={isLoading} className="btn-danger flex-1">
            {isLoading ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Document row card ────────────────────────────────────────────

function DocumentCard({
  doc,
  canDelete,
  onView,
  onDelete,
}: {
  doc: Document;
  canDelete: boolean;
  onView: (d: Document) => void;
  onDelete: (d: Document) => void;
}) {
  return (
    <div className="card hover:shadow-card-hover transition-shadow group">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
          <FileTypeIcon type={doc.fileType} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">{doc.title}</p>
              <p className="text-xs text-slate-400 truncate mt-0.5">{doc.fileName}</p>
            </div>
            <DocumentStatusBadge status={doc.status} />
          </div>

          {doc.description && (
            <p className="text-xs text-slate-500 mt-1.5 line-clamp-2">{doc.description}</p>
          )}

          <div className="flex items-center gap-3 mt-2.5 flex-wrap">
            <span className="text-xs text-slate-400">{formatBytes(doc.fileSize)}</span>
            {doc.chunkCount > 0 && (
              <span className="text-xs text-slate-400">• {doc.chunkCount} chunks</span>
            )}
            <span className="text-xs text-slate-400">
              • {doc.uploadedBy.firstName} {doc.uploadedBy.lastName}
            </span>
            {doc.uploadedBy.department && (
              <span className="text-xs text-slate-400">• {doc.uploadedBy.department}</span>
            )}
            <span className="text-xs text-slate-400">• {dayjs(doc.createdAt).fromNow()}</span>
          </div>

          {doc.status === 'failed' && doc.errorMessage && (
            <p className="text-xs text-red-500 mt-1.5 bg-red-50 rounded px-2 py-1">
              ⚠ {doc.errorMessage}
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
        <button
          onClick={() => onView(doc)}
          className="btn-ghost flex-1 text-xs gap-1.5"
          title="View content"
        >
          <Eye className="w-3.5 h-3.5" /> View
        </button>
        {canDelete && (
          <button
            onClick={() => onDelete(doc)}
            className="btn-ghost text-xs gap-1.5 text-red-500 hover:bg-red-50"
            title="Delete document"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────

export default function DocumentsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [showUpload, setShowUpload] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<Document | null>(null);
  const [deletingDoc, setDeletingDoc] = useState<Document | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<DocStatus | ''>('');
  const [typeFilter, setTypeFilter] = useState<FileType | ''>('');
  const [mineOnly, setMineOnly] = useState(false);
  const [page, setPage] = useState(1);

  const canUpload = user?.role === 'staff' || user?.role === 'admin';

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['documents', { search, statusFilter, typeFilter, mineOnly, page }],
    queryFn: () =>
      documentApi.list({
        search: search || undefined,
        status: statusFilter || undefined,
        file_type: typeFilter || undefined,
        mine: mineOnly || undefined,
        page,
        limit: 12,
      }),
    placeholderData: (prev) => prev,
    // Auto-refetch while any doc is processing
    refetchInterval: (query) => {
      const docs = query.state.data?.documents ?? [];
      const hasProcessing = docs.some(
        (d) => d.status === 'processing' || d.status === 'uploaded'
      );
      return hasProcessing ? 5000 : false;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => documentApi.delete(id),
    onSuccess: () => {
      toast.success('Document deleted');
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['document-stats'] });
      setDeletingDoc(null);
    },
    onError: () => {
      toast.error('Failed to delete document');
      setDeletingDoc(null);
    },
  });

  const statusFilters: { value: DocStatus | ''; label: string }[] = [
    { value: '', label: 'All' },
    { value: 'ready', label: 'Ready' },
    { value: 'processing', label: 'Processing' },
    { value: 'uploaded', label: 'Queued' },
    { value: 'failed', label: 'Failed' },
  ];

  const typeFilters: { value: FileType | ''; label: string }[] = [
    { value: '', label: 'All types' },
    { value: 'pdf', label: 'PDF' },
    { value: 'txt', label: 'TXT' },
    { value: 'md', label: 'Markdown' },
  ];

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-slate-900">Documents</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              className="btn-ghost text-slate-500 p-2"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            {canUpload && (
              <button
                onClick={() => setShowUpload(true)}
                className="btn-primary text-sm"
              >
                <Upload className="w-4 h-4" />
                Upload
              </button>
            )}
          </div>
        </div>

        {/* Filters bar */}
        <div className="card py-3 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="search"
              placeholder="Search documents…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="input pl-9"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />

            {/* Status filters */}
            {statusFilters.map(({ value, label }) => (
              <button
                key={value || 'all-status'}
                onClick={() => { setStatusFilter(value as DocStatus | ''); setPage(1); }}
                className={clsx(
                  'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                  statusFilter === value
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                )}
              >
                {label}
              </button>
            ))}

            <span className="w-px h-4 bg-slate-200" />

            {/* Type filters */}
            {typeFilters.map(({ value, label }) => (
              <button
                key={value || 'all-type'}
                onClick={() => { setTypeFilter(value as FileType | ''); setPage(1); }}
                className={clsx(
                  'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                  typeFilter === value
                    ? 'bg-slate-800 text-white border-slate-800'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                )}
              >
                {label}
              </button>
            ))}

            <span className="w-px h-4 bg-slate-200" />

            <button
              onClick={() => { setMineOnly(!mineOnly); setPage(1); }}
              className={clsx(
                'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                mineOnly
                  ? 'bg-purple-600 text-white border-purple-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              )}
            >
              My uploads
            </button>
          </div>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card h-40 animate-pulse bg-slate-100" />
            ))}
          </div>
        ) : data?.documents.length === 0 ? (
          <div className="card flex flex-col items-center gap-3 py-20 text-center">
            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
              <FileText className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-slate-500 text-sm">No documents found</p>
            {canUpload && (
              <button onClick={() => setShowUpload(true)} className="btn-primary text-sm mt-1">
                <Upload className="w-4 h-4" /> Upload your first document
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data?.documents.map((doc) => (
              <DocumentCard
                key={doc.id}
                doc={doc}
                canDelete={
                  doc.uploadedBy.id === user?.id || user?.role === 'admin'
                }
                onView={setViewingDoc}
                onDelete={setDeletingDoc}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {data?.meta && data.meta.totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              {data.meta.total} document{data.meta.total !== 1 ? 's' : ''}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40"
              >
                Previous
              </button>
              <span className="flex items-center text-xs text-slate-500 px-2">
                {page} / {data.meta.totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(data.meta.totalPages, p + 1))}
                disabled={page === data.meta.totalPages}
                className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showUpload && <UploadModal onClose={() => setShowUpload(false)} />}
      {viewingDoc && (
        <DocumentViewerModal document={viewingDoc} onClose={() => setViewingDoc(null)} />
      )}
      {deletingDoc && (
        <DeleteConfirmDialog
          doc={deletingDoc}
          onConfirm={() => deleteMutation.mutate(deletingDoc.id)}
          onCancel={() => setDeletingDoc(null)}
          isLoading={deleteMutation.isPending}
        />
      )}
    </AppLayout>
  );
}
