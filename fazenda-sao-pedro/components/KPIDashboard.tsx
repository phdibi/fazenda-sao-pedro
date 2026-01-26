import React, { useMemo, useState } from 'react';
import { Animal, ZootechnicalKPIs, DEFAULT_KPI_TARGETS, BreedingSeason } from '../types';
import {
  calculateZootechnicalKPIs,
  evaluateAllKPIs,
  KPIEvaluation,
  KPIStatus,
} from '../services/kpiCalculator';
import { useFarmData } from '../contexts/FarmContext';
import FIVMigrationModal from './FIVMigrationModal';
import { WrenchScrewdriverIcon } from './common/Icons';

interface KPIDashboardProps {
  animals: Animal[];
  // Opcional: permite passar KPIs pré-calculados
  preCalculatedKPIs?: ZootechnicalKPIs;
  // Callback para atualizar animais (usado na migração FIV)
  onUpdateAnimal?: (animalId: string, updates: Partial<Animal>) => void;
}

// ============================================
// COMPONENTE: KPI Card
// ============================================

const statusColors: Record<KPIStatus, { bg: string; border: string; text: string; icon: string }> = {
  excellent: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500',
    text: 'text-emerald-400',
    icon: '🏆',
  },
  good: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500',
    text: 'text-blue-400',
    icon: '✅',
  },
  warning: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500',
    text: 'text-amber-400',
    icon: '⚠️',
  },
  critical: {
    bg: 'bg-red-500/10',
    border: 'border-red-500',
    text: 'text-red-400',
    icon: '🚨',
  },
};

