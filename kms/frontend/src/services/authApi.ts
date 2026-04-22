import api from './api';
import { User, LoginCredentials, RegisterData } from '@/types';

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<{ accessToken: string; user: User }> => {
    const res = await api.post('/auth/login', credentials);
    return res.data.data;
  },

  register: async (data: RegisterData): Promise<{ message: string }> => {
    const res = await api.post('/auth/register', data);
    return res.data;
  },

  logout: async (): Promise<void> => {
    await api.post('/auth/logout');
  },

  getProfile: async (): Promise<User> => {
    const res = await api.get('/users/profile');
    return res.data.data;
  },

  verifyEmail: async (token: string): Promise<{ message: string }> => {
    const res = await api.get(`/auth/verify-email/${token}`);
    return res.data;
  },

  forgotPassword: async (email: string): Promise<{ message: string }> => {
    const res = await api.post('/auth/forgot-password', { email });
    return res.data;
  },

  changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
    await api.post('/auth/change-password', { currentPassword, newPassword });
  },
};
