import React, { useState, useMemo, useCallback } from 'react';
import {
  Animal,
  BreedingSeason,
  BreedingSeasonStatus,
  CoverageType,
  CoverageRecord,
  RepasseBull,
  BullSwitchConfig,
} from '../types';
import {
  calculateBreedingMetrics,
  getEligibleCows,
  getAvailableBulls,
  getExpectedCalvings,
  getRepasseEligibleCows,
  getPendingPaternityRecords,
  getRepasseBulls,
  hasPendingPaternity,
  getCoverageBulls,
  hasPendingCoveragePaternity,
  getRegisteredAbortions,
  verifyCalvings,
  getEmptyCows,
  detectLateBirthAlerts,
} from '../services/breedingSeasonService';
import {
  exportBreedingSeasonToCSV,
  exportBreedingSeasonToPDF,
} from '../utils/fileUtils';
import {
  StatusBadge,
  MetricCard,
  SeasonForm,
  CoverageForm,
  ExposedCowsManager,
  CoverageCard,
  formatDate,
  toInputDate,
  typeLabels,
} from './breeding';

// ============================================
// PROPS
// ============================================

interface BreedingSeasonManagerProps {
  animals: Animal[];
  seasons: BreedingSeason[];
  onCreateSeason: (season: Omit<BreedingSeason, 'id'>) => Promise<BreedingSeason | undefined>;
  onUpdateSeason: (seasonId: string, data: Partial<BreedingSeason>) => Promise<void>;
  onDeleteSeason: (seasonId: string) => Promise<void>;
  onAddCoverage: (
    seasonId: string,
    coverage: Omit<CoverageRecord, 'id' | 'expectedCalvingDate'>
  ) => Promise<CoverageRecord | undefined>;
  onUpdateDiagnosis: (
    seasonId: string,
    coverageId: string,
    result: 'positive' | 'negative',
    checkDate: Date
  ) => Promise<void>;
  onUpdateCoverage: (
    seasonId: string,
    coverageId: string,
    data: Partial<CoverageRecord>
  ) => Promise<void>;
  onDeleteCoverage: (seasonId: string, coverageId: string) => Promise<void>;
  onConfirmPaternity: (
    seasonId: string,
    coverageId: string,
    confirmedBullId: string,
    confirmedBullBrinco: string
  ) => Promise<void>;
  onVerifyAndRegisterAbortions?: (
    seasonId: string,
    toleranceDays?: number,
    bullSwitchConfigs?: BullSwitchConfig[]
  ) => Promise<{ registered: number; linked: number; pending: number; discovered: number; paternityConfirmed: number }>;
}

// ============================================
// LISTA DE ESTAÇÕES
// ============================================

