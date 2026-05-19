export type UserRole = 'admin' | 'member';

export interface User {
  id: string;
  organizationId: string;
  email: string | null;
  phoneNumber: string;
  role: UserRole;
  createdAt: string;
}
