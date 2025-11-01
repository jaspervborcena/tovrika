export enum UserRolesEnum {
  CREATOR = 'creator',
  STORE_MANAGER = 'store_manager',
  CASHIER = 'cashier',
  ADMIN = 'admin' // Tovrika admin - not shown in dropdown
}

export interface RoleOption {
  id: string;
  label: string;
  description: string;
}

export const ROLE_OPTIONS: RoleOption[] = [
  {
    id: UserRolesEnum.CREATOR,
    label: 'Business Owner',
    description: 'Full access to all business features and settings'
  },
  {
    id: UserRolesEnum.STORE_MANAGER,
    label: 'Store Manager',
    description: 'Manage stores, products, and view business operations'
  },
  {
    id: UserRolesEnum.CASHIER,
    label: 'Cashier',
    description: 'Access POS system and process transactions'
  }
];