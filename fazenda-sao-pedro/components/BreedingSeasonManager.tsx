import React, { useState, useMemo } from 'react';
import {
  Animal,
  BreedingSeason,
  BreedingSeasonStatus,
  CoverageType,
  CoverageRecord,
} from '../types';
import {
  calculateBreedingMetrics,
  BreedingSeasonMetrics,
  getEligibleCows,
  getAvailableBulls,
  getExpectedCalvings,
} from '../services/breedingSeasonService';

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
}

// ============================================
// SUB-COMPONENTES
// ============================================

const StatusBadge: React.FC<{ status: BreedingSeasonStatus }> = ({ status }) => {
  const config = {
    planning: { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'Planejamento' },
    active: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Ativa' },
    finished: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Finalizada' },
    cancelled: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Cancelada' },
  };

  const c = config[status];

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
};

const MetricCard: React.FC<{
  label: string;
  value: string | number;
  unit?: string;
  icon: string;
  color: string;
}> = ({ label, value, unit, icon, color }) => (
  <div className={`bg-base-800 rounded-lg p-4 border-l-4 ${color}`}>
    <div className="flex items-center justify-between">
      <span className="text-2xl">{icon}</span>
      <div className="text-right">
        <div className="text-xl font-bold text-white">
          {value}
          {unit && <span className="text-sm text-gray-400 ml-1">{unit}</span>}
        </div>
        <div className="text-xs text-gray-400">{label}</div>
      </div>
    </div>
  </div>
);

// ============================================
// FORMULÁRIO DE NOVA ESTAÇÃO
// ============================================

