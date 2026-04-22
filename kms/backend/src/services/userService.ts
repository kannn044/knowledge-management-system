import { prisma } from '../config/database';
import { emailService } from './emailService';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../config/logger';
import { UserRole, UserStatus } from '../types';

export interface UserListFilters {
  status?: UserStatus;
  role?: UserRole;
  search?: string;
  page?: number;
  limit?: number;
}

export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
  telephone?: string;
  department?: string;
  jobTitle?: string;
}

const USER_PUBLIC_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  telephone: true,
  department: true,
  jobTitle: true,
  status: true,
  emailVerified: true,
  avatarUrl: true,
  createdAt: true,
  updatedAt: true,
  role: { select: { name: true } },
};

export const userService = {
  // ── Get user profile ──────────────────────────────────────────
  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: USER_PUBLIC_SELECT,
    });
    if (!user) throw new AppError('User not found', 404);

    return this._formatUser(user);
  },

  // ── Update own profile ────────────────────────────────────────
  async updateProfile(userId: string, input: UpdateProfileInput) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        telephone: input.telephone,
        department: input.department,
        jobTitle: input.jobTitle,
      },
      select: USER_PUBLIC_SELECT,
    });

    return this._formatUser(user);
  },

  // ── List all users (admin) ────────────────────────────────────
  async listUsers(filters: UserListFilters = {}) {
    const { status, role, search, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (role) where.role = { name: role };
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { department: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        select: USER_PUBLIC_SELECT,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return {
      users: users.map((u) => this._formatUser(u)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  // ── List pending-approval users ───────────────────────────────
  async listPendingUsers() {
    const users = await prisma.user.findMany({
      where: { status: 'waiting' },
      select: USER_PUBLIC_SELECT,
      orderBy: { createdAt: 'asc' },
    });
    return users.map((u) => this._formatUser(u));
  },

  // ── Approve user ──────────────────────────────────────────────
  async approveUser(targetId: string, adminId: string) {
    const user = await prisma.user.findUnique({ where: { id: targetId } });
    if (!user) throw new AppError('User not found', 404);
    if (user.status !== 'waiting') {
      throw new AppError(`Cannot approve user with status: ${user.status}`, 400);
    }

    const updated = await prisma.user.update({
      where: { id: targetId },
      data: { status: 'active' },
      select: USER_PUBLIC_SELECT,
    });

    await emailService.sendApprovalEmail(
      user.email,
      `${user.firstName} ${user.lastName}`
    );

    logger.info(`User ${targetId} approved by admin ${adminId}`);
    return this._formatUser(updated);
  },

  // ── Reject user ───────────────────────────────────────────────
  async rejectUser(targetId: string, adminId: string) {
    const user = await prisma.user.findUnique({ where: { id: targetId } });
    if (!user) throw new AppError('User not found', 404);

    const updated = await prisma.user.update({
      where: { id: targetId },
      data: { status: 'disabled' },
      select: USER_PUBLIC_SELECT,
    });

    await emailService.sendRejectionEmail(
      user.email,
      `${user.firstName} ${user.lastName}`
    );

    logger.info(`User ${targetId} rejected by admin ${adminId}`);
    return this._formatUser(updated);
  },

  // ── Change user role ──────────────────────────────────────────
  async changeUserRole(targetId: string, roleName: UserRole, adminId: string) {
    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) throw new AppError('Invalid role', 400);

    const updated = await prisma.user.update({
      where: { id: targetId },
      data: { roleId: role.id },
      select: USER_PUBLIC_SELECT,
    });

    logger.info(`User ${targetId} role changed to ${roleName} by admin ${adminId}`);
    return this._formatUser(updated);
  },

  // ── Disable user ──────────────────────────────────────────────
  async disableUser(targetId: string, adminId: string) {
    if (targetId === adminId) throw new AppError('Cannot disable your own account', 400);

    const updated = await prisma.user.update({
      where: { id: targetId },
      data: { status: 'disabled' },
      select: USER_PUBLIC_SELECT,
    });

    logger.info(`User ${targetId} disabled by admin ${adminId}`);
    return this._formatUser(updated);
  },

  // ── Re-enable user ────────────────────────────────────────────
  async enableUser(targetId: string, adminId: string) {
    const updated = await prisma.user.update({
      where: { id: targetId },
      data: { status: 'active' },
      select: USER_PUBLIC_SELECT,
    });

    logger.info(`User ${targetId} re-enabled by admin ${adminId}`);
    return this._formatUser(updated);
  },

  // ── Get single user (admin) ───────────────────────────────────
  async getUserById(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: USER_PUBLIC_SELECT,
    });
    if (!user) throw new AppError('User not found', 404);
    return this._formatUser(user);
  },

  // ── Admin stats ───────────────────────────────────────────────
  async getAdminStats() {
    const [total, pending, active, disabled, byRole] = await prisma.$transaction([
      prisma.user.count(),
      prisma.user.count({ where: { status: 'waiting' } }),
      prisma.user.count({ where: { status: 'active' } }),
      prisma.user.count({ where: { status: 'disabled' } }),
      prisma.role.findMany({
        include: { _count: { select: { users: true } } },
      }),
    ]);

    return {
      totalUsers: total,
      pendingApproval: pending,
      activeUsers: active,
      disabledUsers: disabled,
      byRole: byRole.map((r) => ({ role: r.name, count: r._count.users })),
    };
  },

  // ─── Format helper ───────────────────────────────────────────
  _formatUser(user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    telephone: string | null;
    department: string | null;
    jobTitle: string | null;
    status: string;
    emailVerified: boolean;
    avatarUrl: string | null;
    createdAt: Date;
    updatedAt: Date;
    role: { name: string };
  }) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      telephone: user.telephone,
      department: user.department,
      jobTitle: user.jobTitle,
      role: user.role.name as UserRole,
      status: user.status,
      emailVerified: user.emailVerified,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  },
};
