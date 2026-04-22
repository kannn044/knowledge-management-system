import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ClipboardList,
  Search,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  User,
  Globe,
  Filter,
  X,
} from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { searchApi, AuditLog } from '@/services/searchApi';
import dayjs from 'dayjs';

// ─── Action badge colour map ──────────────────────────────────────

function actionColor(action: string): string {
  if (action.startsWith('user.approve') || action.startsWith('user.enable'))
    return 'bg-green-100 text-green-700';
  if (action.startsWith('user.reject') || action.startsWith('user.disable'))
    return 'bg-red-100 text-red-700';
  if (action.startsWith('user.change_role')) return 'bg-amber-100 text-amber-700';
  if (action.startsWith('document.search')) return 'bg-sky-100 text-sky-700';
  if (action.startsWith('document.delete')) return 'bg-red-100 text-red-700';
  if (action.startsWith('document.')) return 'bg-blue-100 text-blue-700';
  if (action.startsWith('auth.')) return 'bg-purple-100 text-purple-700';
  return 'bg-slate-100 text-slate-600';
}

function humanAction(action: string): string {
  return action
    .replace(/\./g, ' › ')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Detail cell ──────────────────────────────────────────────────

function DetailCell({ details }: { details: Record<string, unknown> | null }) {
  if (!details || Object.keys(details).length === 0) {
    return <span className="text-slate-300">—</span>;
  }
  const text = Object.entries(details)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join(', ');
  return (
    <span className="text-xs text-slate-500 truncate max-w-xs block" title={text}>
      {text}
    </span>
  );
}

// ─── Pagination controls ──────────────────────────────────────────

function Pagination({
  page,
  totalPages,
  onPrev,
  onNext,
}: {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-3 pt-4">
      <button
        onClick={onPrev}
        disabled={page === 1}
        className="btn btn-secondary p-2 disabled:opacity-40"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <span className="text-xs text-slate-500">
        Page <span className="font-semibold text-slate-700">{page}</span> of{' '}
        <span className="font-semibold text-slate-700">{totalPages}</span>
      </span>
      <button
        onClick={onNext}
        disabled={page === totalPages}
        className="btn btn-secondary p-2 disabled:opacity-40"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────

export default function AdminAuditPage() {
  const [page, setPage] = useState(1);
  const [searchUser, setSearchUser] = useState('');
  const [selectedAction, setSelectedAction] = useState('');
  const [selectedResource, setSelectedResource] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const LIMIT = 25;

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['audit-logs', page, selectedAction, selectedResource, searchUser, from, to],
    queryFn: () =>
      searchApi.getAuditLogs({
        page,
        limit: LIMIT,
        action: selectedAction || undefined,
        resourceType: selectedResource || undefined,
        userId: searchUser || undefined,
        from: from || undefined,
        to: to || undefined,
      }),
    staleTime: 30_000,
  });

  const { data: actionsData } = useQuery({
    queryKey: ['audit-log-actions'],
    queryFn: searchApi.getAuditLogActions,
    staleTime: 5 * 60_000,
  });

  const logs: AuditLog[] = data?.data ?? [];
  const meta = data?.meta;
  const totalPages = meta?.totalPages ?? 1;

  const activeFilterCount = [selectedAction, selectedResource, searchUser, from, to].filter(
    Boolean
  ).length;

  const clearFilters = () => {
    setSelectedAction('');
    setSelectedResource('');
    setSearchUser('');
    setFrom('');
    setTo('');
    setPage(1);
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary-50 rounded-xl flex items-center justify-center">
              <ClipboardList className="w-4 h-4 text-primary-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Audit Logs</h1>
              <p className="text-xs text-slate-500">
                {meta ? `${meta.total.toLocaleString()} events recorded` : 'Loading…'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              className="btn btn-secondary p-2"
              title="Refresh"
              disabled={isFetching}
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowFilters((f) => !f)}
              className={`btn btn-secondary flex items-center gap-1.5 ${
                activeFilterCount > 0 ? 'ring-2 ring-primary-400' : ''
              }`}
            >
              <Filter className="w-4 h-4" />
              Filters
              {activeFilterCount > 0 && (
                <span className="w-4 h-4 text-xs bg-primary-600 text-white rounded-full flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="card grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Action filter */}
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Action</label>
              <select
                className="input-field text-sm"
                value={selectedAction}
                onChange={(e) => {
                  setSelectedAction(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All actions</option>
                {(actionsData ?? []).map((a) => (
                  <option key={a} value={a}>
                    {humanAction(a)}
                  </option>
                ))}
              </select>
            </div>

            {/* Resource type filter */}
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Resource type</label>
              <select
                className="input-field text-sm"
                value={selectedResource}
                onChange={(e) => {
                  setSelectedResource(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All types</option>
                <option value="user">User</option>
                <option value="document">Document</option>
                <option value="search">Search</option>
              </select>
            </div>

            {/* Date range */}
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs font-medium text-slate-600 mb-1 block">From</label>
                <input
                  type="date"
                  className="input-field text-sm"
                  value={from}
                  onChange={(e) => {
                    setFrom(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
              <div className="flex-1">
                <label className="text-xs font-medium text-slate-600 mb-1 block">To</label>
                <input
                  type="date"
                  className="input-field text-sm"
                  value={to}
                  onChange={(e) => {
                    setTo(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
            </div>

            {activeFilterCount > 0 && (
              <div className="lg:col-span-3 flex justify-end">
                <button
                  onClick={clearFilters}
                  className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                >
                  <X className="w-3 h-3" /> Clear all filters
                </button>
              </div>
            )}
          </div>
        )}

        {/* Table */}
        <div className="card p-0 overflow-hidden">
          {isLoading ? (
            <div className="py-16 flex justify-center">
              <RefreshCw className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : logs.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-3 text-center">
              <ClipboardList className="w-8 h-8 text-slate-300" />
              <p className="text-sm text-slate-500">No audit logs found</p>
              {activeFilterCount > 0 && (
                <button onClick={clearFilters} className="text-xs text-primary-600 hover:underline">
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left text-xs font-medium text-slate-500 px-4 py-3">Timestamp</th>
                    <th className="text-left text-xs font-medium text-slate-500 px-4 py-3">User</th>
                    <th className="text-left text-xs font-medium text-slate-500 px-4 py-3">Action</th>
                    <th className="text-left text-xs font-medium text-slate-500 px-4 py-3 hidden lg:table-cell">
                      Resource
                    </th>
                    <th className="text-left text-xs font-medium text-slate-500 px-4 py-3 hidden xl:table-cell">
                      Details
                    </th>
                    <th className="text-left text-xs font-medium text-slate-500 px-4 py-3 hidden md:table-cell">
                      IP
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                      {/* Timestamp */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="text-xs font-medium text-slate-700">
                          {dayjs(log.createdAt).format('DD MMM YYYY')}
                        </p>
                        <p className="text-xs text-slate-400">{dayjs(log.createdAt).format('HH:mm:ss')}</p>
                      </td>

                      {/* User */}
                      <td className="px-4 py-3">
                        {log.user ? (
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                              <User className="w-3 h-3 text-primary-600" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-slate-700 truncate">
                                {log.user.firstName} {log.user.lastName}
                              </p>
                              <p className="text-xs text-slate-400 truncate">{log.user.email}</p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-300">System</span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${actionColor(
                            log.action
                          )}`}
                        >
                          {humanAction(log.action)}
                        </span>
                      </td>

                      {/* Resource */}
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {log.resourceType ? (
                          <div>
                            <p className="text-xs text-slate-600 capitalize">{log.resourceType}</p>
                            {log.resourceId && (
                              <p className="text-xs text-slate-400 font-mono truncate max-w-[120px]">
                                {log.resourceId.slice(0, 8)}…
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>

                      {/* Details */}
                      <td className="px-4 py-3 hidden xl:table-cell max-w-xs">
                        <DetailCell details={log.details} />
                      </td>

                      {/* IP */}
                      <td className="px-4 py-3 hidden md:table-cell">
                        {log.ipAddress ? (
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <Globe className="w-3 h-3 text-slate-300 shrink-0" />
                            {log.ipAddress}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!isLoading && logs.length > 0 && (
            <div className="px-4 pb-4">
              <Pagination
                page={page}
                totalPages={totalPages}
                onPrev={() => setPage((p) => Math.max(1, p - 1))}
                onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
              />
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
