import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Loader2, Upload } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { documentApi } from '@/services/documentApi';
import FileDropzone from './FileDropzone';
import { useAuth } from '@/context/AuthContext';

const schema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters').max(255),
  description: z.string().max(1000).optional(),
});
type FormData = z.infer<typeof schema>;

interface UploadModalProps {
  onClose: () => void;
}

export default function UploadModal({ onClose }: UploadModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  // Only staff and admin can upload
  if (user?.role === 'viewer') {
    return (
      <ModalShell onClose={onClose}>
        <div className="text-center py-8">
          <p className="text-slate-500 text-sm">Only staff and admin users can upload documents.</p>
        </div>
      </ModalShell>
    );
  }

  const mutation = useMutation({
    mutationFn: ({ data, f }: { data: FormData; f: File }) =>
      documentApi.upload(f, data.title, data.description, setUploadProgress),
    onSuccess: () => {
      toast.success('Document uploaded and queued for processing');
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['document-stats'] });
      onClose();
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message
        ?? 'Upload failed';
      toast.error(msg);
      setUploadProgress(0);
    },
  });

  const onSubmit = (data: FormData) => {
    if (!file) { toast.warn('Please select a file first'); return; }
    mutation.mutate({ data, f: file });
  };

  return (
    <ModalShell onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FileDropzone onFileSelected={setFile} disabled={mutation.isPending} />

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            {...register('title')}
            type="text"
            placeholder="e.g. VPN Setup Guide Q1 2026"
            className="input"
            disabled={mutation.isPending}
          />
          {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Description <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <textarea
            {...register('description')}
            rows={3}
            placeholder="Brief description of the document contents..."
            className="input resize-none"
            disabled={mutation.isPending}
          />
        </div>

        {/* Upload progress bar */}
        {mutation.isPending && uploadProgress > 0 && (
          <div>
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>Uploading…</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5">
              <div
                className="bg-primary-600 h-1.5 rounded-full transition-all duration-200"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={mutation.isPending}
            className="btn-secondary flex-1"
          >
            Cancel
          </button>
          <button type="submit" disabled={mutation.isPending || !file} className="btn-primary flex-1">
            {mutation.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</>
            ) : (
              <><Upload className="w-4 h-4" /> Upload</>
            )}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function ModalShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 z-10">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-slate-900">Upload Document</h2>
          <button onClick={onClose} className="btn-ghost p-1.5">
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
