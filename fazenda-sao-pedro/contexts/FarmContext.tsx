import React, { createContext, useContext, ReactNode, useMemo } from 'react';
import { AppUser, GainMetrics, DEPReport, ZootechnicalKPIs } from '../types';
import { useFirestoreOptimized } from '../hooks/useFirestoreOptimized';
import { useAdvancedFilters } from '../hooks/useAdvancedFilters';
import { useDashboardConfig } from '../hooks/useDashboardConfig';
import { useUserProfile } from '../hooks/useUserProfile';
import {
  AnimalMetricsService,
  AnimalDerivedData,
  AnimalIndices,
  createAnimalMetricsService,
} from '../services/animalMetricsService';
import { KPICalculationResult } from '../services/kpiCalculator';

// Tipos de Retorno dos Hooks
type FirestoreHook = ReturnType<typeof useFirestoreOptimized>;
type AdvancedFiltersHook = ReturnType<typeof useAdvancedFilters>;
type DashboardConfigHook = ReturnType<typeof useDashboardConfig>;
type UserProfileHook = ReturnType<typeof useUserProfile>;

// Tipo para métricas centralizadas
interface AnimalMetricsContext {
  // Serviço completo (para casos avançados)
  service: AnimalMetricsService | null;

  // Dados derivados por animal
  derivedData: Map<string, AnimalDerivedData>;

  // Índices para buscas rápidas
  indices: AnimalIndices | null;

  // KPIs do rebanho (calculados uma vez) - AGORA RETORNA RESULTADO COMPLETO
  kpiResult: KPICalculationResult | null;

  // KPIs apenas (atalho para kpiResult.kpis)
  kpis: ZootechnicalKPIs | null;

  // DEPs de todos os animais
  allDEPs: DEPReport[];

  // Helpers rápidos
  getGMD: (animalId: string) => GainMetrics | undefined;
  getDEP: (animalId: string) => DEPReport | undefined;
  getProgenyIds: (animalId: string) => string[];
  getSiblingIds: (animalId: string) => string[];
  isPregnant: (animalId: string) => boolean;
}

interface FarmContextType {
  firestore: FirestoreHook;
  filters: AdvancedFiltersHook;
  dashboardConfig: DashboardConfigHook;
  userProfile: UserProfileHook;
  // NOVO: Métricas centralizadas
  metrics: AnimalMetricsContext;
}

const FarmContext = createContext<FarmContextType | undefined>(undefined);

interface FarmProviderProps {
  children: ReactNode;
  user: AppUser;
}

export const FarmProvider: React.FC<FarmProviderProps> = ({ children, user }) => {
  // 1. Inicializa Firestore (Dados Base)
  const firestore = useFirestoreOptimized(user);

  // 2. NOVO: Calcula métricas centralizadas (usa animais e breeding seasons)
  const metricsData = useMemo(() => {
    const animals = firestore.state.animals;
    const breedingSeasons = firestore.state.breedingSeasons || [];

    if (animals.length === 0) {
      return {
        service: null,
        derivedData: new Map<string, AnimalDerivedData>(),
        indices: null,
        kpiResult: null,
        allDEPs: [] as DEPReport[],
      };
    }

    // Cria serviço e computa tudo de uma vez
    const service = createAnimalMetricsService(animals, breedingSeasons);

    return {
      service,
      derivedData: service.getAllDerivedData(),
      indices: service.getIndices(),
      kpiResult: service.calculateKPIs(), // Agora retorna KPICalculationResult completo
      allDEPs: service.getAllDEPs(),
    };
  }, [firestore.state.animals, firestore.state.breedingSeasons]);

  // 3. Helpers rápidos para acessar métricas
  const metrics: AnimalMetricsContext = useMemo(() => {
    const { service, derivedData, indices, kpiResult, allDEPs } = metricsData;

    return {
      service,
      derivedData,
      indices,
      kpiResult,
      kpis: kpiResult?.kpis || null, // Atalho para acesso rápido
      allDEPs,

      getGMD: (animalId: string) => derivedData.get(animalId)?.gmd,

      getDEP: (animalId: string) => derivedData.get(animalId)?.dep,

      getProgenyIds: (animalId: string) => derivedData.get(animalId)?.progenyIds || [],

      getSiblingIds: (animalId: string) => derivedData.get(animalId)?.siblingIds || [],

      isPregnant: (animalId: string) => derivedData.get(animalId)?.reproductiveData?.isPregnant || false,
    };
  }, [metricsData]);

  // 4. Inicializa Filtros (Depende dos dados do Firestore e métricas)
  const filters = useAdvancedFilters({
    animals: firestore.state.animals,
    areas: firestore.state.managementAreas,
    // NOVO: Passa métricas pré-calculadas
    preCalculatedMetrics: metrics.derivedData,
  });

  // 5. Inicializa Configurações de Dashboard
  const dashboardConfig = useDashboardConfig();

  // 6. Inicializa Perfil do Usuário
  const userProfile = useUserProfile(user);

  // Memoização do valor do contexto para evitar re-renders desnecessários
  const value = useMemo(
    () => ({
      firestore,
      filters,
      dashboardConfig,
      userProfile,
      metrics,
    }),
    [firestore, filters, dashboardConfig, userProfile, metrics]
  );

  return <FarmContext.Provider value={value}>{children}</FarmContext.Provider>;
};

export const useFarmData = (): FarmContextType => {
  const context = useContext(FarmContext);
  if (context === undefined) {
    throw new Error('useFarmData must be used within a FarmProvider');
  }
  return context;
};

// NOVO: Hook específico para métricas (mais leve que useFarmData completo)
export const useAnimalMetrics = () => {
  const { metrics } = useFarmData();
  return metrics;
};

// NOVO: Hook para obter dados derivados de um animal específico
export const useAnimalDerivedData = (animalId: string): AnimalDerivedData | undefined => {
  const { metrics } = useFarmData();
  return metrics.derivedData.get(animalId);
};
