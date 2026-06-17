import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { db, users, subscriptions, eq } from '@studyai/database';
import { UserRole, AuthProvider, Locale, SubscriptionTier } from '@studyai/types';

@Injectable()
export class UsersService {
  async findById(id: string) {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (result.length === 0) {
      throw new NotFoundException('User not found');
    }
    return result[0];
  }

  async findByEmail(email: string) {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result.length > 0 ? result[0] : null;
  }

  async create(data: {
    email: string;
    passwordHash?: string | null;
    firstName: string;
    lastName: string;
    role?: UserRole;
    authProvider?: AuthProvider;
    providerId?: string | null;
    avatarUrl?: string | null;
    emailVerified?: boolean;
    verificationToken?: string | null;
    locale?: Locale;
  }) {
    const existing = await this.findByEmail(data.email);
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
    const isSuperAdmin = superAdminEmail && data.email.toLowerCase() === superAdminEmail.toLowerCase();
    const assignedRole = isSuperAdmin ? UserRole.ADMIN : (data.role || UserRole.STUDENT);

    const result = await db
      .insert(users)
      .values({
        email: data.email.toLowerCase(),
        passwordHash: data.passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        role: assignedRole,
        authProvider: data.authProvider || AuthProvider.EMAIL,
        providerId: data.providerId,
        avatarUrl: data.avatarUrl,
        emailVerified: data.emailVerified || false,
        verificationToken: data.verificationToken,
        locale: data.locale || Locale.EN,
      })
      .returning();

    const user = result[0];

    // Create default free subscription
    await this.createDefaultSubscription(user.id);

    return user;
  }

  async createDefaultSubscription(userId: string) {
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    await db.insert(subscriptions).values({
      userId,
      plan: 'free',
      status: 'active',
      monthlyFileLimit: 5,
      monthlyQuestionLimit: 100,
      filesUsedThisMonth: 0,
      questionsUsedThisMonth: 0,
      currentPeriodStart: new Date(),
      currentPeriodEnd: periodEnd,
    });
  }


  async update(id: string, data: { firstName?: string; lastName?: string; avatarUrl?: string; role?: UserRole }) {
    const result = await db
      .update(users)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();

    if (result.length === 0) {
      throw new NotFoundException('User not found');
    }
    return result[0];
  }

  async updatePassword(id: string, passwordHash: string) {
    await db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, id));
  }

  async updateRefreshTokenHash(id: string, refreshTokenHash: string | null) {
    await db
      .update(users)
      .set({ refreshTokenHash, updatedAt: new Date() })
      .where(eq(users.id, id));
  }

  async updateLocale(id: string, locale: Locale) {

    await db
      .update(users)
      .set({ locale, updatedAt: new Date() })
      .where(eq(users.id, id));
  }

  async delete(id: string) {
    await db.delete(users).where(eq(users.id, id));
  }

  async verifyEmail(id: string) {
    await db
      .update(users)
      .set({ emailVerified: true, verificationToken: null, updatedAt: new Date() })
      .where(eq(users.id, id));
  }

  async findByVerificationToken(token: string) {
    const result = await db.select().from(users).where(eq(users.verificationToken, token)).limit(1);
    return result.length > 0 ? result[0] : null;
  }

  async findByResetToken(token: string) {
    const result = await db.select().from(users).where(eq(users.resetToken, token)).limit(1);
    return result.length > 0 ? result[0] : null;
  }

  async saveResetToken(id: string, token: string, expires: Date) {
    await db
      .update(users)
      .set({ resetToken: token, resetTokenExpires: expires, updatedAt: new Date() })
      .where(eq(users.id, id));
  }

  async clearResetToken(id: string) {
    await db
      .update(users)
      .set({ resetToken: null, resetTokenExpires: null, updatedAt: new Date() })
      .where(eq(users.id, id));
  }
}
