import { Request, Response, NextFunction } from 'express';
import { userService } from '../services/userService';
import { AuthenticatedRequest, UserRole } from '../types';

export const userController = {
  // GET /api/users/profile
  async getProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await userService.getProfile(req.user!.id);
      res.json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  },

  // PUT /api/users/profile
  async updateProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await userService.updateProfile(req.user!.id, req.body);
      res.json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  },

  // GET /api/users (admin)
  async listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, role, search, page, limit } = req.query as Record<string, string>;
      const result = await userService.listUsers({
        status: status as any,
        role: role as UserRole,
        search,
        page: page ? parseInt(page) : undefined,
        limit: limit ? parseInt(limit) : undefined,
      });
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  },

  // GET /api/users/pending (admin)
  async listPendingUsers(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const users = await userService.listPendingUsers();
      res.json({ success: true, data: users });
    } catch (error) {
      next(error);
    }
  },

  // GET /api/users/stats (admin)
  async getStats(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await userService.getAdminStats();
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  },

  // GET /api/users/:id (admin)
  async getUserById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await userService.getUserById(req.params.id);
      res.json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  },

  // PATCH /api/users/:id/approve (admin)
  async approveUser(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await userService.approveUser(req.params.id, req.user!.id);
      res.json({ success: true, data: user, message: 'User approved successfully' });
    } catch (error) {
      next(error);
    }
  },

  // PATCH /api/users/:id/reject (admin)
  async rejectUser(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await userService.rejectUser(req.params.id, req.user!.id);
      res.json({ success: true, data: user, message: 'User rejected' });
    } catch (error) {
      next(error);
    }
  },

  // PATCH /api/users/:id/role (admin)
  async changeRole(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await userService.changeUserRole(
        req.params.id,
        req.body.role as UserRole,
        req.user!.id
      );
      res.json({ success: true, data: user, message: 'Role updated' });
    } catch (error) {
      next(error);
    }
  },

  // PATCH /api/users/:id/disable (admin)
  async disableUser(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await userService.disableUser(req.params.id, req.user!.id);
      res.json({ success: true, data: user, message: 'User disabled' });
    } catch (error) {
      next(error);
    }
  },

  // PATCH /api/users/:id/enable (admin)
  async enableUser(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await userService.enableUser(req.params.id, req.user!.id);
      res.json({ success: true, data: user, message: 'User re-enabled' });
    } catch (error) {
      next(error);
    }
  },
};