const KPICard: React.FC<{ evaluation: KPIEvaluation }> = ({ evaluation }) => {
  const colors = statusColors[evaluation.status];
  const target = evaluation.target;

  // Calcula o progresso em relação ao target
  const lowerIsBetter = ['mortalityRate', 'calvingInterval', 'avgFirstCalvingAge'].includes(evaluation.metric);
  const progressValue = lowerIsBetter
    ? Math.max(0, Math.min(100, (target.target / evaluation.value) * 100))
    : Math.max(0, Math.min(100, (evaluation.value / target.excellent) * 100));

  return (
    <div className={`rounded-xl p-4 ${colors.bg} border-l-4 ${colors.border}`}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className="text-sm font-medium text-gray-300">{target.description}</h3>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-white">
              {evaluation.value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
            </span>
            <span className="text-sm text-gray-400">{target.unit}</span>
          </div>
        </div>
        <span className="text-2xl">{colors.icon}</span>
      </div>

      {/* Barra de progresso */}
      <div className="mt-3">
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>Meta: {target.target}{target.unit}</span>
          <span className={colors.text}>
            {evaluation.deviation > 0 ? '+' : ''}{evaluation.deviation}%
          </span>
        </div>
        <div className="h-2 bg-base-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              evaluation.status === 'excellent'
                ? 'bg-emerald-500'
                : evaluation.status === 'good'
                ? 'bg-blue-500'
                : evaluation.status === 'warning'
                ? 'bg-amber-500'
                : 'bg-red-500'
            }`}
            style={{ width: `${Math.min(100, progressValue)}%` }}
          />
        </div>
      </div>

      {/* Limites */}
      <div className="flex justify-between text-[10px] text-gray-500 mt-1">
        <span>Mín: {target.minAcceptable}</span>
        <span>Excelente: {target.excellent}</span>
      </div>
    </div>
  );
};

// ============================================
// COMPONENTE: Resumo de Status
// ============================================

const StatusSummary: React.FC<{ evaluations: KPIEvaluation[] }> = ({ evaluations }) => {
  const counts = useMemo(() => {
    return {
      excellent: evaluations.filter((e) => e.status === 'excellent').length,
      good: evaluations.filter((e) => e.status === 'good').length,
      warning: evaluations.filter((e) => e.status === 'warning').length,
      critical: evaluations.filter((e) => e.status === 'critical').length,
    };
  }, [evaluations]);

  return (
    <div className="grid grid-cols-4 gap-3 mb-6">
      <div className="bg-emerald-500/10 rounded-lg p-3 text-center">
        <div className="text-2xl font-bold text-emerald-400">{counts.excellent}</div>
        <div className="text-xs text-gray-400">Excelentes</div>
      </div>
      <div className="bg-blue-500/10 rounded-lg p-3 text-center">
        <div className="text-2xl font-bold text-blue-400">{counts.good}</div>
        <div className="text-xs text-gray-400">Bons</div>
      </div>
      <div className="bg-amber-500/10 rounded-lg p-3 text-center">
        <div className="text-2xl font-bold text-amber-400">{counts.warning}</div>
        <div className="text-xs text-gray-400">Atenção</div>
      </div>
      <div className="bg-red-500/10 rounded-lg p-3 text-center">
        <div className="text-2xl font-bold text-red-400">{counts.critical}</div>
        <div className="text-xs text-gray-400">Críticos</div>
      </div>
    </div>
  );
};

// ============================================
// COMPONENTE: Detalhes do Rebanho
// ============================================

const HerdDetails: React.FC<{
  details: {
    totalAnimals: number;
    totalFemales: number;
    totalMales: number;
    totalActive: number;
    totalDeaths: number;
    totalSold: number;
    calvesWeaned: number;
    exposedCows: number;
    pregnantCows: number;
    births: number;
  };
}> = ({ details }) => (
  <div className="bg-base-800 rounded-xl p-4 mb-6">
    <h3 className="text-lg font-semibold text-white mb-4">Composição do Rebanho</h3>
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
      <div className="text-center">
        <div className="text-xl font-bold text-white">{details.totalAnimals}</div>
        <div className="text-xs text-gray-400">Total</div>
      </div>
      <div className="text-center">
        <div className="text-xl font-bold text-pink-400">{details.totalFemales}</div>
        <div className="text-xs text-gray-400">Fêmeas</div>
      </div>
      <div className="text-center">
        <div className="text-xl font-bold text-blue-400">{details.totalMales}</div>
        <div className="text-xs text-gray-400">Machos</div>
      </div>
      <div className="text-center">
        <div className="text-xl font-bold text-emerald-400">{details.totalActive}</div>
        <div className="text-xs text-gray-400">Ativos</div>
      </div>
      <div className="text-center">
        <div className="text-xl font-bold text-amber-400">{details.exposedCows}</div>
        <div className="text-xs text-gray-400">Vacas Expostas</div>
      </div>
      <div className="text-center">
        <div className="text-xl font-bold text-purple-400">{details.pregnantCows}</div>
        <div className="text-xs text-gray-400">Prenhes</div>
      </div>
      <div className="text-center">
        <div className="text-xl font-bold text-cyan-400">{details.calvesWeaned}</div>
        <div className="text-xs text-gray-400">Desmamados</div>
      </div>
      <div className="text-center">
        <div className="text-xl font-bold text-green-400">{details.births}</div>
        <div className="text-xs text-gray-400">Nasc. (12m)</div>
      </div>
      <div className="text-center">
        <div className="text-xl font-bold text-orange-400">{details.totalSold}</div>
        <div className="text-xs text-gray-400">Vendidos</div>
      </div>
      <div className="text-center">
        <div className="text-xl font-bold text-red-400">{details.totalDeaths}</div>
        <div className="text-xs text-gray-400">Óbitos</div>
      </div>
    </div>
  </div>
);

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

const KPIDashboard: React.FC<KPIDashboardProps> = ({ animals, preCalculatedKPIs, onUpdateAnimal }) => {
  // Modal de migração FIV
  const [isFIVModalOpen, setIsFIVModalOpen] = useState(false);

  // Conta animais FIV para exibir badge
  const fivCount = useMemo(() => animals.filter(a => a.isFIV).length, [animals]);

  // Tenta usar métricas centralizadas do contexto
  const farmContext = useFarmData();
  const breedingSeasons = farmContext?.firestore?.state?.breedingSeasons || [];

  // Usa KPIs pré-calculados se disponíveis (do contexto ou props)
  const result = useMemo(() => {
    // Se KPIs foram passados via props, usa diretamente (fallback mínimo)
    if (preCalculatedKPIs) {
      return {
        kpis: preCalculatedKPIs,
        details: {
          totalAnimals: animals.length,
          totalFemales: 0,
          totalMales: 0,
          totalActive: 0,
          totalDeaths: 0,
          totalSold: 0,
          calvesWeaned: 0,
          exposedCows: 0,
          pregnantCows: 0,
          births: 0,
          pregnantFromBreedingSeason: 0,
          pregnantFromManualRecord: 0,
        },
        warnings: [],
        calculatedAt: new Date(),
      };
    }

    // PRIORIDADE: Tenta usar resultado COMPLETO do contexto centralizado
    const contextKPIResult = farmContext?.metrics?.kpiResult;
    if (contextKPIResult) {
      return contextKPIResult;
    }

    // Fallback: calcula localmente (com integração de breeding seasons)
    return calculateZootechnicalKPIs(animals, { breedingSeasons });
  }, [animals, preCalculatedKPIs, farmContext?.metrics?.kpiResult, breedingSeasons]);

  const evaluations = useMemo(() => evaluateAllKPIs(result.kpis), [result.kpis]);

  // Agrupa KPIs por categoria
  const categories = useMemo(() => {
    const reproduction = ['weaningRate', 'pregnancyRate', 'birthRate', 'calvingInterval', 'avgFirstCalvingAge'];
    const weight = ['avgBirthWeight', 'avgWeaningWeight', 'avgYearlingWeight', 'avgGMD', 'kgCalfPerCowYear'];
    const general = ['mortalityRate'];

    return {
      reproduction: evaluations.filter((e) => reproduction.includes(e.metric)),
      weight: evaluations.filter((e) => weight.includes(e.metric)),
      general: evaluations.filter((e) => general.includes(e.metric)),
    };
  }, [evaluations]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">KPIs Zootécnicos</h2>
          <p className="text-sm text-gray-400">
            Indicadores de desempenho do rebanho • Atualizado em{' '}
            {result.calculatedAt.toLocaleString('pt-BR')}
          </p>
        </div>
        {/* Botão de Ferramentas FIV */}
        {onUpdateAnimal && fivCount > 0 && (
          <button
            onClick={() => setIsFIVModalOpen(true)}
            className="flex items-center gap-2 bg-purple-700 hover:bg-purple-600 text-white text-sm font-medium py-2 px-3 rounded-lg transition-colors"
            title="Corrigir genealogia de animais FIV"
          >
            <WrenchScrewdriverIcon className="w-4 h-4" />
            Correção FIV
            <span className="bg-purple-500 text-xs px-1.5 py-0.5 rounded-full">{fivCount}</span>
          </button>
        )}
      </div>

      {/* Modal de Migração FIV */}
      {onUpdateAnimal && (
        <FIVMigrationModal
          isOpen={isFIVModalOpen}
          onClose={() => setIsFIVModalOpen(false)}
          animals={animals}
          onUpdateAnimal={onUpdateAnimal}
        />
      )}

      {/* Alertas */}
      {result.warnings.length > 0 && (
        <div className="bg-amber-900/20 border border-amber-700/50 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <span className="text-amber-400">⚠️</span>
            <div>
              <p className="text-sm font-medium text-amber-300">Avisos sobre os dados</p>
              <ul className="text-xs text-amber-200/80 mt-1 list-disc list-inside">
                {result.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Resumo de Status */}
      <StatusSummary evaluations={evaluations} />

      {/* Detalhes do Rebanho */}
      <HerdDetails details={result.details} />

      {/* KPIs de Reprodução */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <span>🐄</span> Reprodução
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.reproduction.map((evaluation) => (
            <KPICard key={evaluation.metric} evaluation={evaluation} />
          ))}
        </div>
      </div>

      {/* KPIs de Peso e Desempenho */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <span>⚖️</span> Peso e Desempenho
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.weight.map((evaluation) => (
            <KPICard key={evaluation.metric} evaluation={evaluation} />
          ))}
        </div>
      </div>

      {/* KPIs Gerais */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <span>📊</span> Indicadores Gerais
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.general.map((evaluation) => (
            <KPICard key={evaluation.metric} evaluation={evaluation} />
          ))}
        </div>
      </div>

      {/* Legenda */}
      <div className="bg-base-800 rounded-lg p-4 mt-6">
        <h4 className="text-sm font-medium text-gray-300 mb-2">Legenda</h4>
        <div className="flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-1">
            <span>🏆</span>
            <span className="text-emerald-400">Excelente</span>
            <span className="text-gray-500">- Acima da meta</span>
          </div>
          <div className="flex items-center gap-1">
            <span>✅</span>
            <span className="text-blue-400">Bom</span>
            <span className="text-gray-500">- Dentro da meta</span>
          </div>
          <div className="flex items-center gap-1">
            <span>⚠️</span>
            <span className="text-amber-400">Atenção</span>
            <span className="text-gray-500">- Abaixo da meta</span>
          </div>
          <div className="flex items-center gap-1">
            <span>🚨</span>
            <span className="text-red-400">Crítico</span>
            <span className="text-gray-500">- Precisa de ação</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KPIDashboard;
