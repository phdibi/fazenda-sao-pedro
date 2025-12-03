import { useState, useCallback, useEffect } from 'react';
import { UserRole, UserPermissions, DEFAULT_PERMISSIONS, AppUser, UserProfile } from '../types';

const ROLE_STORAGE_KEY = 'user_role';

export const useUserProfile = (user: AppUser | null) => {
  const [role, setRole] = useState<UserRole>(UserRole.Proprietario);
  const [permissions, setPermissions] = useState<UserPermissions>(DEFAULT_PERMISSIONS[UserRole.Proprietario]);

  // Carrega role do localStorage
  useEffect(() => {
    if (!user?.uid) return;
    
    const stored = localStorage.getItem(`${ROLE_STORAGE_KEY}_${user.uid}`);
    if (stored && Object.values(UserRole).includes(stored as UserRole)) {
      const storedRole = stored as UserRole;
      setRole(storedRole);
      setPermissions(DEFAULT_PERMISSIONS[storedRole]);
    }
  }, [user?.uid]);

  const changeRole = useCallback((newRole: UserRole) => {
    if (!user?.uid) return;
    
    setRole(newRole);
    setPermissions(DEFAULT_PERMISSIONS[newRole]);
    localStorage.setItem(`${ROLE_STORAGE_KEY}_${user.uid}`, newRole);
  }, [user?.uid]);

  const getUserProfile = useCallback((): UserProfile | null => {
    if (!user) return null;
    return {
      ...user,
      role,
      permissions,
    };
  }, [user, role, permissions]);

  const canAccess = useCallback((permission: keyof UserPermissions): boolean => {
    return permissions[permission];
  }, [permissions]);

  const isCapataz = role === UserRole.Capataz;
  const isProprietario = role === UserRole.Proprietario;
  const isVeterinario = role === UserRole.Veterinario;
  const isFuncionario = role === UserRole.Funcionario;

  return {
    role,
    permissions,
    changeRole,
    getUserProfile,
    canAccess,
    isCapataz,
    isProprietario,
    isVeterinario,
    isFuncionario,
  };
};
