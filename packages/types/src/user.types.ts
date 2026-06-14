export enum UserRole {
  STUDENT = 'student',
  TEACHER = 'teacher',
  PARENT = 'parent',
  ADMIN = 'admin',
}

export enum AuthProvider {
  EMAIL = 'email',
  GOOGLE = 'google',
  APPLE = 'apple',
}

export enum Locale {
  AR = 'ar',
  EN = 'en',
}

export enum SubscriptionTier {
  FREE = 'free',
  PRO = 'pro',
  INSTITUTION = 'institution',
}

export interface User {
  id: string;
  email: string;
  passwordHash?: string | null;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  role: UserRole;
  authProvider: AuthProvider;
  providerId?: string | null;
  emailVerified: boolean;
  locale: Locale;
  subscriptionTier: SubscriptionTier;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfileResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  role: UserRole;
  locale: Locale;
  subscriptionTier: SubscriptionTier;
  emailVerified: boolean;
  createdAt: Date;
}