const SeasonsList: React.FC<{
  seasons: BreedingSeason[];
  onSelectSeason: (season: BreedingSeason) => void;
  onCreateNew: () => void;
  onDeleteSeason: (seasonId: string) => void;
}> = ({ seasons, onSelectSeason, onCreateNew, onDeleteSeason }) => {
  const sortedSeasons = [...seasons].sort(
    (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Estacoes de Monta</h3>
        <button
          onClick={onCreateNew}
          className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-dark text-sm"
        >
          + Nova Estacao
        </button>
      </div>

      {sortedSeasons.length === 0 ? (
        <div className="bg-base-800 rounded-xl p-8 text-center">
          <div className="text-4xl mb-4">🐄</div>
          <p className="text-gray-400">Nenhuma estacao de monta cadastrada</p>
          <p className="text-sm text-gray-500 mt-2">
            Crie uma estacao para gerenciar a reproducao do seu rebanho
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {sortedSeasons.map((season) => (
            <div
              key={season.id}
              className="bg-base-800 rounded-xl p-4 hover:bg-base-750 transition-colors cursor-pointer"
              onClick={() => onSelectSeason(season)}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <h4 className="font-semibold text-white">{season.name}</h4>
                  <StatusBadge status={season.status} />
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Deseja excluir a estacao "${season.name}"?`)) {
                      onDeleteSeason(season.id);
                    }
                  }}
                  className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-900/30 rounded-lg transition-colors"
                  title="Excluir estacao"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
              <div className="text-sm text-gray-400">
                {formatDate(season.startDate)} - {formatDate(season.endDate)}
              </div>
              <div className="flex gap-4 mt-2 text-xs text-gray-500">
                <span>{season.exposedCowIds?.length || 0} vacas expostas</span>
                <span>{season.coverageRecords?.length || 0} coberturas</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

const BreedingSeasonManager: React.FC<BreedingSeasonManagerProps> = ({
  animals,
  seasons,
  onCreateSeason,
  onUpdateSeason,
  onDeleteSeason,
  onAddCoverage,
  onUpdateDiagnosis,
  onUpdateCoverage,
  onDeleteCoverage,
  onConfirmPaternity,
  onVerifyAndRegisterAbortions,
}) => {
  const [selectedSeason, setSelectedSeason] = useState<BreedingSeason | null>(null);
  const [showNewSeasonForm, setShowNewSeasonForm] = useState(false);
  const [showCoverageForm, setShowCoverageForm] = useState(false);
  const [preselectedCowId, setPreselectedCowId] = useState<string | undefined>(undefined);
  const [showEditSeason, setShowEditSeason] = useState(false);
  const [showExposedManager, setShowExposedManager] = useState(false);
  const [editingCoverage, setEditingCoverage] = useState<CoverageRecord | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'coverages' | 'diagnostics' | 'calvings' | 'uncovered' | 'vazias'>(
    'overview'
  );
  const [tabSearch, setTabSearch] = useState('');

  // Dados calculados
  const eligibleCows = useMemo(() => getEligibleCows(animals), [animals]);
  const availableBulls = useMemo(() => getAvailableBulls(animals), [animals]);

  // Usa a versão atualizada da estação selecionada
  const currentSeason = useMemo(() => {
    if (!selectedSeason) return null;
    return seasons.find((s) => s.id === selectedSeason.id) || selectedSeason;
  }, [selectedSeason, seasons]);

  const metrics = useMemo(
    () => (currentSeason ? calculateBreedingMetrics(currentSeason, animals) : null),
    [currentSeason, animals]
  );
  const expectedCalvings = useMemo(
    () => (currentSeason ? getExpectedCalvings(currentSeason) : []),
    [currentSeason]
  );
  const repasseEligible = useMemo(
    () => (currentSeason ? getRepasseEligibleCows(currentSeason) : []),
    [currentSeason]
  );
  const pendingPaternityRecords = useMemo(
    () => (currentSeason ? getPendingPaternityRecords(currentSeason) : []),
    [currentSeason]
  );

  // Fêmeas expostas que NÃO têm cobertura registrada (ordenadas por brinco)
  const uncoveredCows = useMemo(() => {
    if (!currentSeason) return [];
    const coveredCowIds = new Set((currentSeason.coverageRecords || []).map((r) => r.cowId));
    return (currentSeason.exposedCowIds || [])
      .filter((id) => !coveredCowIds.has(id))
      .map((id) => animals.find((a) => a.id === id))
      .filter((a): a is Animal => !!a)
      .sort((a, b) => a.brinco.localeCompare(b.brinco, 'pt-BR', { numeric: true }));
  }, [currentSeason, animals]);

  // Abortos registrados na estação
  const registeredAbortions = useMemo(
    () => (currentSeason ? getRegisteredAbortions(currentSeason) : []),
    [currentSeason]
  );

  // Verificação de partos (com e sem terneiros cadastrados)
  const calvingVerifications = useMemo(
    () => (currentSeason ? verifyCalvings(currentSeason, animals, 30) : []),
    [currentSeason, animals]
  );

  // Vacas vazias (diagnóstico final negativo)
  const emptyCows = useMemo(
    () => (currentSeason ? getEmptyCows(currentSeason, animals) : []),
    [currentSeason, animals]
  );

  // Alertas de nascimento tardio (IATF/FIV com parto 30+ dias após previsto)
  const lateBirthAlerts = useMemo(
    () => (currentSeason ? detectLateBirthAlerts(currentSeason, animals) : []),
    [currentSeason, animals]
  );

  // Estado para controlar a verificação de partos
  const [isVerifyingCalvings, setIsVerifyingCalvings] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{ registered: number; linked: number; pending: number; discovered: number; paternityConfirmed: number } | null>(null);

  // Estado para modal avançado de paternidades pendentes
  const [showPaternityModal, setShowPaternityModal] = useState(false);
  const [paternityConfigs, setPaternityConfigs] = useState<Map<string, { switchDate: string; selectedBullIndex?: 0 | 1 }>>(new Map());
  const [selectedPaternities, setSelectedPaternities] = useState<Set<string>>(new Set());
  const [batchSwitchDate, setBatchSwitchDate] = useState<string>('');

  // Handlers
  const handleCreateSeason = useCallback(async (data: { name: string; startDate: Date; endDate: Date }) => {
    try {
      const newSeason = await onCreateSeason({
        userId: '',
        name: data.name,
        startDate: data.startDate,
        endDate: data.endDate,
        status: 'planning',
        bulls: [],
        exposedCowIds: [],
        coverageRecords: [],
        config: {
          useIATF: false,
          pregnancyCheckDays: 60,
          targetPregnancyRate: 85,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      setShowNewSeasonForm(false);
      if (newSeason) setSelectedSeason(newSeason);
    } catch (err) {
      console.error('Erro ao criar estação:', err);
      alert('Erro ao criar estação de monta. Tente novamente.');
    }
  }, [onCreateSeason]);

  const handleEditSeason = useCallback(async (data: { name: string; startDate: Date; endDate: Date; status?: BreedingSeasonStatus }) => {
    if (!currentSeason) return;
    try {
      await onUpdateSeason(currentSeason.id, {
        name: data.name,
        startDate: data.startDate,
        endDate: data.endDate,
        ...(data.status ? { status: data.status } : {}),
      });
      setShowEditSeason(false);
    } catch (err) {
      console.error('Erro ao editar estação:', err);
      alert('Erro ao salvar alterações. Tente novamente.');
    }
  }, [currentSeason, onUpdateSeason]);

  const handleAddCoverage = useCallback(async (data: Omit<CoverageRecord, 'id' | 'expectedCalvingDate'>) => {
    if (!currentSeason) return;
    try {
      await onAddCoverage(currentSeason.id, data);
      setShowCoverageForm(false);
      setPreselectedCowId(undefined);
    } catch (err) {
      console.error('Erro ao adicionar cobertura:', err);
      alert('Erro ao registrar cobertura. Tente novamente.');
    }
  }, [currentSeason, onAddCoverage]);

  const handleUpdateCoverage = useCallback(async (data: Omit<CoverageRecord, 'id' | 'expectedCalvingDate'>) => {
    if (!currentSeason || !editingCoverage) return;
    try {
      await onUpdateCoverage(currentSeason.id, editingCoverage.id, data);
      setEditingCoverage(null);
    } catch (err) {
      console.error('Erro ao atualizar cobertura:', err);
      alert('Erro ao atualizar cobertura. Tente novamente.');
    }
  }, [currentSeason, editingCoverage, onUpdateCoverage]);

  const handleDeleteCoverage = useCallback(async (coverageId: string) => {
    if (!currentSeason) return;
    try {
      await onDeleteCoverage(currentSeason.id, coverageId);
    } catch (err) {
      console.error('Erro ao excluir cobertura:', err);
      alert('Erro ao excluir cobertura. Tente novamente.');
    }
  }, [currentSeason, onDeleteCoverage]);

  const handleQuickDiagnosis = useCallback(async (coverageId: string, result: 'positive' | 'negative', isRepasse?: boolean) => {
    if (!currentSeason) return;
    try {
      if (isRepasse) {
        // Atualiza o diagnóstico do repasse via onUpdateCoverage
        const coverage = currentSeason.coverageRecords?.find((c) => c.id === coverageId);
        if (!coverage?.repasse) return;
        await onUpdateCoverage(currentSeason.id, coverageId, {
          repasse: {
            ...coverage.repasse,
            diagnosisResult: result,
            diagnosisDate: new Date(),
          },
        });
      } else {
        await onUpdateDiagnosis(currentSeason.id, coverageId, result, new Date());
      }
    } catch (err) {
      console.error('Erro ao registrar diagnóstico:', err);
      alert('Erro ao registrar diagnóstico. Tente novamente.');
    }
  }, [currentSeason, onUpdateDiagnosis, onUpdateCoverage]);

  const handleConfirmPaternity = useCallback(async (coverageId: string, bullId: string, bullBrinco: string) => {
    if (!currentSeason) return;
    try {
      await onConfirmPaternity(currentSeason.id, coverageId, bullId, bullBrinco);
    } catch (err) {
      console.error('Erro ao confirmar paternidade:', err);
      alert('Erro ao confirmar paternidade. Tente novamente.');
    }
  }, [currentSeason, onConfirmPaternity]);

  // Estrutura detalhada das paternidades pendentes (para o quadro)
  interface PendingPaternityItem {
    key: string; // coverageId ou coverageId_repasse
    coverageId: string;
    isRepasse: boolean;
    cowId: string;
    cowBrinco: string;
    bulls: RepasseBull[];
    expectedCalvingDate?: Date;
    coverageDate: Date;
  }

  // Lista detalhada de todas as paternidades pendentes
  // Apenas coberturas com DG positivo que precisam de confirmação de paternidade
  const pendingPaternityItems = useMemo((): PendingPaternityItem[] => {
    if (!currentSeason) return [];
    const items: PendingPaternityItem[] = [];

    for (const c of currentSeason.coverageRecords) {
      // Cobertura principal com 2 touros, DG positivo, sem confirmação de paternidade
      const mainHasTwoBulls = c.bulls && c.bulls.length === 2;
      const mainIsPregnant = c.pregnancyResult === 'positive';
      const mainNeedsPaternity = mainHasTwoBulls && mainIsPregnant && !c.confirmedSireId;

      if (mainNeedsPaternity) {
        items.push({
          key: c.id,
          coverageId: c.id,
          isRepasse: false,
          cowId: c.cowId,
          cowBrinco: c.cowBrinco,
          bulls: c.bulls!,
          expectedCalvingDate: c.expectedCalvingDate ? new Date(c.expectedCalvingDate) : undefined,
          coverageDate: new Date(c.date),
        });
      }

      // Repasse com 2 touros, DG positivo, sem confirmação de paternidade
      // Repasse só é relevante se cobertura principal foi negativa
      const repasseActive = c.repasse?.enabled && c.pregnancyResult === 'negative';
      const repasseHasTwoBulls = c.repasse?.bulls && c.repasse.bulls.length === 2;
      const repasseIsPregnant = c.repasse?.diagnosisResult === 'positive';
      const repasseNeedsPaternity = repasseActive && repasseHasTwoBulls && repasseIsPregnant && !c.repasse?.confirmedSireId;

      if (repasseNeedsPaternity && c.repasse?.bulls) {
        items.push({
          key: `${c.id}_repasse`,
          coverageId: c.id,
          isRepasse: true,
          cowId: c.cowId,
          cowBrinco: c.cowBrinco,
          bulls: c.repasse.bulls,
          expectedCalvingDate: c.repasse.startDate
            ? new Date(new Date(c.repasse.startDate).getTime() + 283 * 24 * 60 * 60 * 1000)
            : undefined,
          coverageDate: c.repasse.startDate ? new Date(c.repasse.startDate) : new Date(c.date),
        });
      }
    }

    return items;
  }, [currentSeason]);

  // Handler para iniciar verificação - verifica se precisa pedir configuração de paternidade
  const handleStartVerifyCalvings = useCallback(() => {
    if (!currentSeason || !onVerifyAndRegisterAbortions) return;

    // Se há paternidades pendentes, abre modal avançado
    if (pendingPaternityItems.length > 0) {
      // Inicializa configurações com data do meio da estação como sugestão
      const startDate = new Date(currentSeason.startDate);
      const endDate = new Date(currentSeason.endDate);
      const midDate = new Date((startDate.getTime() + endDate.getTime()) / 2);
      const defaultSwitchDate = midDate.toISOString().split('T')[0];

      const initialConfigs = new Map<string, { switchDate: string; selectedBullIndex?: 0 | 1 }>();
      for (const item of pendingPaternityItems) {
        initialConfigs.set(item.key, { switchDate: defaultSwitchDate });
      }
      setPaternityConfigs(initialConfigs);
      setSelectedPaternities(new Set());
      setBatchSwitchDate(defaultSwitchDate);
      setShowPaternityModal(true);
    } else {
      // Sem paternidades pendentes, executa direto
      executeVerifyCalvings();
    }
  }, [currentSeason, onVerifyAndRegisterAbortions, pendingPaternityItems]);

  // Handler que executa a verificação com configurações individuais
  const executeVerifyCalvings = useCallback(async (configs?: BullSwitchConfig[]) => {
    if (!currentSeason || !onVerifyAndRegisterAbortions) return;

    const hasConfigs = configs && configs.length > 0;
    const confirmMessage = `Esta ação irá:

• Verificar todas as vacas com DG positivo
• Vincular automaticamente os terneiros já cadastrados
• Marcar como ABORTO as vacas sem terneiros cadastrados após 30 dias da data prevista
• Atualizar o histórico de abortos das vacas afetadas
${hasConfigs ? `• Confirmar ${configs.length} paternidade(s) baseado nas configurações definidas` : ''}

Certifique-se de que TODOS os terneiros desta geração já foram cadastrados.

Deseja continuar?`;

    if (!confirm(confirmMessage)) return;

    setIsVerifyingCalvings(true);
    setVerificationResult(null);
    setShowPaternityModal(false);

    try {
      const result = await onVerifyAndRegisterAbortions(currentSeason.id, 30, configs);
      setVerificationResult(result);

      const messages: string[] = [];
      if (result.linked > 0) messages.push(`✓ ${result.linked} parto(s) vinculado(s)`);
      if (result.registered > 0) messages.push(`✗ ${result.registered} aborto(s) registrado(s)`);
      if (result.discovered > 0) messages.push(`🔍 ${result.discovered} parto(s) descoberto(s)`);
      if (result.paternityConfirmed > 0) messages.push(`🧬 ${result.paternityConfirmed} paternidade(s) confirmada(s)`);
      if (result.pending > 0) messages.push(`⏳ ${result.pending} pendente(s)`);

      // Recalcula alertas de nascimento tardio após vinculação
      const updatedSeason = seasons.find((s) => s.id === currentSeason.id);
      if (updatedSeason) {
        const newAlerts = detectLateBirthAlerts(updatedSeason, animals);
        if (newAlerts.length > 0) {
          messages.push(`\n⚠️ ${newAlerts.length} bezerro(s) de IATF/FIV/IA nasceram com atraso - verifique a paternidade abaixo`);
        }
      }

      if (messages.length > 0) {
        alert(`Verificação concluída!\n\n${messages.join('\n')}`);
      } else {
        alert('Nenhuma cobertura com DG positivo pendente de verificação.');
      }
    } catch (err) {
      console.error('Erro ao verificar partos:', err);
      alert('Erro ao verificar partos. Tente novamente.');
    } finally {
      setIsVerifyingCalvings(false);
    }
  }, [currentSeason, onVerifyAndRegisterAbortions, seasons, animals]);

  // Handler para atualizar configuração individual
  const handleUpdatePaternityConfig = useCallback((key: string, update: { switchDate?: string; selectedBullIndex?: 0 | 1 }) => {
    setPaternityConfigs(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(key) || { switchDate: '' };
      newMap.set(key, { ...existing, ...update });
      return newMap;
    });
  }, []);

  // Handler para toggle de seleção
  const handleTogglePaternitySelection = useCallback((key: string) => {
    setSelectedPaternities(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  }, []);

  // Handler para selecionar/desselecionar todos
  const handleToggleSelectAllPaternities = useCallback(() => {
    if (selectedPaternities.size === pendingPaternityItems.length) {
      setSelectedPaternities(new Set());
    } else {
      setSelectedPaternities(new Set(pendingPaternityItems.map(i => i.key)));
    }
  }, [selectedPaternities.size, pendingPaternityItems]);

  // Handler para aplicar data em lote aos selecionados
  const handleApplyBatchSwitchDate = useCallback(() => {
    if (!batchSwitchDate || selectedPaternities.size === 0) return;
    setPaternityConfigs(prev => {
      const newMap = new Map(prev);
      for (const key of selectedPaternities) {
        const existing = newMap.get(key) || { switchDate: '' };
        newMap.set(key, { ...existing, switchDate: batchSwitchDate, selectedBullIndex: undefined });
      }
      return newMap;
    });
  }, [batchSwitchDate, selectedPaternities]);

  // Handler para aplicar touro específico em lote (índice 0 ou 1)
  const handleApplyBatchBullIndex = useCallback((index: 0 | 1) => {
    if (selectedPaternities.size === 0) return;
    setPaternityConfigs(prev => {
      const newMap = new Map(prev);
      for (const key of selectedPaternities) {
        const existing = newMap.get(key) || { switchDate: '' };
        newMap.set(key, { ...existing, selectedBullIndex: index });
      }
      return newMap;
    });
  }, [selectedPaternities]);

  // Handler para confirmar configurações e executar verificação
  const handleConfirmPaternityConfigs = useCallback(() => {
    // Converte o Map de configs para o array de BullSwitchConfig
    const configs: BullSwitchConfig[] = [];
    for (const item of pendingPaternityItems) {
      const config = paternityConfigs.get(item.key);
      if (config) {
        configs.push({
          coverageId: item.coverageId,
          isRepasse: item.isRepasse,
          switchDate: config.switchDate ? new Date(config.switchDate) : undefined,
          selectedBullIndex: config.selectedBullIndex,
        });
      }
    }
    executeVerifyCalvings(configs);
  }, [pendingPaternityItems, paternityConfigs, executeVerifyCalvings]);

  // Handler para executar sem confirmação de paternidade
  const handleSkipPaternityConfirmation = useCallback(() => {
    setShowPaternityModal(false);
    executeVerifyCalvings();
  }, [executeVerifyCalvings]);

  // Handler combinado: marca DG como vazia + habilita repasse em uma ÚNICA operação
  // Usa onUpdateCoverage que atualiza pregnancyResult + repasse atomicamente no mesmo coverageRecord
  const handleDiagnosisWithRepasse = useCallback(async (coverageId: string, repasseBulls: RepasseBull[]) => {
    if (!currentSeason) return;
    try {
      await onUpdateCoverage(currentSeason.id, coverageId, {
        pregnancyResult: 'negative',
        pregnancyCheckDate: new Date(),
        repasse: {
          enabled: true,
          bulls: repasseBulls,
          bullId: repasseBulls[0]?.bullId,
          bullBrinco: repasseBulls[0]?.bullBrinco,
          startDate: new Date(currentSeason.startDate),
          endDate: new Date(currentSeason.endDate),
          diagnosisResult: 'pending',
        },
      });
    } catch (err) {
      console.error('Erro ao registrar repasse:', err);
      alert('Erro ao encaminhar para repasse. Tente novamente.');
    }
  }, [currentSeason, onUpdateCoverage]);

  const handleUpdateExposedCows = useCallback(async (cowIds: string[]) => {
    if (!currentSeason) return;
    try {
      await onUpdateSeason(currentSeason.id, { exposedCowIds: cowIds });
    } catch (err) {
      console.error('Erro ao atualizar vacas expostas:', err);
      alert('Erro ao atualizar vacas expostas. Tente novamente.');
    }
  }, [currentSeason, onUpdateSeason]);

  const handleBack = () => {
    setSelectedSeason(null);
    setActiveTab('overview');
  };

  // ====== VISTA: LISTA DE ESTAÇÕES ======
  if (!selectedSeason) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Estacao de Monta</h2>
          <p className="text-sm text-gray-400">Gerencie a reproducao do seu rebanho</p>
        </div>

        {showNewSeasonForm ? (
          <SeasonForm
            onSubmit={handleCreateSeason}
            onCancel={() => setShowNewSeasonForm(false)}
          />
        ) : (
          <SeasonsList
            seasons={seasons}
            onSelectSeason={setSelectedSeason}
            onCreateNew={() => setShowNewSeasonForm(true)}
            onDeleteSeason={onDeleteSeason}
          />
        )}
      </div>
    );
  }

  if (!currentSeason) return null;

  // ====== VISTA: DETALHES DA ESTAÇÃO ======
  const sortedCoverages = [...(currentSeason.coverageRecords || [])].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <div className="space-y-6">
      {/* Modais */}
      {showCoverageForm && (
        <CoverageForm
          eligibleCows={eligibleCows}
          availableBulls={availableBulls}
          allAnimals={animals}
          season={currentSeason}
          onSubmit={handleAddCoverage}
          onCancel={() => {
            setShowCoverageForm(false);
            setPreselectedCowId(undefined);
          }}
          preselectedCowId={preselectedCowId}
        />
      )}

      {editingCoverage && (
        <CoverageForm
          eligibleCows={eligibleCows}
          availableBulls={availableBulls}
          allAnimals={animals}
          season={currentSeason}
          initialData={editingCoverage}
          onSubmit={handleUpdateCoverage}
          onCancel={() => setEditingCoverage(null)}
        />
      )}

      {showEditSeason && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <SeasonForm
              isEdit
              initialData={{
                name: currentSeason.name,
                startDate: toInputDate(currentSeason.startDate),
                endDate: toInputDate(currentSeason.endDate),
                status: currentSeason.status,
              }}
              onSubmit={handleEditSeason}
              onCancel={() => setShowEditSeason(false)}
            />
          </div>
        </div>
      )}

      {/* Modal Avançado de Gerenciamento de Paternidades */}
      {showPaternityModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-4xl bg-base-800 rounded-xl p-6 my-4 relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowPaternityModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white z-10"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h3 className="text-xl font-bold text-white mb-4">🧬 Confirmação de Paternidades</h3>

            <div className="bg-purple-900/30 border border-purple-700 rounded-lg p-4 mb-4">
              <p className="text-sm text-purple-200">
                Foram encontradas <strong>{pendingPaternityItems.length}</strong> cobertura(s) com 2 touros
                onde a paternidade ainda não foi confirmada.
              </p>
              <p className="text-sm text-purple-200 mt-2">
                Configure individualmente a <strong>data de troca</strong> ou selecione diretamente qual touro é o pai.
                Use a seleção em lote para aplicar a mesma configuração a múltiplos registros.
              </p>
            </div>

            {/* Controles de Lote */}
            <div className="bg-base-700 rounded-lg p-4 mb-4">
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <button
                  onClick={handleToggleSelectAllPaternities}
                  className="px-3 py-1.5 text-sm bg-base-600 hover:bg-base-500 text-gray-300 rounded-lg"
                >
                  {selectedPaternities.size === pendingPaternityItems.length ? 'Desmarcar todos' : 'Selecionar todos'}
                </button>
                <span className="text-sm text-gray-400">
                  {selectedPaternities.size} selecionado(s)
                </span>
              </div>

              {selectedPaternities.size > 0 && (
                <div className="flex flex-wrap items-end gap-3 pt-3 border-t border-base-600">
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs text-gray-400 mb-1">Aplicar data de troca em lote</label>
                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={batchSwitchDate}
                        onChange={(e) => setBatchSwitchDate(e.target.value)}
                        className="flex-1 px-3 py-1.5 text-sm bg-base-600 border border-base-500 rounded-lg text-white"
                        min={currentSeason ? toInputDate(currentSeason.startDate) : undefined}
                        max={currentSeason ? toInputDate(currentSeason.endDate) : undefined}
                      />
                      <button
                        onClick={handleApplyBatchSwitchDate}
                        disabled={!batchSwitchDate}
                        className="px-3 py-1.5 text-sm bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:cursor-not-allowed text-white rounded-lg"
                      >
                        Aplicar
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Ou definir touro diretamente</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApplyBatchBullIndex(0)}
                        className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                        title="Definir 1° touro como pai para todos selecionados"
                      >
                        1° Touro
                      </button>
                      <button
                        onClick={() => handleApplyBatchBullIndex(1)}
                        className="px-3 py-1.5 text-sm bg-amber-600 hover:bg-amber-700 text-white rounded-lg"
                        title="Definir 2° touro como pai para todos selecionados"
                      >
                        2° Touro
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Quadro de Paternidades Pendentes */}
            <div className="max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-base-700 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-gray-400 w-10">
                      <input
                        type="checkbox"
                        checked={selectedPaternities.size === pendingPaternityItems.length && pendingPaternityItems.length > 0}
                        onChange={handleToggleSelectAllPaternities}
                        className="rounded border-gray-500 bg-base-600 text-purple-500 focus:ring-purple-500"
                      />
                    </th>
                    <th className="px-3 py-2 text-left text-gray-400">Vaca</th>
                    <th className="px-3 py-2 text-left text-gray-400">Tipo</th>
                    <th className="px-3 py-2 text-left text-gray-400">1° Touro</th>
                    <th className="px-3 py-2 text-left text-gray-400">2° Touro</th>
                    <th className="px-3 py-2 text-left text-gray-400">Data Troca</th>
                    <th className="px-3 py-2 text-left text-gray-400">Pai Selecionado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-base-700">
                  {pendingPaternityItems.map((item) => {
                    const config = paternityConfigs.get(item.key) || { switchDate: '' };
                    const isSelected = selectedPaternities.has(item.key);

                    // Determina qual touro será selecionado baseado na config
                    let selectedBullLabel = '-';
                    let selectedBullColor = 'text-gray-500';
                    if (config.selectedBullIndex !== undefined) {
                      const bull = item.bulls[config.selectedBullIndex];
                      selectedBullLabel = bull?.bullBrinco || `Touro ${config.selectedBullIndex + 1}`;
                      selectedBullColor = config.selectedBullIndex === 0 ? 'text-blue-400' : 'text-amber-400';
                    } else if (config.switchDate && item.expectedCalvingDate) {
                      // Calcula baseado na data de troca
                      const switchTime = new Date(config.switchDate).getTime();
                      const birthTime = item.expectedCalvingDate.getTime();
                      const estimatedCoverageTime = birthTime - (283 * 24 * 60 * 60 * 1000);
                      const bullIndex = estimatedCoverageTime < switchTime ? 0 : 1;
                      const bull = item.bulls[bullIndex];
                      selectedBullLabel = `${bull?.bullBrinco || `Touro ${bullIndex + 1}`} (calc.)`;
                      selectedBullColor = bullIndex === 0 ? 'text-blue-400' : 'text-amber-400';
                    }

                    return (
                      <tr key={item.key} className={`${isSelected ? 'bg-purple-900/20' : ''} hover:bg-base-700/50`}>
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleTogglePaternitySelection(item.key)}
                            className="rounded border-gray-500 bg-base-600 text-purple-500 focus:ring-purple-500"
                          />
                        </td>
                        <td className="px-3 py-2 text-white font-medium">{item.cowBrinco}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded text-xs ${item.isRepasse ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                            {item.isRepasse ? 'Repasse' : 'Principal'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-blue-400">{item.bulls[0]?.bullBrinco || '-'}</td>
                        <td className="px-3 py-2 text-amber-400">{item.bulls[1]?.bullBrinco || '-'}</td>
                        <td className="px-3 py-2">
                          <input
                            type="date"
                            value={config.switchDate || ''}
                            onChange={(e) => handleUpdatePaternityConfig(item.key, { switchDate: e.target.value, selectedBullIndex: undefined })}
                            className="w-full px-2 py-1 text-xs bg-base-600 border border-base-500 rounded text-white"
                            min={currentSeason ? toInputDate(currentSeason.startDate) : undefined}
                            max={currentSeason ? toInputDate(currentSeason.endDate) : undefined}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className={`font-medium ${selectedBullColor}`}>{selectedBullLabel}</span>
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleUpdatePaternityConfig(item.key, { selectedBullIndex: 0 })}
                                className={`w-6 h-6 rounded text-xs ${config.selectedBullIndex === 0 ? 'bg-blue-600 text-white' : 'bg-base-600 text-gray-400 hover:bg-blue-600/50'}`}
                                title={`Definir ${item.bulls[0]?.bullBrinco || '1° touro'} como pai`}
                              >
                                1
                              </button>
                              <button
                                onClick={() => handleUpdatePaternityConfig(item.key, { selectedBullIndex: 1 })}
                                className={`w-6 h-6 rounded text-xs ${config.selectedBullIndex === 1 ? 'bg-amber-600 text-white' : 'bg-base-600 text-gray-400 hover:bg-amber-600/50'}`}
                                title={`Definir ${item.bulls[1]?.bullBrinco || '2° touro'} como pai`}
                              >
                                2
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Legenda e Ações */}
            <div className="mt-4 pt-4 border-t border-base-600">
              <p className="text-xs text-gray-500 mb-4">
                <strong>Legenda:</strong> A data de troca define qual touro é o pai baseado na data estimada de cobertura (nascimento - 283 dias).
                Cobertura antes da troca = 1° touro (azul). Depois da troca = 2° touro (amarelo).
                Você também pode selecionar diretamente o touro usando os botões 1 ou 2.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={handleSkipPaternityConfirmation}
                  className="flex-1 px-4 py-2 bg-base-600 hover:bg-base-500 text-gray-300 rounded-lg font-medium"
                >
                  Pular (não confirmar paternidades)
                </button>
                <button
                  onClick={handleConfirmPaternityConfigs}
                  className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium"
                >
                  Confirmar e Verificar Partos
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showExposedManager && (
        <ExposedCowsManager
          exposedCowIds={currentSeason.exposedCowIds || []}
          eligibleCows={eligibleCows}
          allAnimals={animals}
          onUpdate={handleUpdateExposedCows}
          onClose={() => setShowExposedManager(false)}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <button
            onClick={handleBack}
            className="text-sm text-gray-400 hover:text-white mb-2 flex items-center gap-1"
          >
            ← Voltar para lista
          </button>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-2xl font-bold text-white">{currentSeason.name}</h2>
            <StatusBadge status={currentSeason.status} />
            <button
              onClick={() => setShowEditSeason(true)}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-base-600 rounded-lg transition-colors"
              title="Editar estacao"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
            </button>
          </div>
          <p className="text-sm text-gray-400">
            Periodo: {formatDate(currentSeason.startDate)} - {formatDate(currentSeason.endDate)}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => exportBreedingSeasonToCSV(currentSeason, animals)}
            className="px-3 py-2 bg-base-700 text-gray-300 rounded-lg hover:bg-base-600 text-sm"
            title="Exportar CSV"
          >
            CSV
          </button>
          <button
            onClick={() => exportBreedingSeasonToPDF(currentSeason, animals)}
            className="px-3 py-2 bg-base-700 text-gray-300 rounded-lg hover:bg-base-600 text-sm"
            title="Exportar PDF"
          >
            PDF
          </button>
          <button
            onClick={() => setShowCoverageForm(true)}
            className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-dark text-sm"
          >
            + Nova Cobertura
          </button>
        </div>
      </div>

      {/* Vacas Expostas */}
      <div className="bg-base-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-gray-400">
            Vacas Expostas ({currentSeason.exposedCowIds?.length || 0})
          </h4>
          <button
            onClick={() => setShowExposedManager(true)}
            className="text-xs text-brand-primary hover:text-brand-primary-light"
          >
            Gerenciar
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(currentSeason.exposedCowIds || []).length === 0 ? (
            <p className="text-gray-500 text-sm">Nenhuma vaca exposta. Clique em "Gerenciar" para adicionar.</p>
          ) : (
            <>
              {(currentSeason.exposedCowIds || []).slice(0, 20).map((id) => {
                const animal = animals.find((a) => a.id === id);
                return (
                  <span
                    key={id}
                    className="px-2 py-0.5 bg-base-700 rounded text-xs text-gray-300"
                  >
                    {animal?.brinco || id.slice(0, 8)}
                  </span>
                );
              })}
              {(currentSeason.exposedCowIds?.length || 0) > 20 && (
                <span className="px-2 py-0.5 bg-base-600 rounded text-xs text-gray-400">
                  +{(currentSeason.exposedCowIds?.length || 0) - 20} mais
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Métricas */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <MetricCard label="Expostas" value={metrics.totalExposed} icon="🐄" color="border-blue-500" />
          <MetricCard label="Cobertas" value={metrics.totalCovered} icon="💕" color="border-pink-500" />
          <MetricCard label="Prenhes" value={metrics.totalPregnant} icon="🤰" color="border-emerald-500" />
          <MetricCard
            label="Taxa Prenhez"
            value={metrics.overallPregnancyRate}
            unit="%"
            icon="📊"
            color="border-purple-500"
          />
          <MetricCard
            label="Monta"
            value={`${metrics.montaNaturalPregnant}/${metrics.montaNaturalTotal}`}
            icon="🐂"
            color="border-amber-500"
          />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-base-700 overflow-x-auto">
        {([
          { key: 'overview' as const, label: 'Visao Geral' },
          { key: 'coverages' as const, label: `Coberturas (${sortedCoverages.length})` },
          { key: 'uncovered' as const, label: `Sem Monta (${uncoveredCows.length})` },
          { key: 'diagnostics' as const, label: `Diagnosticos (${metrics?.pregnancyChecksDue.length || 0})` },
          { key: 'calvings' as const, label: `Partos (${expectedCalvings.length})` },
          { key: 'vazias' as const, label: `Vazias (${emptyCows.length})` },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setTabSearch(''); }}
            className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? 'text-brand-primary border-b-2 border-brand-primary'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB: Visão Geral */}
      {activeTab === 'overview' && metrics && (
        <div className="space-y-6">
          <div className="bg-base-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Indicadores de Eficiencia</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-emerald-400">{metrics.serviceRate}%</div>
                <div className="text-sm text-gray-400">Taxa de Servico</div>
                <div className="text-xs text-gray-500">Cobertas / Expostas</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-400">{metrics.conceptionRate}%</div>
                <div className="text-sm text-gray-400">Taxa de Concepcao</div>
                <div className="text-xs text-gray-500">Prenhes / Cobertas</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-cyan-400">{metrics.pregnancyRate}%</div>
                <div className="text-sm text-gray-400">Prenhez 1o Servico</div>
                <div className="text-xs text-gray-500">Prenhes (sem repasse) / Cobertas</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-400">{metrics.overallPregnancyRate}%</div>
                <div className="text-sm text-gray-400">Prenhez Geral</div>
                <div className="text-xs text-gray-500">Prenhes (total) / Expostas</div>
              </div>
            </div>
          </div>

          <div className="bg-base-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Coberturas por Tipo</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {(['iatf', 'fiv', 'ia', 'natural'] as CoverageType[]).map((t) => (
                <div key={t} className="text-center p-4 bg-base-700 rounded-lg">
                  <div className="text-2xl font-bold text-white">{metrics.coveragesByType[t]}</div>
                  <div className="text-sm text-gray-400">{typeLabels[t]}</div>
                </div>
              ))}
            </div>
          </div>

          {metrics.repasseCount > 0 && (
            <div className="bg-base-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Repasse (Monta Natural)</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-base-700 rounded-lg">
                  <div className="text-2xl font-bold text-amber-400">{metrics.repasseCount}</div>
                  <div className="text-sm text-gray-400">Vacas em repasse</div>
                </div>
                <div className="text-center p-4 bg-base-700 rounded-lg">
                  <div className="text-2xl font-bold text-emerald-400">{metrics.repassePregnant}</div>
                  <div className="text-sm text-gray-400">Prenhes no repasse</div>
                </div>
                <div className="text-center p-4 bg-base-700 rounded-lg">
                  <div className="text-2xl font-bold text-white">
                    {metrics.repasseCount > 0 ? Math.round((metrics.repassePregnant / metrics.repasseCount) * 100) : 0}%
                  </div>
                  <div className="text-sm text-gray-400">Taxa repasse</div>
                </div>
              </div>
            </div>
          )}

          {/* Vacas elegíveis para repasse */}
          {repasseEligible.length > 0 && (
            <div className="bg-amber-900/20 border border-amber-700 rounded-xl p-4">
              <h4 className="text-sm font-semibold text-amber-400 mb-2">
                Vacas vazias elegiveis para repasse ({repasseEligible.length})
              </h4>
              <div className="flex flex-wrap gap-2">
                {repasseEligible.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setEditingCoverage(c)}
                    className="px-3 py-1 bg-base-700 text-white text-sm rounded-lg hover:bg-base-600"
                  >
                    {c.cowBrinco} ({typeLabels[c.type]})
                  </button>
                ))}
              </div>
              <p className="text-xs text-amber-500 mt-2">
                Clique para editar e habilitar o repasse com monta natural
              </p>
            </div>
          )}

          {metrics.coveragesByBull.length > 0 && (
            <div className="bg-base-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Performance por Touro/Semen</h3>
              <div className="space-y-3">
                {metrics.coveragesByBull.map((bull) => (
                  <div
                    key={bull.bullId || bull.bullBrinco}
                    className="flex items-center justify-between p-3 bg-base-700 rounded-lg"
                  >
                    <div>
                      <div className="font-medium text-white">{bull.bullBrinco}</div>
                      <div className="text-xs text-gray-400">{bull.count} coberturas</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-emerald-400">
                        {bull.count > 0 ? Math.round((bull.pregnancies / bull.count) * 100) : 0}%
                      </div>
                      <div className="text-xs text-gray-400">{bull.pregnancies} prenhes</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: Coberturas */}
      {activeTab === 'coverages' && (() => {
        const filtered = tabSearch.trim()
          ? sortedCoverages.filter((c) => c.cowBrinco.toLowerCase().includes(tabSearch.toLowerCase()))
          : sortedCoverages;
        return (
          <div className="space-y-3">
            {sortedCoverages.length > 0 && (
              <input
                type="text"
                value={tabSearch}
                onChange={(e) => setTabSearch(e.target.value)}
                placeholder="Buscar por brinco..."
                className="w-full bg-base-800 border border-base-600 rounded-lg px-3 py-2 text-white text-sm"
              />
            )}
            {sortedCoverages.length === 0 ? (
              <div className="bg-base-800 rounded-xl p-8 text-center">
                <p className="text-gray-400">Nenhuma cobertura registrada</p>
                <button
                  onClick={() => setShowCoverageForm(true)}
                  className="mt-3 px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-dark text-sm"
                >
                  + Registrar primeira cobertura
                </button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="bg-base-800 rounded-xl p-8 text-center">
                <p className="text-gray-400">Nenhuma cobertura encontrada para "{tabSearch}"</p>
              </div>
            ) : (
              filtered.map((coverage) => (
                <CoverageCard
                  key={coverage.id}
                  coverage={coverage}
                  season={currentSeason}
                  availableBulls={availableBulls}
                  onEdit={() => setEditingCoverage(coverage)}
                  onDelete={() => handleDeleteCoverage(coverage.id)}
                  onQuickDiagnosis={handleQuickDiagnosis}
                  onDiagnosisWithRepasse={handleDiagnosisWithRepasse}
                  onConfirmPaternity={handleConfirmPaternity}
                />
              ))
            )}
          </div>
        );
      })()}

      {/* TAB: Sem Monta - Fêmeas expostas sem cobertura */}
      {activeTab === 'uncovered' && (() => {
        const filtered = tabSearch.trim()
          ? uncoveredCows.filter((c) =>
              c.brinco.toLowerCase().includes(tabSearch.toLowerCase()) ||
              c.nome?.toLowerCase().includes(tabSearch.toLowerCase())
            )
          : uncoveredCows;
        return (
          <div className="space-y-3">
            {uncoveredCows.length > 0 && (
              <input
                type="text"
                value={tabSearch}
                onChange={(e) => setTabSearch(e.target.value)}
                placeholder="Buscar por brinco ou nome..."
                className="w-full bg-base-800 border border-base-600 rounded-lg px-3 py-2 text-white text-sm"
              />
            )}
            {uncoveredCows.length === 0 ? (
              <div className="bg-base-800 rounded-xl p-8 text-center">
                <div className="text-4xl mb-3">🎉</div>
                <p className="text-emerald-400 font-medium">Todas as vacas expostas ja tem cobertura registrada!</p>
                <p className="text-gray-500 text-sm mt-1">Nenhuma femea pendente de monta nesta estacao.</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="bg-base-800 rounded-xl p-8 text-center">
                <p className="text-gray-400">Nenhuma femea encontrada para "{tabSearch}"</p>
              </div>
            ) : (
              <>
                <div className="bg-amber-900/20 border border-amber-700 rounded-xl p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <p className="text-amber-400 text-sm">
                      <strong>{uncoveredCows.length}</strong> de <strong>{currentSeason.exposedCowIds?.length || 0}</strong> {uncoveredCows.length === 1 ? 'femea exposta ainda nao possui' : 'femeas expostas ainda nao possuem'} cobertura registrada.
                    </p>
                    {metrics && (
                      <span className="text-xs text-gray-400">
                        Taxa de Servico: {metrics.serviceRate.toFixed(0)}%
                      </span>
                    )}
                  </div>
                </div>
                <div className="grid gap-2">
                  {filtered.map((cow) => (
                    <div
                      key={cow.id}
                      className="flex items-center justify-between p-4 bg-base-800 rounded-lg hover:bg-base-700 transition-colors"
                    >
                      <div>
                        <div className="font-medium text-white">{cow.brinco}</div>
                        {cow.nome && <div className="text-sm text-gray-400">{cow.nome}</div>}
                        {cow.raca && <div className="text-xs text-gray-500">{cow.raca}</div>}
                      </div>
                      <button
                        onClick={() => {
                          setPreselectedCowId(cow.id);
                          setShowCoverageForm(true);
                        }}
                        className="px-3 py-1.5 bg-brand-primary text-white text-sm rounded-lg hover:bg-brand-primary-dark"
                      >
                        + Registrar Monta
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        );
      })()}

      {/* TAB: Diagnósticos */}
      {activeTab === 'diagnostics' && metrics && (() => {
        const checks = metrics.pregnancyChecksDue;
        const filteredChecks = tabSearch.trim()
          ? checks.filter((c) => c.cowBrinco.toLowerCase().includes(tabSearch.toLowerCase()))
          : checks;
        return (
          <div className="bg-base-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">
              Diagnosticos Pendentes ({checks.length})
            </h3>
            {checks.length > 0 && (
              <input
                type="text"
                value={tabSearch}
                onChange={(e) => setTabSearch(e.target.value)}
                placeholder="Buscar por brinco..."
                className="w-full bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-white text-sm mb-4"
              />
            )}
            {checks.length === 0 ? (
              <p className="text-gray-400 text-center py-8">Nenhum diagnostico pendente no momento</p>
            ) : filteredChecks.length === 0 ? (
              <p className="text-gray-400 text-center py-8">Nenhum diagnostico encontrado para "{tabSearch}"</p>
            ) : (
              <div className="space-y-3">
                {filteredChecks.map((check, idx) => (
                  <div
                    key={`${check.cowId}-${check.isRepasse ? 'rep' : 'main'}-${idx}`}
                    className="flex items-center justify-between p-4 bg-base-700 rounded-lg"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">{check.cowBrinco}</span>
                        {check.isRepasse && (
                          <span className="px-2 py-0.5 bg-amber-600/20 text-amber-400 text-xs rounded-full">Repasse</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-400">
                        Previsto para: {formatDate(check.dueDate)}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleQuickDiagnosis(check.coverageId, 'positive', check.isRepasse)}
                        className="px-3 py-1 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700"
                      >
                        Prenhe
                      </button>
                      <button
                        onClick={() => handleQuickDiagnosis(check.coverageId, 'negative', check.isRepasse)}
                        className="px-3 py-1 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700"
                      >
                        Vazia
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* TAB: Partos Previstos */}
      {activeTab === 'calvings' && (
        <div className="space-y-4">
          {/* Botão de Verificação de Partos */}
          {onVerifyAndRegisterAbortions && expectedCalvings.length > 0 && (
            <div className="bg-base-800 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">Verificar Nascimentos</h3>
                  <p className="text-sm text-gray-400 mt-1">
                    Após cadastrar todos os terneiros da geração, clique para verificar partos e registrar abortos automaticamente.
                  </p>
                </div>
                <button
                  onClick={handleStartVerifyCalvings}
                  disabled={isVerifyingCalvings}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-800 disabled:cursor-not-allowed text-white rounded-lg font-medium flex items-center gap-2"
                >
                  {isVerifyingCalvings ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Verificando...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Verificar Partos
                    </>
                  )}
                </button>
              </div>
              {verificationResult && (
                <div className="mt-3 p-3 bg-base-700 rounded-lg text-sm">
                  <div className="flex flex-wrap gap-4">
                    <span className="text-emerald-400">✓ {verificationResult.linked} vinculado(s)</span>
                    <span className="text-red-400">✗ {verificationResult.registered} aborto(s)</span>
                    <span className="text-yellow-400">⏳ {verificationResult.pending} pendente(s)</span>
                    {verificationResult.discovered > 0 && (
                      <span className="text-blue-400">🔍 {verificationResult.discovered} descoberto(s)</span>
                    )}
                    {verificationResult.paternityConfirmed > 0 && (
                      <span className="text-purple-400">🧬 {verificationResult.paternityConfirmed} paternidade(s)</span>
                    )}
                  </div>
                  {verificationResult.discovered > 0 && (
                    <p className="text-xs text-blue-300/70 mt-2">
                      Vacas expostas sem cobertura prévia que tiveram terneiros. Registros retroativos criados.
                    </p>
                  )}
                  {verificationResult.paternityConfirmed > 0 && (
                    <p className="text-xs text-purple-300/70 mt-2">
                      Paternidades confirmadas automaticamente baseado na data de troca de touros. Você pode editar manualmente se necessário.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Alerta de Nascimento Tardio - IATF/FIV */}
          {lateBirthAlerts.length > 0 && (
            <div className="bg-orange-900/20 border border-orange-700 rounded-xl p-4">
              <h3 className="text-lg font-semibold text-orange-400 mb-3">
                Verificar Paternidade ({lateBirthAlerts.length})
              </h3>
              <p className="text-sm text-orange-300/80 mb-3">
                Bezerros de vacas IATF/FIV/IA que nasceram com mais de 30 dias de atraso. A vaca pode ter perdido a prenhez original e engravidado durante a estacao de monta - verifique o pai.
              </p>
              <div className="space-y-2">
                {lateBirthAlerts.map((alert) => (
                  <div
                    key={alert.coverageId}
                    className="flex items-center justify-between p-3 bg-base-800 rounded-lg"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">{alert.cowBrinco}</span>
                        <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 text-xs rounded">
                          {typeLabels[alert.coverageType]}
                        </span>
                        <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs font-semibold rounded">
                          +{alert.daysLate} dias
                        </span>
                      </div>
                      <div className="text-sm text-gray-400 mt-1">
                        Bezerro: {alert.calfBrinco} | Pai registrado: {alert.registeredSire}
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <div className="text-gray-400">Previsto: {formatDate(alert.expectedDate)}</div>
                      <div className="text-orange-400">Nasceu: {formatDate(alert.actualDate)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Seção de Abortos */}
          {registeredAbortions.length > 0 && (
            <div className="bg-red-900/20 border border-red-700 rounded-xl p-4">
              <h3 className="text-lg font-semibold text-red-400 mb-3">
                Abortos ({registeredAbortions.length})
              </h3>
              <p className="text-sm text-red-300/80 mb-3">
                Vacas que tiveram diagnóstico positivo mas não tiveram terneiros cadastrados.
              </p>
              <div className="space-y-2">
                {registeredAbortions.map((abortion) => (
                  <div
                    key={`${abortion.coverageId}-${abortion.isRepasse ? 'rep' : 'main'}`}
                    className="flex items-center justify-between p-3 bg-base-800 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">{abortion.cowBrinco}</span>
                      {abortion.isRepasse && (
                        <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded">
                          Repasse
                        </span>
                      )}
                      <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded">
                        Aborto
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-400">
                        Previsto: {formatDate(abortion.expectedDate)}
                      </div>
                      {abortion.notes && (
                        <div className="text-xs text-gray-500 max-w-xs truncate">
                          {abortion.notes}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Alerta de paternidade pendente */}
          {pendingPaternityRecords.length > 0 && (
            <div className="bg-yellow-900/20 border border-yellow-700 rounded-xl p-4">
              <h3 className="text-lg font-semibold text-yellow-400 mb-3">
                Paternidade Pendente ({pendingPaternityRecords.length})
              </h3>
              <p className="text-sm text-yellow-300/80 mb-3">
                Estas vacas foram cobertas com 2 touros. Confirme o pai apos o nascimento do bezerro.
              </p>
              <div className="space-y-2">
                {pendingPaternityRecords.flatMap((coverage) => {
                  const entries: { key: string; source: string; bulls: RepasseBull[] }[] = [];
                  // Paternidade pendente da cobertura principal (monta natural com 2 touros)
                  if (hasPendingCoveragePaternity(coverage)) {
                    entries.push({
                      key: `${coverage.id}-main`,
                      source: 'Monta Natural',
                      bulls: getCoverageBulls(coverage),
                    });
                  }
                  // Paternidade pendente do repasse
                  if (coverage.repasse?.enabled && hasPendingPaternity(coverage.repasse)) {
                    entries.push({
                      key: `${coverage.id}-rep`,
                      source: 'Repasse',
                      bulls: getRepasseBulls(coverage.repasse),
                    });
                  }
                  return entries.map(({ key, source, bulls }) => (
                    <div key={key} className="flex items-center justify-between p-3 bg-base-800 rounded-lg">
                      <div>
                        <span className="font-medium text-white">{coverage.cowBrinco}</span>
                        <span className="px-2 py-0.5 bg-base-600 text-gray-300 text-xs rounded-full ml-2">{source}</span>
                        <span className="text-sm text-gray-400 ml-2">
                          Touros: {bulls.map((b) => b.bullBrinco).join(' / ')}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        {bulls.map((b) => (
                          <button
                            key={b.bullId}
                            onClick={() => {
                              if (confirm(`Confirmar ${b.bullBrinco} como pai do bezerro de ${coverage.cowBrinco}?`)) {
                                handleConfirmPaternity(coverage.id, b.bullId, b.bullBrinco);
                              }
                            }}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded-lg font-medium"
                          >
                            {b.bullBrinco}
                          </button>
                        ))}
                      </div>
                    </div>
                  ));
                })}
              </div>
            </div>
          )}

          <div className="bg-base-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">
            Partos Previstos ({expectedCalvings.length})
          </h3>
          {expectedCalvings.length === 0 ? (
            <p className="text-gray-400 text-center py-8">Nenhum parto previsto ainda</p>
          ) : (
            <div className="space-y-3">
              {expectedCalvings.map((calving, index) => (
                <div
                  key={`${calving.cowId}-${index}`}
                  className="flex items-center justify-between p-4 bg-base-700 rounded-lg"
                >
                  <div>
                    <div className="font-medium text-white">
                      {calving.isFIV ? `Receptora: ${calving.cowBrinco}` : calving.cowBrinco}
                    </div>
                    <div className="text-sm text-gray-400">Pai: {calving.bullInfo}</div>
                    {calving.isFIV && calving.donorInfo && (
                      <div className="text-sm text-purple-400">Mae (Doadora): {calving.donorInfo}</div>
                    )}
                    {calving.isFIV && (
                      <span className="inline-block mt-1 px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded">
                        FIV
                      </span>
                    )}
                    {calving.isRepasse && (
                      <span className="inline-block mt-1 px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded">
                        Repasse
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-white">
                      {formatDate(calving.expectedDate)}
                    </div>
                    <div className="text-xs text-gray-400">
                      {Math.max(0, Math.ceil(
                        (new Date(calving.expectedDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                      ))}{' '}
                      dias
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        </div>
      )}

      {/* TAB: Vazias - Vacas com diagnóstico final negativo */}
      {activeTab === 'vazias' && (() => {
        const searchLower = tabSearch.toLowerCase();
        const filteredEmpty = searchLower
          ? emptyCows.filter((cow) => cow.cowBrinco.toLowerCase().includes(searchLower) || cow.cowNome?.toLowerCase().includes(searchLower))
          : emptyCows;

        return (
          <div className="space-y-4">
            <div className="bg-base-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">
                  Vacas Vazias ({emptyCows.length})
                </h3>
                {emptyCows.length > 0 && (
                  <input
                    type="text"
                    placeholder="Buscar por brinco ou nome..."
                    value={tabSearch}
                    onChange={(e) => setTabSearch(e.target.value)}
                    className="bg-base-700 border border-base-600 rounded-lg px-3 py-1.5 text-white text-sm w-48"
                  />
                )}
              </div>

              {emptyCows.length === 0 ? (
                <p className="text-gray-400 text-center py-8">
                  Nenhuma vaca classificada como vazia nesta estacao
                </p>
              ) : (
                <div className="space-y-2">
                  {filteredEmpty.map((cow) => (
                    <div
                      key={cow.coverageId}
                      className="flex items-center justify-between p-3 bg-base-700 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-white">{cow.cowBrinco}</span>
                        {cow.cowNome && (
                          <span className="text-sm text-gray-400">{cow.cowNome}</span>
                        )}
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          cow.hadRepasse
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {cow.hadRepasse ? 'Vazia (pos-repasse)' : 'Vazia'}
                        </span>
                        <span className="px-2 py-0.5 bg-base-600 text-gray-300 text-xs rounded">
                          {typeLabels[cow.coverageType]}
                        </span>
                      </div>
                      <div className="text-right">
                        {cow.diagnosisDate && (
                          <div className="text-sm text-gray-400">
                            DG: {formatDate(cow.diagnosisDate)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default BreedingSeasonManager;
