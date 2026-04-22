import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { FileText, CheckCircle2, Loader2, AlertCircle, Search, ArrowRight } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import DocumentStatusBadge from '@/components/shared/DocumentStatusBadge';
import { documentApi } from '@/services/documentApi';
import { userApi } from '@/services/userApi';
import { useAuth } from '@/context/AuthContext';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DashboardPage() {
  const { user } = useAuth();

  const { data: docStats } = useQuery({
    queryKey: ['document-stats'],
    queryFn: documentApi.getStats,
    staleTime: 60_000,
  });

  const { data: userStats } = useQuery({
    queryKey: ['user-stats'],
    queryFn: userApi.getAdminStats,
    enabled: user?.role === 'admin',
    staleTime: 60_000,
  });

  const byStatus = Object.fromEntries(
    (docStats?.byStatus ?? []).map((s) => [s.status, s.count])
  );

  const statCards = [
    {
      label: 'Total Documents',
      value: docStats?.totalDocuments ?? '—',
      icon: FileText,
      color: 'text-blue-600 bg-blue-50',
      href: '/documents',
    },
    {
      label: 'Ready',
      value: byStatus['ready'] ?? '—',
      icon: CheckCircle2,
      color: 'text-green-600 bg-green-50',
      href: '/documents?status=ready',
    },
    {
      label: 'Processing',
      value: byStatus['processing'] ?? '—',
      icon: Loader2,
      color: 'text-amber-600 bg-amber-50',
      href: '/documents?status=processing',
    },
    {
      label: 'Failed',
      value: byStatus['failed'] ?? '—',
      icon: AlertCircle,
      color: 'text-red-600 bg-red-50',
      href: '/documents?status=failed',
    },
  ];

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Welcome */}
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Welcome back, {user?.firstName} 👋
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Here's what's happening in the knowledge base today.
          </p>
        </div>

        {/* Quick action */}
        <div className="card bg-gradient-to-r from-primary-600 to-primary-700 text-white border-0 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium opacity-90">Semantic Search</p>
            <p className="text-xs opacity-70 mt-0.5">
              Ask a natural-language question across all documents
            </p>
          </div>
          <Link to="/search" className="btn bg-white text-primary-700 hover:bg-primary-50 px-4 py-2 shrink-0">
            <Search className="w-4 h-4" />
            Search
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map(({ label, value, icon: Icon, color, href }) => (
            <Link key={label} to={href} className="card hover:shadow-card-hover transition-shadow flex items-start gap-3">
              <div className={`p-2 rounded-lg ${color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-slate-400">{label}</p>
                <p className="text-2xl font-bold text-slate-900">{value}</p>
              </div>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Recent uploads */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-900">Recent Documents</h2>
              <Link to="/documents" className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            {!docStats?.recentUploads?.length ? (
              <p className="text-xs text-slate-400 py-4 text-center">No documents yet</p>
            ) : (
              <div className="space-y-3">
                {docStats.recentUploads.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-3">
                    <div className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
                      <FileText className="w-3.5 h-3.5 text-slate-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-800 truncate">{doc.title}</p>
                      <p className="text-xs text-slate-400">{dayjs(doc.createdAt).fromNow()}</p>
                    </div>
                    <DocumentStatusBadge status={doc.status} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* File type breakdown */}
          <div className="card">
            <h2 className="text-sm font-semibold text-slate-900 mb-4">Document Types</h2>
            {!docStats?.byType?.length ? (
              <p className="text-xs text-slate-400 py-4 text-center">No documents yet</p>
            ) : (
              <div className="space-y-3">
                {docStats.byType.map(({ type, count }) => {
                  const pct = docStats.totalDocuments
                    ? Math.round((count / docStats.totalDocuments) * 100)
                    : 0;
                  const colors: Record<string, string> = {
                    pdf: 'bg-red-500',
                    txt: 'bg-blue-500',
                    md: 'bg-purple-500',
                  };
                  return (
                    <div key={type}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium text-slate-700 uppercase">{type}</span>
                        <span className="text-slate-400">{count} file{count !== 1 ? 's' : ''} ({pct}%)</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${colors[type] ?? 'bg-slate-400'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Admin: pending users badge */}
            {user?.role === 'admin' && userStats && userStats.pendingApproval > 0 && (
              <Link
                to="/admin/users"
                className="mt-4 flex items-center justify-between px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg"
              >
                <span className="text-xs font-medium text-amber-700">
                  {userStats.pendingApproval} user{userStats.pendingApproval > 1 ? 's' : ''} awaiting approval
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-amber-600" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