const NewSeasonForm: React.FC<{
  onSubmit: (data: { name: string; startDate: Date; endDate: Date }) => void;
  onCancel: () => void;
}> = ({ onSubmit, onCancel }) => {
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name && startDate && endDate) {
      onSubmit({
        name,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-base-800 rounded-xl p-6 space-y-4">
      <h3 className="text-lg font-semibold text-white">Nova Estacao de Monta</h3>

      <div>
        <label className="block text-sm text-gray-400 mb-1">Nome</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Estacao 2024/2025"
          className="w-full bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-white"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Inicio</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-white"
            required
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Fim</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-white"
            required
          />
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2 bg-base-700 text-gray-300 rounded-lg hover:bg-base-600"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="flex-1 px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-dark"
        >
          Criar Estacao
        </button>
      </div>
    </form>
  );
};

// ============================================
// FORMULÁRIO DE COBERTURA
// ============================================

const CoverageForm: React.FC<{
  eligibleCows: Animal[];
  availableBulls: Animal[];
  onSubmit: (data: Omit<CoverageRecord, 'id' | 'expectedCalvingDate'>) => void;
  onCancel: () => void;
}> = ({ eligibleCows, availableBulls, onSubmit, onCancel }) => {
  const [cowId, setCowId] = useState('');
  const [type, setType] = useState<CoverageType>('natural');
  const [bullId, setBullId] = useState('');
  const [semenCode, setSemenCode] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [technician, setTechnician] = useState('');
  const [notes, setNotes] = useState('');

  const selectedCow = eligibleCows.find((c) => c.id === cowId);
  const selectedBull = availableBulls.find((b) => b.id === bullId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (cowId && date) {
      onSubmit({
        cowId,
        cowBrinco: selectedCow?.brinco || '',
        bullId: type === 'natural' ? bullId : undefined,
        bullBrinco: type === 'natural' ? selectedBull?.brinco : undefined,
        semenCode: type !== 'natural' ? semenCode : undefined,
        type,
        date: new Date(date),
        technician: technician || undefined,
        notes: notes || undefined,
        pregnancyResult: 'pending',
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-base-800 rounded-xl p-6 space-y-4">
      <h3 className="text-lg font-semibold text-white">Registrar Cobertura</h3>

      <div>
        <label className="block text-sm text-gray-400 mb-1">Vaca</label>
        <select
          value={cowId}
          onChange={(e) => setCowId(e.target.value)}
          className="w-full bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-white"
          required
        >
          <option value="">Selecione...</option>
          {eligibleCows.map((cow) => (
            <option key={cow.id} value={cow.id}>
              {cow.brinco} - {cow.nome || 'Sem nome'}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1">Tipo de Cobertura</label>
        <div className="grid grid-cols-4 gap-2">
          {(['natural', 'ia', 'iatf', 'te'] as CoverageType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                type === t
                  ? 'bg-brand-primary text-white'
                  : 'bg-base-700 text-gray-300 hover:bg-base-600'
              }`}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {type === 'natural' ? (
        <div>
          <label className="block text-sm text-gray-400 mb-1">Touro</label>
          <select
            value={bullId}
            onChange={(e) => setBullId(e.target.value)}
            className="w-full bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-white"
            required
          >
            <option value="">Selecione...</option>
            {availableBulls.map((bull) => (
              <option key={bull.id} value={bull.id}>
                {bull.brinco} - {bull.nome || 'Sem nome'}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div>
          <label className="block text-sm text-gray-400 mb-1">Codigo do Semen</label>
          <input
            type="text"
            value={semenCode}
            onChange={(e) => setSemenCode(e.target.value)}
            placeholder="Ex: NETUNO TE DA ESTIVA"
            className="w-full bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-white"
            required
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Data</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-white"
            required
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Tecnico (opcional)</label>
          <input
            type="text"
            value={technician}
            onChange={(e) => setTechnician(e.target.value)}
            placeholder="Nome do tecnico"
            className="w-full bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-white"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1">Observacoes (opcional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Observacoes sobre a cobertura..."
          className="w-full bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-white h-20"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2 bg-base-700 text-gray-300 rounded-lg hover:bg-base-600"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="flex-1 px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-dark"
        >
          Registrar
        </button>
      </div>
    </form>
  );
};

// ============================================
// LISTA DE ESTAÇÕES
// ============================================

const SeasonsList: React.FC<{
  seasons: BreedingSeason[];
  onSelectSeason: (season: BreedingSeason) => void;
  onCreateNew: () => void;
}> = ({ seasons, onSelectSeason, onCreateNew }) => {
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
        </div>
      ) : (
        <div className="grid gap-4">
          {sortedSeasons.map((season) => (
            <div
              key={season.id}
              onClick={() => onSelectSeason(season)}
              className="bg-base-800 rounded-xl p-4 cursor-pointer hover:bg-base-750 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-white">{season.name}</h4>
                <StatusBadge status={season.status} />
              </div>
              <div className="text-sm text-gray-400">
                {new Date(season.startDate).toLocaleDateString('pt-BR')} -{' '}
                {new Date(season.endDate).toLocaleDateString('pt-BR')}
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
}) => {
  const [selectedSeason, setSelectedSeason] = useState<BreedingSeason | null>(null);
  const [showNewSeasonForm, setShowNewSeasonForm] = useState(false);
  const [showCoverageForm, setShowCoverageForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'coverages' | 'diagnostics' | 'calvings'>(
    'overview'
  );

  // Dados calculados
  const eligibleCows = useMemo(() => getEligibleCows(animals), [animals]);
  const availableBulls = useMemo(() => getAvailableBulls(animals), [animals]);
  const metrics = useMemo(
    () => (selectedSeason ? calculateBreedingMetrics(selectedSeason, animals) : null),
    [selectedSeason, animals]
  );
  const expectedCalvings = useMemo(
    () => (selectedSeason ? getExpectedCalvings(selectedSeason) : []),
    [selectedSeason]
  );

  // Handlers
  const handleCreateSeason = async (data: { name: string; startDate: Date; endDate: Date }) => {
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
    if (newSeason) {
      setSelectedSeason(newSeason);
    }
  };

  const handleAddCoverage = async (data: Omit<CoverageRecord, 'id' | 'expectedCalvingDate'>) => {
    if (!selectedSeason) return;
    await onAddCoverage(selectedSeason.id, data);
    // Atualiza a estacao selecionada com a nova cobertura
    const updatedSeason = seasons.find((s) => s.id === selectedSeason.id);
    if (updatedSeason) {
      setSelectedSeason(updatedSeason);
    }
    setShowCoverageForm(false);
  };

  const handleUpdateDiagnosis = async (
    coverageId: string,
    result: 'positive' | 'negative'
  ) => {
    if (!selectedSeason) return;
    await onUpdateDiagnosis(selectedSeason.id, coverageId, result, new Date());
  };

  const handleBack = () => {
    setSelectedSeason(null);
    setActiveTab('overview');
  };

  // Se nenhuma estacao selecionada, mostra lista
  if (!selectedSeason) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Estacao de Monta</h2>
          <p className="text-sm text-gray-400">Gerencie a reproducao do seu rebanho</p>
        </div>

        {showNewSeasonForm ? (
          <NewSeasonForm
            onSubmit={handleCreateSeason}
            onCancel={() => setShowNewSeasonForm(false)}
          />
        ) : (
          <SeasonsList
            seasons={seasons}
            onSelectSeason={setSelectedSeason}
            onCreateNew={() => setShowNewSeasonForm(true)}
          />
        )}
      </div>
    );
  }

  // Atualiza selectedSeason quando seasons muda
  const currentSeason = seasons.find((s) => s.id === selectedSeason.id) || selectedSeason;

  // Estacao selecionada
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={handleBack}
            className="text-sm text-gray-400 hover:text-white mb-2 flex items-center gap-1"
          >
            ← Voltar para lista
          </button>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-white">{currentSeason.name}</h2>
            <StatusBadge status={currentSeason.status} />
          </div>
          <p className="text-sm text-gray-400">
            {new Date(currentSeason.startDate).toLocaleDateString('pt-BR')} -{' '}
            {new Date(currentSeason.endDate).toLocaleDateString('pt-BR')}
          </p>
        </div>
        <button
          onClick={() => setShowCoverageForm(true)}
          className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-dark"
        >
          + Nova Cobertura
        </button>
      </div>

      {/* Modal de nova cobertura */}
      {showCoverageForm && (
        <CoverageForm
          eligibleCows={eligibleCows}
          availableBulls={availableBulls}
          onSubmit={handleAddCoverage}
          onCancel={() => setShowCoverageForm(false)}
        />
      )}

      {/* Metricas principais */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            label="Vacas Expostas"
            value={metrics.totalExposed}
            icon="🐄"
            color="border-blue-500"
          />
          <MetricCard
            label="Cobertas"
            value={metrics.totalCovered}
            icon="💕"
            color="border-pink-500"
          />
          <MetricCard
            label="Prenhes"
            value={metrics.totalPregnant}
            icon="🤰"
            color="border-emerald-500"
          />
          <MetricCard
            label="Taxa de Prenhez"
            value={metrics.pregnancyRate}
            unit="%"
            icon="📊"
            color="border-purple-500"
          />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-base-700">
        {(['overview', 'coverages', 'diagnostics', 'calvings'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'text-brand-primary border-b-2 border-brand-primary'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab === 'overview' && 'Visao Geral'}
            {tab === 'coverages' && 'Coberturas'}
            {tab === 'diagnostics' && 'Diagnosticos'}
            {tab === 'calvings' && 'Partos Previstos'}
          </button>
        ))}
      </div>

      {/* Conteudo das tabs */}
      {activeTab === 'overview' && metrics && (
        <div className="space-y-6">
          {/* Taxas */}
          <div className="bg-base-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Indicadores de Eficiencia</h3>
            <div className="grid grid-cols-3 gap-6">
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
                <div className="text-3xl font-bold text-purple-400">{metrics.pregnancyRate}%</div>
                <div className="text-sm text-gray-400">Taxa de Prenhez</div>
                <div className="text-xs text-gray-500">Prenhes / Expostas</div>
              </div>
            </div>
          </div>

          {/* Coberturas por tipo */}
          <div className="bg-base-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Coberturas por Tipo</h3>
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center p-4 bg-base-700 rounded-lg">
                <div className="text-2xl font-bold text-white">{metrics.coveragesByType.natural}</div>
                <div className="text-sm text-gray-400">Natural</div>
              </div>
              <div className="text-center p-4 bg-base-700 rounded-lg">
                <div className="text-2xl font-bold text-white">{metrics.coveragesByType.ia}</div>
                <div className="text-sm text-gray-400">IA</div>
              </div>
              <div className="text-center p-4 bg-base-700 rounded-lg">
                <div className="text-2xl font-bold text-white">{metrics.coveragesByType.iatf}</div>
                <div className="text-sm text-gray-400">IATF</div>
              </div>
              <div className="text-center p-4 bg-base-700 rounded-lg">
                <div className="text-2xl font-bold text-white">{metrics.coveragesByType.te}</div>
                <div className="text-sm text-gray-400">TE</div>
              </div>
            </div>
          </div>

          {/* Performance por touro */}
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

      {activeTab === 'coverages' && (
        <div className="bg-base-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">
            Historico de Coberturas ({currentSeason.coverageRecords?.length || 0})
          </h3>
          {!currentSeason.coverageRecords?.length ? (
            <p className="text-gray-400 text-center py-8">Nenhuma cobertura registrada</p>
          ) : (
            <div className="space-y-3">
              {[...currentSeason.coverageRecords]
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .map((coverage) => (
                  <div
                    key={coverage.id}
                    className="flex items-center justify-between p-4 bg-base-700 rounded-lg"
                  >
                    <div>
                      <div className="font-medium text-white">{coverage.cowBrinco}</div>
                      <div className="text-sm text-gray-400">
                        {coverage.type.toUpperCase()} •{' '}
                        {coverage.bullBrinco || coverage.semenCode || 'Desconhecido'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(coverage.date).toLocaleDateString('pt-BR')}
                      </div>
                    </div>
                    <div className="text-right">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          coverage.pregnancyResult === 'positive'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : coverage.pregnancyResult === 'negative'
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-amber-500/20 text-amber-400'
                        }`}
                      >
                        {coverage.pregnancyResult === 'positive'
                          ? 'Prenhe'
                          : coverage.pregnancyResult === 'negative'
                          ? 'Vazia'
                          : 'Pendente'}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'diagnostics' && metrics && (
        <div className="bg-base-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">
            Diagnosticos Pendentes ({metrics.pregnancyChecksDue.length})
          </h3>
          {metrics.pregnancyChecksDue.length === 0 ? (
            <p className="text-gray-400 text-center py-8">Nenhum diagnostico pendente no momento</p>
          ) : (
            <div className="space-y-3">
              {metrics.pregnancyChecksDue.map((check) => (
                <div
                  key={check.cowId}
                  className="flex items-center justify-between p-4 bg-base-700 rounded-lg"
                >
                  <div>
                    <div className="font-medium text-white">{check.cowBrinco}</div>
                    <div className="text-sm text-gray-400">
                      Previsto para: {new Date(check.dueDate).toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const coverage = currentSeason.coverageRecords?.find(
                          (c) => c.cowId === check.cowId && c.pregnancyResult === 'pending'
                        );
                        if (coverage) {
                          handleUpdateDiagnosis(coverage.id, 'positive');
                        }
                      }}
                      className="px-3 py-1 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700"
                    >
                      Prenhe
                    </button>
                    <button
                      onClick={() => {
                        const coverage = currentSeason.coverageRecords?.find(
                          (c) => c.cowId === check.cowId && c.pregnancyResult === 'pending'
                        );
                        if (coverage) {
                          handleUpdateDiagnosis(coverage.id, 'negative');
                        }
                      }}
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
      )}

      {activeTab === 'calvings' && (
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
                    <div className="font-medium text-white">{calving.cowBrinco}</div>
                    <div className="text-sm text-gray-400">Pai: {calving.bullInfo}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-white">
                      {new Date(calving.expectedDate).toLocaleDateString('pt-BR')}
                    </div>
                    <div className="text-xs text-gray-400">
                      {Math.ceil(
                        (new Date(calving.expectedDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                      )}{' '}
                      dias
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BreedingSeasonManager;
