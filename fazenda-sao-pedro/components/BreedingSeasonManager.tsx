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
import {
  exportBreedingSeasonToCSV,
  exportBreedingSeasonToPDF,
} from '../utils/fileUtils';

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
  allAnimals: Animal[];
  onSubmit: (data: Omit<CoverageRecord, 'id' | 'expectedCalvingDate'>) => void;
  onCancel: () => void;
}> = ({ eligibleCows, availableBulls, allAnimals, onSubmit, onCancel }) => {
  const [cowId, setCowId] = useState('');
  const [cowSearch, setCowSearch] = useState('');
  const [type, setType] = useState<CoverageType>('natural');
  const [bullId, setBullId] = useState('');
  const [bullSearch, setBullSearch] = useState('');
  const [semenCode, setSemenCode] = useState('');
  // Campos específicos para FIV (doadora/mãe biológica)
  const [donorCowBrinco, setDonorCowBrinco] = useState('');
  const [donorCowSearch, setDonorCowSearch] = useState('');
  const [donorCowId, setDonorCowId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [technician, setTechnician] = useState('');
  const [notes, setNotes] = useState('');

  const selectedCow = eligibleCows.find((c) => c.id === cowId);
  const selectedBull = availableBulls.find((b) => b.id === bullId);

  // Filtra vacas pela busca
  const filteredCows = useMemo(() => {
    if (!cowSearch.trim()) return eligibleCows;
    const search = cowSearch.toLowerCase();
    return eligibleCows.filter(
      (cow) =>
        cow.brinco.toLowerCase().includes(search) ||
        cow.nome?.toLowerCase().includes(search)
    );
  }, [eligibleCows, cowSearch]);

  // Filtra touros pela busca
  const filteredBulls = useMemo(() => {
    if (!bullSearch.trim()) return availableBulls;
    const search = bullSearch.toLowerCase();
    return availableBulls.filter(
      (bull) =>
        bull.brinco.toLowerCase().includes(search) ||
        bull.nome?.toLowerCase().includes(search)
    );
  }, [availableBulls, bullSearch]);

  // Filtra doadoras para FIV (todas as fêmeas do plantel)
  const eligibleDonors = useMemo(() => {
    return allAnimals.filter((a) => a.sexo === 'Fêmea');
  }, [allAnimals]);

  const filteredDonors = useMemo(() => {
    if (!donorCowSearch.trim()) return eligibleDonors.slice(0, 50); // Limita para performance
    const search = donorCowSearch.toLowerCase();
    return eligibleDonors.filter(
      (cow) =>
        cow.brinco.toLowerCase().includes(search) ||
        cow.nome?.toLowerCase().includes(search)
    );
  }, [eligibleDonors, donorCowSearch]);

  // Quando o brinco da doadora é digitado, tenta encontrar no plantel
  const selectedDonor = useMemo(() => {
    if (!donorCowBrinco.trim()) return null;
    return allAnimals.find(
      (a) => a.brinco.toLowerCase() === donorCowBrinco.toLowerCase() && a.sexo === 'Fêmea'
    );
  }, [allAnimals, donorCowBrinco]);

  // Auto-preenche o ID quando encontra a doadora no plantel
  React.useEffect(() => {
    if (selectedDonor) {
      setDonorCowId(selectedDonor.id);
    } else {
      setDonorCowId('');
    }
  }, [selectedDonor]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (cowId && date) {
      onSubmit({
        cowId,
        cowBrinco: selectedCow?.brinco || '',
        bullId: type === 'natural' ? bullId : undefined,
        bullBrinco: type === 'natural' ? selectedBull?.brinco : undefined,
        semenCode: type !== 'natural' ? semenCode : undefined,
        // Campos específicos para FIV (doadora/mãe biológica)
        donorCowId: type === 'fiv' && donorCowId ? donorCowId : undefined,
        donorCowBrinco: type === 'fiv' && donorCowBrinco ? donorCowBrinco : undefined,
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
        <label className="block text-sm text-gray-400 mb-1">
          Vaca ({eligibleCows.length} disponiveis)
        </label>
        <input
          type="text"
          value={cowSearch}
          onChange={(e) => setCowSearch(e.target.value)}
          placeholder="Buscar por brinco ou nome..."
          className="w-full bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-white mb-2"
        />
        <select
          value={cowId}
          onChange={(e) => setCowId(e.target.value)}
          className="w-full bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-white"
          required
          size={5}
        >
          <option value="">Selecione...</option>
          {filteredCows.map((cow) => (
            <option key={cow.id} value={cow.id}>
              {cow.brinco} - {cow.nome || 'Sem nome'}
            </option>
          ))}
        </select>
        {cowId && selectedCow && (
          <div className="mt-2 text-sm text-emerald-400">
            Selecionada: {selectedCow.brinco} - {selectedCow.nome || 'Sem nome'}
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1">Tipo de Cobertura</label>
        <div className="grid grid-cols-4 gap-2">
          {(['natural', 'ia', 'iatf', 'fiv'] as CoverageType[]).map((t) => (
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
          <label className="block text-sm text-gray-400 mb-1">
            Touro ({availableBulls.length} disponiveis)
          </label>
          <input
            type="text"
            value={bullSearch}
            onChange={(e) => setBullSearch(e.target.value)}
            placeholder="Buscar por brinco ou nome..."
            className="w-full bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-white mb-2"
          />
          <select
            value={bullId}
            onChange={(e) => setBullId(e.target.value)}
            className="w-full bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-white"
            required
            size={5}
          >
            <option value="">Selecione...</option>
            {filteredBulls.map((bull) => (
              <option key={bull.id} value={bull.id}>
                {bull.brinco} - {bull.nome || 'Sem nome'}
              </option>
            ))}
          </select>
          {bullId && selectedBull && (
            <div className="mt-2 text-sm text-emerald-400">
              Selecionado: {selectedBull.brinco} - {selectedBull.nome || 'Sem nome'}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Codigo do Semen (Nome do Pai)
            </label>
            <input
              type="text"
              value={semenCode}
              onChange={(e) => setSemenCode(e.target.value)}
              placeholder="Ex: NETUNO FIV DA ESTIVA"
              className="w-full bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-white"
              required
            />
            <p className="text-xs text-gray-500 mt-1">Este codigo sera registrado como nome do pai na genealogia</p>
          </div>

          {/* Campo de doadora apenas para FIV */}
          {type === 'fiv' && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Brinco da Mae (Doadora do Embriao)
              </label>
              <input
                type="text"
                value={donorCowBrinco}
                onChange={(e) => setDonorCowBrinco(e.target.value)}
                placeholder="Digite o brinco da doadora..."
                className="w-full bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-white mb-2"
              />
              {selectedDonor ? (
                <div className="p-3 bg-emerald-900/30 border border-emerald-600 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400">✓</span>
                    <span className="text-emerald-400 font-medium">Doadora encontrada no plantel</span>
                  </div>
                  <div className="text-sm text-gray-300 mt-1">
                    {selectedDonor.brinco} - {selectedDonor.nome || 'Sem nome'} ({selectedDonor.raca})
                  </div>
                  <p className="text-xs text-emerald-500 mt-1">
                    Os dados de genealogia serao vinculados automaticamente
                  </p>
                </div>
              ) : donorCowBrinco ? (
                <div className="p-3 bg-amber-900/30 border border-amber-600 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-400">!</span>
                    <span className="text-amber-400 font-medium">Doadora nao encontrada no plantel</span>
                  </div>
                  <p className="text-xs text-amber-500 mt-1">
                    O brinco sera salvo, mas sem vinculo automatico de genealogia
                  </p>
                </div>
              ) : null}
              {!donorCowBrinco && (
                <div>
                  <p className="text-xs text-gray-500 mb-2">Ou selecione da lista:</p>
                  <input
                    type="text"
                    value={donorCowSearch}
                    onChange={(e) => setDonorCowSearch(e.target.value)}
                    placeholder="Buscar doadora por brinco ou nome..."
                    className="w-full bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-white mb-2"
                  />
                  <select
                    value={donorCowId}
                    onChange={(e) => {
                      const donor = eligibleDonors.find((d) => d.id === e.target.value);
                      if (donor) {
                        setDonorCowId(donor.id);
                        setDonorCowBrinco(donor.brinco);
                      }
                    }}
                    className="w-full bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-white"
                    size={4}
                  >
                    <option value="">Selecione uma doadora...</option>
                    {filteredDonors.map((donor) => (
                      <option key={donor.id} value={donor.id}>
                        {donor.brinco} - {donor.nome || 'Sem nome'}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <p className="text-xs text-gray-500 mt-2">
                A vaca selecionada acima ({selectedCow?.brinco || 'receptora'}) sera a receptora do embriao
              </p>
            </div>
          )}
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
        </div>
      ) : (
        <div className="grid gap-4">
          {sortedSeasons.map((season) => (
            <div
              key={season.id}
              className="bg-base-800 rounded-xl p-4 hover:bg-base-750 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <div
                  className="flex-1 cursor-pointer"
                  onClick={() => onSelectSeason(season)}
                >
                  <h4 className="font-semibold text-white">{season.name}</h4>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={season.status} />
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
              </div>
              <div
                className="cursor-pointer"
                onClick={() => onSelectSeason(season)}
              >
                <div className="text-sm text-gray-400">
                  {new Date(season.startDate).toLocaleDateString('pt-BR')} -{' '}
                  {new Date(season.endDate).toLocaleDateString('pt-BR')}
                </div>
                <div className="flex gap-4 mt-2 text-xs text-gray-500">
                  <span>{season.exposedCowIds?.length || 0} vacas expostas</span>
                  <span>{season.coverageRecords?.length || 0} coberturas</span>
                </div>
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
            onDeleteSeason={onDeleteSeason}
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
        <div className="flex items-center gap-2">
          {/* Botões de Export */}
          <button
            onClick={() => exportBreedingSeasonToCSV(currentSeason, animals)}
            className="px-3 py-2 bg-base-700 text-gray-300 rounded-lg hover:bg-base-600 text-sm flex items-center gap-1"
            title="Exportar para CSV"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            CSV
          </button>
          <button
            onClick={() => exportBreedingSeasonToPDF(currentSeason, animals)}
            className="px-3 py-2 bg-base-700 text-gray-300 rounded-lg hover:bg-base-600 text-sm flex items-center gap-1"
            title="Exportar para PDF"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V8z" clipRule="evenodd" />
            </svg>
            PDF
          </button>
          <button
            onClick={() => setShowCoverageForm(true)}
            className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-dark"
          >
            + Nova Cobertura
          </button>
        </div>
      </div>

      {/* Modal de nova cobertura */}
      {showCoverageForm && (
        <CoverageForm
          eligibleCows={eligibleCows}
          availableBulls={availableBulls}
          allAnimals={animals}
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
                <div className="text-2xl font-bold text-white">{metrics.coveragesByType.fiv}</div>
                <div className="text-sm text-gray-400">FIV</div>
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
                      <div className="font-medium text-white">
                        {coverage.type === 'fiv' ? (
                          <span>Receptora: {coverage.cowBrinco}</span>
                        ) : (
                          coverage.cowBrinco
                        )}
                      </div>
                      <div className="text-sm text-gray-400">
                        {coverage.type.toUpperCase()} • Pai:{' '}
                        {coverage.bullBrinco || coverage.semenCode || 'Desconhecido'}
                      </div>
                      {coverage.type === 'fiv' && coverage.donorCowBrinco && (
                        <div className="text-sm text-purple-400">
                          Mae (Doadora): {coverage.donorCowBrinco}
                        </div>
                      )}
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
                    <div className="font-medium text-white">
                      {calving.isFIV ? (
                        <span>Receptora: {calving.cowBrinco}</span>
                      ) : (
                        calving.cowBrinco
                      )}
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
