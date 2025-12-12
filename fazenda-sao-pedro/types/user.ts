// ============================================
// TIPOS DE USUÁRIO E PERMISSÕES
// ============================================

export interface AppUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

export enum UserRole {
  Proprietario = 'proprietario',
  Capataz = 'capataz',
  Veterinario = 'veterinario',
  Funcionario = 'funcionario',
}

export interface UserPermissions {
  canViewAnimals: boolean;
  canEditAnimals: boolean;
  canDeleteAnimals: boolean;
  canViewFinancial: boolean;
  canEditFinancial: boolean;
  canViewReports: boolean;
  canManageUsers: boolean;
  canViewCalendar: boolean;
  canEditCalendar: boolean;
  canViewTasks: boolean;
  canEditTasks: boolean;
}

export interface UserProfile extends AppUser {
  role: UserRole;
  permissions: UserPermissions;
}

export const DEFAULT_PERMISSIONS: Record<UserRole, UserPermissions> = {
  [UserRole.Proprietario]: {
    canViewAnimals: true,
    canEditAnimals: true,
    canDeleteAnimals: true,
    canViewFinancial: true,
    canEditFinancial: true,
    canViewReports: true,
    canManageUsers: true,
    canViewCalendar: true,
    canEditCalendar: true,
    canViewTasks: true,
    canEditTasks: true,
  },
  [UserRole.Capataz]: {
    canViewAnimals: false,
    canEditAnimals: false,
    canDeleteAnimals: false,
    canViewFinancial: false,
    canEditFinancial: false,
    canViewReports: false,
    canManageUsers: false,
    canViewCalendar: true,
    canEditCalendar: true,
    canViewTasks: true,
    canEditTasks: true,
  },
  [UserRole.Veterinario]: {
    canViewAnimals: true,
    canEditAnimals: true,
    canDeleteAnimals: false,
    canViewFinancial: false,
    canEditFinancial: false,
    canViewReports: true,
    canManageUsers: false,
    canViewCalendar: true,
    canEditCalendar: true,
    canViewTasks: true,
    canEditTasks: true,
  },
  [UserRole.Funcionario]: {
    canViewAnimals: true,
    canEditAnimals: false,
    canDeleteAnimals: false,
    canViewFinancial: false,
    canEditFinancial: false,
    canViewReports: false,
    canManageUsers: false,
    canViewCalendar: true,
    canEditCalendar: false,
    canViewTasks: true,
    canEditTasks: false,
  },
};
