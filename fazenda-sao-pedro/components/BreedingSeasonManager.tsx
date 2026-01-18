import React, { useState, useMemo, useCallback } from 'react';
import {
  Animal,
  BreedingSeason,
  BreedingSeasonStatus,
  CoverageType,
  Sexo,
} from '../types';
import {
  calculateBreedingMetrics,
  BreedingSeasonMetrics,
  getEligibleCows,
  getAvailableBulls,
  getExpectedCalvings,
} from '../services/breedingSeasonService';

interface BreedingSeasonManagerProps {
  season: BreedingSeason | null;
  animals: Animal[];
  onCreateSeason: (season: Omit<BreedingSeason, 'id'>) => Promise<void>;
  onUpdateSeason: (season: BreedingSeason) => Promise<void>;
  onAddCoverage: (
    cowId: string,
    cowBrinco: string,
    bullId: string | undefined,
    bullBrinco: string | undefined,
    semenCode: string | undefined,
    type: CoverageType,
    date: Date,
    technician?: string,
    notes?: string
  ) => Promise<void>;
  onUpdatePregnancyResult: (
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
      <h3 className="text-lg font-semibold text-white">Nova Estação de Monta</h3>

      <div>
        <label className="block text-sm text-gray-400 mb-1">Nome</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Estação 2024/2025"
          className="w-full bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-white"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Início</label>
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
          Criar Estação
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
  onSubmit: (data: {
    cowId: string;
    cowBrinco: string;
    bullId?: string;
    bullBrinco?: string;
    semenCode?: string;
    type: CoverageType;
    date: Date;
    technician?: string;
    notes?: string;
  }) => void;
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
          <label className="block text-sm text-gray-400 mb-1">Código do Sêmen</label>
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
          <label className="block text-sm text-gray-400 mb-1">Técnico (opcional)</label>
          <input
            type="text"
            value={technician}
            onChange={(e) => setTechnician(e.target.value)}
            placeholder="Nome do técnico"
            className="w-full bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-white"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1">Observações (opcional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Observações sobre a cobertura..."
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
// COMPONENTE PRINCIPAL
// ============================================

const BreedingSeasonManager: React.FC<BreedingSeasonManagerProps> = ({
  season,
  animals,
  onCreateSeason,
  onUpdateSeason,
  onAddCoverage,
  onUpdatePregnancyResult,
}) => {
  const [showNewSeasonForm, setShowNewSeasonForm] = useState(false);
  const [showCoverageForm, setShowCoverageForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'coverages' | 'diagnostics' | 'calvings'>(
    'overview'
  );

  // Dados calculados
  const eligibleCows = useMemo(() => getEligibleCows(animals), [animals]);
  const availableBulls = useMemo(() => getAvailableBulls(animals), [animals]);
  const metrics = useMemo(
    () => (season ? calculateBreedingMetrics(season, animals) : null),
    [season, animals]
  );
  const expectedCalvings = useMemo(() => (season ? getExpectedCalvings(season) : []), [season]);

  // Handlers
  const handleCreateSeason = async (data: { name: string; startDate: Date; endDate: Date }) => {
    await onCreateSeason({
      userId: '', // Será preenchido no hook
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
  };

  const handleAddCoverage = async (data: {
    cowId: string;
    cowBrinco: string;
    bullId?: string;
    bullBrinco?: string;
    semenCode?: string;
    type: CoverageType;
    date: Date;
    technician?: string;
    notes?: string;
  }) => {
    await onAddCoverage(
      data.cowId,
      data.cowBrinco,
      data.bullId,
      data.bullBrinco,
      data.semenCode,
      data.type,
      data.date,
      data.technician,
      data.notes
    );
    setShowCoverageForm(false);
  };

  // Se não há estação ativa
  if (!season) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">Estação de Monta</h2>
            <p className="text-sm text-gray-400">Gerencie a reprodução do seu rebanho</p>
          </div>
        </div>

        {showNewSeasonForm ? (
          <NewSeasonForm
            onSubmit={handleCreateSeason}
            onCancel={() => setShowNewSeasonForm(false)}
          />
        ) : (
          <div className="bg-base-800 rounded-xl p-8 text-center">
            <div className="text-6xl mb-4">🐄</div>
            <h3 className="text-xl font-semibold text-white mb-2">
              Nenhuma estação de monta ativa
            </h3>
            <p className="text-gray-400 mb-6">
              Crie uma nova estação para começar a gerenciar as coberturas e diagnósticos de gestação.
            </p>
            <button
              onClick={() => setShowNewSeasonForm(true)}
              className="px-6 py-3 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-dark"
            >
              Criar Nova Estação
            </button>
          </div>
        )}
      </div>
    );
  }

  // Estação ativa
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-white">{season.name}</h2>
            <StatusBadge status={season.status} />
          </div>
          <p className="text-sm text-gray-400">
            {new Date(season.startDate).toLocaleDateString('pt-BR')} -{' '}
            {new Date(season.endDate).toLocaleDateString('pt-BR')}
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

      {/* Métricas principais */}
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
            {tab === 'overview' && 'Visão Geral'}
            {tab === 'coverages' && 'Coberturas'}
            {tab === 'diagnostics' && 'Diagnósticos'}
            {tab === 'calvings' && 'Partos Previstos'}
          </button>
        ))}
      </div>

