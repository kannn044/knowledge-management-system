import api from './api';
import { User, UserRole, ApiResponse } from '@/types';

export interface UserListResponse {
  success: boolean;
  users: User[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface AdminStats {
  totalUsers: number;
  pendingApproval: number;
  activeUsers: number;
  disabledUsers: number;
  byRole: { role: string; count: number }[];
}

export const userApi = {
  getProfile: async (): Promise<User> => {
    const res = await api.get<ApiResponse<User>>('/users/profile');
    return res.data.data!;
  },

  updateProfile: async (data: Partial<User>): Promise<User> => {
    const res = await api.put<ApiResponse<User>>('/users/profile', data);
    return res.data.data!;
  },

  listUsers: async (params?: {
    status?: string;
    role?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<UserListResponse> => {
    const res = await api.get('/users', { params });
    return res.data;
  },

  listPendingUsers: async (): Promise<User[]> => {
    const res = await api.get<ApiResponse<User[]>>('/users/pending');
    return res.data.data ?? [];
  },

  getAdminStats: async (): Promise<AdminStats> => {
    const res = await api.get<ApiResponse<AdminStats>>('/users/stats');
    return res.data.data!;
  },

  approveUser: async (userId: string): Promise<User> => {
    const res = await api.patch<ApiResponse<User>>(`/users/${userId}/approve`);
    return res.data.data!;
  },

  rejectUser: async (userId: string): Promise<User> => {
    const res = await api.patch<ApiResponse<User>>(`/users/${userId}/reject`);
    return res.data.data!;
  },

  changeRole: async (userId: string, role: UserRole): Promise<User> => {
    const res = await api.patch<ApiResponse<User>>(`/users/${userId}/role`, { role });
    return res.data.data!;
  },

  disableUser: async (userId: string): Promise<User> => {
    const res = await api.patch<ApiResponse<User>>(`/users/${userId}/disable`);
    return res.data.data!;
  },

  enableUser: async (userId: string): Promise<User> => {
    const res = await api.patch<ApiResponse<User>>(`/users/${userId}/enable`);
    return res.data.data!;
  },
};
