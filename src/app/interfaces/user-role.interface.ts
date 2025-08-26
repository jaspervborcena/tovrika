export interface UserRole {
  id?: string;
  userId: string;
  email: string;
  roleId: string;
  storeId: string;
  companyId: string;
  createdAt?: Date;
  updatedAt?: Date;
}
