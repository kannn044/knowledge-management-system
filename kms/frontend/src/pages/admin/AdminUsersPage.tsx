import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import {
  CheckCircle, XCircle, UserX, UserCheck, Search,
  Users, Clock, ShieldCheck, Ban, ChevronDown, RefreshCw
} from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { userApi } from '@/services/userApi';
import { User, UserRole, UserStatus } from '@/types';
import { clsx } from 'clsx';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

// ─── Status Badge ────────────────────────────────────────────────

const statusConfig: Record<UserStatus, { label: string; cls: string }> = {
  active: { label: 'Active', cls: 'badge-success' },
  waiting: { label: 'Pending', cls: 'badge-warning' },
  pending: { label: 'Unverified', cls: 'badge-neutral' },
  disabled: { label: 'Disabled', cls: 'badge-danger' },
};

const roleConfig: Record<UserRole, { label: string; cls: string }> = {
  admin: { label: 'Admin', cls: 'badge-info' },
  staff: { label: 'Staff', cls: 'badge bg-purple-100 text-purple-700' },
  viewer: { label: 'Viewer', cls: 'badge-neutral' },
};

// ─── Role Selector ────────────────────────────────────────────────

function RoleSelector({ user, onChangeRole }: { user: User; onChangeRole: (id: string, role: UserRole) => void }) {
  const [open, setOpen] = useState(false);
  const roles: UserRole[] = ['admin', 'staff', 'viewer'];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors"
      >
        <span className={roleConfig[user.role].cls}>{roleConfig[user.role].label}</span>
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-7 z-20 w-32 bg-white border border-slate-200 rounded-lg shadow-lg py-1 overflow-hidden">
            {roles.map((role) => (
              <button
                key={role}
                onClick={() => { onChangeRole(user.id, role); setOpen(false); }}
                className={clsx(
                  'w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 transition-colors capitalize',
                  user.role === role ? 'font-semibold text-primary-600' : 'text-slate-700'
                )}
              >
                {role}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── User Row ────────────────────────────────────────────────────

function UserRow({
  user,
  onApprove,
  onReject,
  onDisable,
  onEnable,
  onChangeRole,
  isLoading,
}: {
  user: User;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onDisable: (id: string) => void;
  onEnable: (id: string) => void;
  onChangeRole: (id: string, role: UserRole) => void;
  isLoading: boolean;
}) {
  return (
    <tr className="hover:bg-slate-50 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <span className="text-xs font-semibold text-primary-700">
                {user.firstName[0]}{user.lastName[0]}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-xs text-slate-400 truncate">{user.email}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-slate-500 hidden sm:table-cell">
        {user.department ?? '—'}
      </td>
      <td className="px-4 py-3">
        <span className={statusConfig[user.status].cls}>{statusConfig[user.status].label}</span>
      </td>
      <td className="px-4 py-3">
        <RoleSelector user={user} onChangeRole={onChangeRole} />
      </td>
      <td className="px-4 py-3 text-xs text-slate-400 hidden md:table-cell">
        {dayjs(user.createdAt).fromNow()}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 justify-end">
          {user.status === 'waiting' && (
            <>
              <button
                onClick={() => onApprove(user.id)}
                disabled={isLoading}
                title="Approve"
                className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" />
              </button>
              <button
                onClick={() => onReject(user.id)}
                disabled={isLoading}
                title="Reject"
                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </>
          )}
          {user.status === 'active' && (
            <button
              onClick={() => onDisable(user.id)}
              disabled={isLoading}
              title="Disable"
              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
            >
              <UserX className="w-4 h-4" />
            </button>
          )}
          {user.status === 'disabled' && (
            <button
              onClick={() => onEnable(user.id)}
              disabled={isLoading}
              title="Re-enable"
              className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
            >
              <UserCheck className="w-4 h-4" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Main Page ────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['users', { search, status: statusFilter, page }],
    queryFn: () => userApi.listUsers({ search: search || undefined, status: statusFilter || undefined, page, limit: 20 }),
    placeholderData: (prev) => prev,
  });

  const { data: stats } = useQuery({
    queryKey: ['user-stats'],
    queryFn: userApi.getAdminStats,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['users'] });
    queryClient.invalidateQueries({ queryKey: ['user-stats'] });
  };

  const approveMutation = useMutation({
    mutationFn: userApi.approveUser,
    onSuccess: () => { toast.success('User approved and notified'); invalidate(); },
    onError: () => toast.error('Failed to approve user'),
  });

  const rejectMutation = useMutation({
    mutationFn: userApi.rejectUser,
    onSuccess: () => { toast.success('User rejected'); invalidate(); },
    onError: () => toast.error('Failed to reject user'),
  });

  const disableMutation = useMutation({
    mutationFn: userApi.disableUser,
    onSuccess: () => { toast.success('User disabled'); invalidate(); },
    onError: () => toast.error('Failed to disable user'),
  });

  const enableMutation = useMutation({
    mutationFn: userApi.enableUser,
    onSuccess: () => { toast.success('User re-enabled'); invalidate(); },
    onError: () => toast.error('Failed to enable user'),
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: UserRole }) => userApi.changeRole(id, role),
    onSuccess: () => { toast.success('Role updated'); invalidate(); },
    onError: () => toast.error('Failed to update role'),
  });

  const isMutating =
    approveMutation.isPending || rejectMutation.isPending ||
    disableMutation.isPending || enableMutation.isPending || roleMutation.isPending;

  const statusFilters = [
    { value: '', label: 'All Users' },
    { value: 'waiting', label: 'Pending Approval' },
    { value: 'active', label: 'Active' },
    { value: 'disabled', label: 'Disabled' },
    { value: 'pending', label: 'Unverified' },
  ];

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-5">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-slate-900">User Management</h1>
          <button
            onClick={() => refetch()}
            className="btn-ghost text-slate-500"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Stats cards */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'text-blue-600 bg-blue-50' },
              { label: 'Pending Approval', value: stats.pendingApproval, icon: Clock, color: 'text-amber-600 bg-amber-50' },
              { label: 'Active', value: stats.activeUsers, icon: ShieldCheck, color: 'text-green-600 bg-green-50' },
              { label: 'Disabled', value: stats.disabledUsers, icon: Ban, color: 'text-red-600 bg-red-50' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="card flex items-center gap-3 py-3">
                <div className={`p-2 rounded-lg ${color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">{label}</p>
                  <p className="text-xl font-bold text-slate-900">{value}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="card py-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="search"
                placeholder="Search by name, email, department..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="input pl-9"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {statusFilters.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => { setStatusFilter(value); setPage(1); }}
                  className={clsx(
                    'btn text-xs px-3 py-1.5 rounded-lg border transition-colors',
                    statusFilter === value
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  )}
                >
                  {label}
                  {value === 'waiting' && stats?.pendingApproval ? (
                    <span className="ml-1 bg-amber-500 text-white text-xs rounded-full w-4 h-4 inline-flex items-center justify-center">
                      {stats.pendingApproval}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Users table */}
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">User</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide hidden sm:table-cell">Department</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide hidden md:table-cell">Joined</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={6} className="px-4 py-3">
                        <div className="h-8 bg-slate-100 rounded animate-pulse" />
                      </td>
                    </tr>
                  ))
                ) : data?.users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-slate-400 text-sm">
                      No users found matching your filters.
                    </td>
                  </tr>
                ) : (
                  data?.users.map((user) => (
                    <UserRow
                      key={user.id}
                      user={user}
                      onApprove={(id) => approveMutation.mutate(id)}
                      onReject={(id) => rejectMutation.mutate(id)}
                      onDisable={(id) => disableMutation.mutate(id)}
                      onEnable={(id) => enableMutation.mutate(id)}
                      onChangeRole={(id, role) => roleMutation.mutate({ id, role })}
                      isLoading={isMutating}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data?.meta && data.meta.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
              <p className="text-xs text-slate-500">
                Showing {((page - 1) * 20) + 1}–{Math.min(page * 20, data.meta.total)} of {data.meta.total} users
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(p => Math.min(data.meta.totalPages, p + 1))}
                  disabled={page === data.meta.totalPages}
                  className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
