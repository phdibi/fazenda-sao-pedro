import React, { createContext, useContext, ReactNode } from 'react';
import { AppUser } from '../types';
import { useFirestoreOptimized } from '../hooks/useFirestoreOptimized';
import { useAdvancedFilters } from '../hooks/useAdvancedFilters';
import { useDashboardConfig } from '../hooks/useDashboardConfig';
import { useUserProfile } from '../hooks/useUserProfile';

// Tipos de Retorno dos Hooks
type FirestoreHook = ReturnType<typeof useFirestoreOptimized>;
type AdvancedFiltersHook = ReturnType<typeof useAdvancedFilters>;
type DashboardConfigHook = ReturnType<typeof useDashboardConfig>;
type UserProfileHook = ReturnType<typeof useUserProfile>;

interface FarmContextType {
    firestore: FirestoreHook;
    filters: AdvancedFiltersHook;
    dashboardConfig: DashboardConfigHook;
    userProfile: UserProfileHook;
}

const FarmContext = createContext<FarmContextType | undefined>(undefined);

interface FarmProviderProps {
    children: ReactNode;
    user: AppUser;
}

export const FarmProvider: React.FC<FarmProviderProps> = ({ children, user }) => {
    // 1. Inicializa Firestore (Dados Base)
    const firestore = useFirestoreOptimized(user);

    // 2. Inicializa Filtros (Depende dos dados do Firestore)
    const filters = useAdvancedFilters({
        animals: firestore.state.animals,
        areas: firestore.state.managementAreas,
    });

    // 3. Inicializa Configurações de Dashboard
    const dashboardConfig = useDashboardConfig();

    // 4. Inicializa Perfil do Usuário
    const userProfile = useUserProfile(user);

    const value = {
        firestore,
        filters,
        dashboardConfig,
        userProfile,
    };

    return (
        <FarmContext.Provider value={value}>
            {children}
        </FarmContext.Provider>
    );
};

export const useFarmData = (): FarmContextType => {
    const context = useContext(FarmContext);
    if (context === undefined) {
        throw new Error('useFarmData must be used within a FarmProvider');
    }
    return context;
};
