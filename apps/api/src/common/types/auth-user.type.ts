export type AuthUser = {
  sub: string;
  tenantId: string;
  email: string;
  role?: 'owner' | 'admin' | 'staff';
  staffId?: string;
};