      {/* Conteúdo das tabs */}
      {activeTab === 'overview' && metrics && (
        <div className="space-y-6">
          {/* Taxas */}
          <div className="bg-base-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Indicadores de Eficiência</h3>
            <div className="grid grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-emerald-400">
                  {metrics.serviceRate}%
                </div>
                <div className="text-sm text-gray-400">Taxa de Serviço</div>
                <div className="text-xs text-gray-500">Cobertas / Expostas</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-400">
                  {metrics.conceptionRate}%
                </div>
                <div className="text-sm text-gray-400">Taxa de Concepção</div>
                <div className="text-xs text-gray-500">Prenhes / Cobertas</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-400">
                  {metrics.pregnancyRate}%
                </div>
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
                <div className="text-2xl font-bold text-white">
                  {metrics.coveragesByType.natural}
                </div>
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
              <h3 className="text-lg font-semibold text-white mb-4">Performance por Touro/Sêmen</h3>
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
                        {bull.count > 0
                          ? Math.round((bull.pregnancies / bull.count) * 100)
                          : 0}
                        %
                      </div>
                      <div className="text-xs text-gray-400">
                        {bull.pregnancies} prenhes
                      </div>
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
            Histórico de Coberturas ({season.coverageRecords.length})
          </h3>
          {season.coverageRecords.length === 0 ? (
            <p className="text-gray-400 text-center py-8">Nenhuma cobertura registrada</p>
          ) : (
            <div className="space-y-3">
              {season.coverageRecords
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
            Diagnósticos Pendentes ({metrics.pregnancyChecksDue.length})
          </h3>
          {metrics.pregnancyChecksDue.length === 0 ? (
            <p className="text-gray-400 text-center py-8">
              Nenhum diagnóstico pendente no momento
            </p>
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
                        const coverage = season.coverageRecords.find(
                          (c) => c.cowId === check.cowId && c.pregnancyResult === 'pending'
                        );
                        if (coverage) {
                          onUpdatePregnancyResult(coverage.id, 'positive', new Date());
                        }
                      }}
                      className="px-3 py-1 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700"
                    >
                      Prenhe
                    </button>
                    <button
                      onClick={() => {
                        const coverage = season.coverageRecords.find(
                          (c) => c.cowId === check.cowId && c.pregnancyResult === 'pending'
                        );
                        if (coverage) {
                          onUpdatePregnancyResult(coverage.id, 'negative', new Date());
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
            <p className="text-gray-400 text-center py-8">
              Nenhum parto previsto ainda
            </p>
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
                        (new Date(calving.expectedDate).getTime() - Date.now()) /
                          (1000 * 60 * 60 * 24)
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
