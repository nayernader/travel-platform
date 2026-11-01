export enum UserStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended', // ACC-15, ACC-16: admin suspended, cannot log in
  DEACTIVATED = 'deactivated', // ACC-12: the user deactivated their own account
} 