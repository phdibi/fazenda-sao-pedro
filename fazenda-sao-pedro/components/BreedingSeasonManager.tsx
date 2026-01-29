import React, { useState, useMemo, useCallback } from 'react';
import {
  Animal,
  BreedingSeason,
  BreedingSeasonStatus,
  CoverageType,
  CoverageRecord,
  RepasseData,
  RepasseBull,
  Sexo,
} from '../types';
import {
  calculateBreedingMetrics,
  BreedingSeasonMetrics,
  getEligibleCows,
  getAvailableBulls,
  getExpectedCalvings,
  getRepasseEligibleCows,
  getPendingPaternityRecords,
  getRepasseBulls,
  getRepasseBullLabel,
  hasPendingPaternity,
} from '../services/breedingSeasonService';
import {
  exportBreedingSeasonToCSV,
  exportBreedingSeasonToPDF,
} from '../utils/fileUtils';

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
}

// ============================================
// HELPERS
// ============================================

const formatDate = (d: Date | string | undefined): string => {
  if (!d) return '-';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('pt-BR');
};

const toInputDate = (d: Date | string | undefined): string => {
  if (!d) return '';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '';
  return date.toISOString().split('T')[0];
};

const typeLabels: Record<CoverageType, string> = {
  natural: 'Monta Natural',
  ia: 'IA',
  iatf: 'IATF',
  fiv: 'FIV',
};

const resultLabels: Record<string, string> = {
  positive: 'Prenhe',
  negative: 'Vazia',
  pending: 'Pendente',
};

const resultColors: Record<string, string> = {
  positive: 'bg-emerald-500/20 text-emerald-400',
  negative: 'bg-red-500/20 text-red-400',
  pending: 'bg-amber-500/20 text-amber-400',
};

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
// FORMULÁRIO DE NOVA ESTAÇÃO (com edição)
// ============================================

const SeasonForm: React.FC<{
  initialData?: { name: string; startDate: string; endDate: string; status?: BreedingSeasonStatus };
  onSubmit: (data: { name: string; startDate: Date; endDate: Date; status?: BreedingSeasonStatus }) => void;
  onCancel: () => void;
  isEdit?: boolean;
}> = ({ initialData, onSubmit, onCancel, isEdit }) => {
  const [name, setName] = useState(initialData?.name || '');
  const [startDate, setStartDate] = useState(initialData?.startDate || '');
  const [endDate, setEndDate] = useState(initialData?.endDate || '');
  const [status, setStatus] = useState<BreedingSeasonStatus>(initialData?.status || 'planning');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name && startDate && endDate) {
      if (endDate < startDate) {
        alert('A data de fim deve ser igual ou posterior à data de início.');
        return;
      }
      onSubmit({
        name,
        startDate: new Date(startDate + 'T00:00:00'),
        endDate: new Date(endDate + 'T00:00:00'),
        ...(isEdit ? { status } : {}),
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-base-800 rounded-xl p-6 space-y-4">
      <h3 className="text-lg font-semibold text-white">
        {isEdit ? 'Editar Estacao de Monta' : 'Nova Estacao de Monta'}
      </h3>

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
          <label className="block text-sm text-gray-400 mb-1">Inicio (Periodo da Estacao)</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-white"
            required
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Fim (Periodo da Estacao)</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-white"
            required
          />
        </div>
      </div>

      {isEdit && (
        <div>
          <label className="block text-sm text-gray-400 mb-1">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as BreedingSeasonStatus)}
            className="w-full bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-white"
          >
            <option value="planning">Planejamento</option>
            <option value="active">Ativa</option>
            <option value="finished">Finalizada</option>
            <option value="cancelled">Cancelada</option>
          </select>
        </div>
      )}

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
          {isEdit ? 'Salvar' : 'Criar Estacao'}
        </button>
      </div>
    </form>
  );
};

// ============================================
// FORMULÁRIO DE COBERTURA (criar/editar)
// ============================================

const CoverageForm: React.FC<{
  eligibleCows: Animal[];
  availableBulls: Animal[];
  allAnimals: Animal[];
  season: BreedingSeason;
  onSubmit: (data: Omit<CoverageRecord, 'id' | 'expectedCalvingDate'>) => void;
  onCancel: () => void;
  initialData?: CoverageRecord;
}> = ({ eligibleCows, availableBulls, allAnimals, season, onSubmit, onCancel, initialData }) => {
  const [cowId, setCowId] = useState(initialData?.cowId || '');
  const [cowSearch, setCowSearch] = useState('');
  const [type, setType] = useState<CoverageType>(initialData?.type || 'iatf');
  const [bullId, setBullId] = useState(initialData?.bullId || '');
  const [bullSearch, setBullSearch] = useState('');
  const [semenCode, setSemenCode] = useState(initialData?.semenCode || '');
  const [donorCowBrinco, setDonorCowBrinco] = useState(initialData?.donorCowBrinco || '');
  const [donorCowSearch, setDonorCowSearch] = useState('');
  const [donorCowId, setDonorCowId] = useState(initialData?.donorCowId || '');
  const [date, setDate] = useState(
    initialData ? toInputDate(initialData.date) : new Date().toISOString().split('T')[0]
  );
  const [technician, setTechnician] = useState(initialData?.technician || '');
  const [notes, setNotes] = useState(initialData?.notes || '');

  // Diagnóstico (editável na edição)
  const [pregnancyResult, setPregnancyResult] = useState<'positive' | 'negative' | 'pending'>(
    initialData?.pregnancyResult || 'pending'
  );
  const [pregnancyCheckDate, setPregnancyCheckDate] = useState(
    initialData?.pregnancyCheckDate ? toInputDate(initialData.pregnancyCheckDate) : ''
  );

  // Repasse (suporta 1 ou 2 touros)
  const [repasseEnabled, setRepasseEnabled] = useState(initialData?.repasse?.enabled || false);
  const initialRepasseBulls: RepasseBull[] = initialData?.repasse
    ? getRepasseBulls(initialData.repasse)
    : [];
  const [repasseBullIds, setRepasseBullIds] = useState<string[]>(
    initialRepasseBulls.map((b) => b.bullId)
  );
  const [repasseBullSearch, setRepasseBullSearch] = useState('');
  const [repasseNotes, setRepasseNotes] = useState(initialData?.repasse?.notes || '');
  const [repasseDiagResult, setRepasseDiagResult] = useState<'positive' | 'negative' | 'pending'>(
    initialData?.repasse?.diagnosisResult || 'pending'
  );
  const [repasseDiagDate, setRepasseDiagDate] = useState(
    initialData?.repasse?.diagnosisDate ? toInputDate(initialData.repasse.diagnosisDate) : ''
  );

  const selectedCow = useMemo(
    () => [...eligibleCows, ...allAnimals].find((c) => c.id === cowId),
    [eligibleCows, allAnimals, cowId]
  );
  const selectedBull = useMemo(
    () => availableBulls.find((b) => b.id === bullId),
    [availableBulls, bullId]
  );
  const selectedRepasseBulls = useMemo(
    () => repasseBullIds.map((id) => availableBulls.find((b) => b.id === id)).filter(Boolean) as Animal[],
    [availableBulls, repasseBullIds]
  );

  const filteredCows = useMemo(() => {
    if (!cowSearch.trim()) return eligibleCows.slice(0, 50);
    const search = cowSearch.toLowerCase();
    return eligibleCows.filter(
      (cow) =>
        cow.brinco.toLowerCase().includes(search) ||
        cow.nome?.toLowerCase().includes(search)
    );
  }, [eligibleCows, cowSearch]);

  const filteredBulls = useMemo(() => {
    if (!bullSearch.trim()) return availableBulls.slice(0, 50);
    const search = bullSearch.toLowerCase();
    return availableBulls.filter(
      (bull) =>
        bull.brinco.toLowerCase().includes(search) ||
        bull.nome?.toLowerCase().includes(search)
    );
  }, [availableBulls, bullSearch]);

  const filteredRepasseBulls = useMemo(() => {
    if (!repasseBullSearch.trim()) return availableBulls.slice(0, 50);
    const search = repasseBullSearch.toLowerCase();
    return availableBulls.filter(
      (bull) =>
        bull.brinco.toLowerCase().includes(search) ||
        bull.nome?.toLowerCase().includes(search)
    );
  }, [availableBulls, repasseBullSearch]);

  const eligibleDonors = useMemo(
    () => allAnimals.filter((a) => a.sexo === Sexo.Femea),
    [allAnimals]
  );

  const filteredDonors = useMemo(() => {
    if (!donorCowSearch.trim()) return eligibleDonors.slice(0, 50);
    const search = donorCowSearch.toLowerCase();
    return eligibleDonors.filter(
      (cow) =>
        cow.brinco.toLowerCase().includes(search) ||
        cow.nome?.toLowerCase().includes(search)
    );
  }, [eligibleDonors, donorCowSearch]);

  const selectedDonor = useMemo(() => {
    if (!donorCowBrinco.trim()) return null;
    return allAnimals.find(
      (a) => a.brinco.toLowerCase() === donorCowBrinco.toLowerCase() && a.sexo === Sexo.Femea
    );
  }, [allAnimals, donorCowBrinco]);

  React.useEffect(() => {
    if (selectedDonor) {
      setDonorCowId(selectedDonor.id);
    } else {
      setDonorCowId('');
    }
  }, [selectedDonor]);

  const isNatural = type === 'natural';
  const isFiv = type === 'fiv';
  const needsSemen = type === 'iatf' || type === 'ia' || type === 'fiv';
  const showRepasse = !!initialData && (type === 'iatf' || type === 'fiv' || type === 'ia');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cowId) return;

    const coverageDate = isNatural
      ? new Date(season.startDate)
      : new Date(date + 'T00:00:00');

    const repasseBullsArray: RepasseBull[] = selectedRepasseBulls.map((b) => ({
      bullId: b.id,
      bullBrinco: b.brinco,
    }));

    const repasse: RepasseData | undefined =
      repasseEnabled
        ? {
            enabled: true,
            bulls: repasseBullsArray.length > 0 ? repasseBullsArray : undefined,
            // Backward compat: set bullId/bullBrinco to first bull
            bullId: repasseBullsArray[0]?.bullId || undefined,
            bullBrinco: repasseBullsArray[0]?.bullBrinco || undefined,
            // Inicio do repasse: preserva existente, ou usa data do DG principal, ou data atual
            startDate: initialData?.repasse?.startDate
              ? new Date(initialData.repasse.startDate)
              : pregnancyCheckDate
                ? new Date(pregnancyCheckDate + 'T00:00:00')
                : new Date(),
            endDate: new Date(season.endDate),
            notes: repasseNotes || undefined,
            diagnosisDate: showRepasse && repasseDiagDate ? new Date(repasseDiagDate + 'T00:00:00') : undefined,
            diagnosisResult: showRepasse ? repasseDiagResult : 'pending',
            // Preserve existing confirmedSireId if editing
            confirmedSireId: initialData?.repasse?.confirmedSireId,
            confirmedSireBrinco: initialData?.repasse?.confirmedSireBrinco,
          }
        : undefined;

    onSubmit({
      cowId,
      cowBrinco: selectedCow?.brinco || '',
      bullId: isNatural ? bullId : undefined,
      bullBrinco: isNatural ? selectedBull?.brinco : undefined,
      semenCode: needsSemen ? semenCode : undefined,
      donorCowId: isFiv && donorCowId ? donorCowId : undefined,
      donorCowBrinco: isFiv && donorCowBrinco ? donorCowBrinco : undefined,
      type,
      date: coverageDate,
      technician: technician || undefined,
      notes: notes || undefined,
      pregnancyResult: initialData ? pregnancyResult : 'pending',
      pregnancyCheckDate:
        initialData && pregnancyCheckDate
          ? new Date(pregnancyCheckDate + 'T00:00:00')
          : undefined,
      repasse,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center overflow-y-auto p-4 pt-8">
      <form
        onSubmit={handleSubmit}
        className="bg-base-800 rounded-xl p-6 space-y-4 w-full max-w-lg my-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-white">
          {initialData ? 'Editar Cobertura' : 'Nova Cobertura'}
        </h3>

        {/* Seleção de vaca */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">
            Vaca {!initialData && `(${eligibleCows.length} disponiveis)`}
          </label>
          {initialData ? (
            <div className="bg-base-700 rounded-lg px-3 py-2 text-white">
              {selectedCow?.brinco || initialData.cowBrinco} - {selectedCow?.nome || 'Sem nome'}
            </div>
          ) : (
            <>
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
            </>
          )}
        </div>

        {/* Tipo de cobertura */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Tipo de Cobertura</label>
          <div className="grid grid-cols-4 gap-2">
            {(['iatf', 'fiv', 'ia', 'natural'] as CoverageType[]).map((t) => (
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
                {typeLabels[t]}
              </button>
            ))}
          </div>
        </div>

        {/* Campos para NATURAL */}
        {isNatural && (
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
              size={4}
            >
              <option value="">Selecione...</option>
              {filteredBulls.map((bull) => (
                <option key={bull.id} value={bull.id}>
                  {bull.brinco} - {bull.nome || 'Sem nome'}
                </option>
              ))}
            </select>
            <div className="mt-2 p-3 bg-blue-900/20 border border-blue-700 rounded-lg">
              <p className="text-xs text-blue-400">
                Periodo da monta natural: {formatDate(season.startDate)} - {formatDate(season.endDate)}
              </p>
            </div>
          </div>
        )}

        {/* Campos para IA / IATF / FIV */}
        {needsSemen && (
          <div className="space-y-4">
            {!isNatural && (
              <div>
                <label className="block text-sm text-gray-400 mb-1">Data da {typeLabels[type]}</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-white"
                  required
                />
              </div>
            )}
            <div>
              <label className="block text-sm text-gray-400 mb-1">Semen Utilizado (Nome do Pai)</label>
              <input
                type="text"
                value={semenCode}
                onChange={(e) => setSemenCode(e.target.value)}
                placeholder="Ex: NETUNO FIV DA ESTIVA"
                className="w-full bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-white"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Este nome sera registrado como pai na genealogia
              </p>
            </div>

            {isFiv && (
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Doadora do Embriao (Mae Biologica)
                </label>
                <input
                  type="text"
                  value={donorCowBrinco}
                  onChange={(e) => setDonorCowBrinco(e.target.value)}
                  placeholder="Digite o brinco da doadora..."
                  className="w-full bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-white mb-2"
                  required
                />
                {selectedDonor ? (
                  <div className="p-3 bg-emerald-900/30 border border-emerald-600 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400 font-medium">
                        Doadora encontrada: {selectedDonor.brinco} - {selectedDonor.nome || 'Sem nome'}
                      </span>
                    </div>
                  </div>
                ) : donorCowBrinco ? (
                  <div className="p-3 bg-amber-900/30 border border-amber-600 rounded-lg">
                    <span className="text-amber-400 text-sm">
                      Doadora nao encontrada no plantel. O brinco sera salvo mesmo assim.
                    </span>
                  </div>
                ) : null}
                {!donorCowBrinco && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-500 mb-2">Ou selecione da lista:</p>
                    <input
                      type="text"
                      value={donorCowSearch}
                      onChange={(e) => setDonorCowSearch(e.target.value)}
                      placeholder="Buscar doadora..."
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

        {/* Técnico e notas */}
        <div className="grid grid-cols-2 gap-4">
          {!isNatural && (
            <div className="col-span-2">
              {/* Data já mostrada acima para IA/IATF/FIV */}
            </div>
          )}
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
          <div>
            <label className="block text-sm text-gray-400 mb-1">Observacoes (opcional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observacoes..."
              className="w-full bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-white"
            />
          </div>
        </div>

        {/* DIAGNOSTICO (apenas na edição) */}
        {initialData && (
          <div className="border-t border-base-600 pt-4">
            <h4 className="text-sm font-semibold text-white mb-3">Diagnostico de Gestacao</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Resultado</label>
                <select
                  value={pregnancyResult}
                  onChange={(e) => setPregnancyResult(e.target.value as 'positive' | 'negative' | 'pending')}
                  className="w-full bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-white"
                >
                  <option value="pending">Pendente</option>
                  <option value="positive">Prenhe</option>
                  <option value="negative">Vazia</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Data do DG</label>
                <input
                  type="date"
                  value={pregnancyCheckDate}
                  onChange={(e) => setPregnancyCheckDate(e.target.value)}
                  className="w-full bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-white"
                />
              </div>
            </div>
          </div>
        )}

        {/* REPASSE (apenas na edição, para IATF/FIV/IA) */}
        {showRepasse && (
          <div className="border-t border-base-600 pt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-white">Repasse (Monta Natural)</h4>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={repasseEnabled}
                  onChange={(e) => setRepasseEnabled(e.target.checked)}
                  className="w-4 h-4 rounded border-base-600"
                />
                <span className="text-sm text-gray-400">Habilitar</span>
              </label>
            </div>

            {repasseEnabled && (
              <div className="space-y-3 bg-base-700/50 rounded-lg p-3">
                <div className="p-2 bg-blue-900/20 border border-blue-700 rounded-lg">
                  <p className="text-xs text-blue-400">
                    Periodo do repasse: {formatDate(season.startDate)} - {formatDate(season.endDate)} (periodo da estacao)
                  </p>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Touros do Repasse (max. 2)
                  </label>
                  {selectedRepasseBulls.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {selectedRepasseBulls.map((bull) => (
                        <span
                          key={bull.id}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-900/30 border border-emerald-600 rounded-full text-sm text-emerald-400"
                        >
                          {bull.brinco} - {bull.nome || ''}
                          <button
                            type="button"
                            onClick={() => setRepasseBullIds((ids) => ids.filter((id) => id !== bull.id))}
                            className="text-emerald-300 hover:text-red-400 ml-1"
                          >
                            &times;
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  {selectedRepasseBulls.length >= 2 ? (
                    <p className="text-xs text-amber-400">
                      Maximo de 2 touros. Apos o nascimento, voce devera confirmar qual e o pai.
                    </p>
                  ) : (
                    <>
                      <input
                        type="text"
                        value={repasseBullSearch}
                        onChange={(e) => setRepasseBullSearch(e.target.value)}
                        placeholder="Buscar touro..."
                        className="w-full bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-white mb-2"
                      />
                      <select
                        value=""
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val && !repasseBullIds.includes(val)) {
                            setRepasseBullIds((ids) => [...ids, val]);
                          }
                        }}
                        className="w-full bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-white"
                        size={3}
                      >
                        <option value="">Selecione...</option>
                        {filteredRepasseBulls
                          .filter((b) => !repasseBullIds.includes(b.id))
                          .map((bull) => (
                            <option key={bull.id} value={bull.id}>
                              {bull.brinco} - {bull.nome || 'Sem nome'}
                            </option>
                          ))}
                      </select>
                    </>
                  )}
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Observacoes do repasse</label>
                  <input
                    type="text"
                    value={repasseNotes}
                    onChange={(e) => setRepasseNotes(e.target.value)}
                    placeholder="Observacoes..."
                    className="w-full bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">DG Repasse</label>
                    <select
                      value={repasseDiagResult}
                      onChange={(e) => setRepasseDiagResult(e.target.value as 'positive' | 'negative' | 'pending')}
                      className="w-full bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-white"
                    >
                      <option value="pending">Pendente</option>
                      <option value="positive">Prenhe</option>
                      <option value="negative">Vazia</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Data DG Repasse</label>
                    <input
                      type="date"
                      value={repasseDiagDate}
                      onChange={(e) => setRepasseDiagDate(e.target.value)}
                      className="w-full bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Botões */}
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
            {initialData ? 'Salvar' : 'Registrar'}
          </button>
        </div>
      </form>
    </div>
  );
};

// ============================================
// GERENCIADOR DE VACAS EXPOSTAS
// ============================================

const ExposedCowsManager: React.FC<{
  exposedCowIds: string[];
  eligibleCows: Animal[];
  allAnimals: Animal[];
  onUpdate: (cowIds: string[]) => void;
  onClose: () => void;
}> = ({ exposedCowIds, eligibleCows, allAnimals, onUpdate, onClose }) => {
  const [search, setSearch] = useState('');
  const exposedSet = new Set(exposedCowIds);

  const exposedAnimals = useMemo(
    () => allAnimals.filter((a) => exposedSet.has(a.id)),
    [allAnimals, exposedCowIds]
  );

  const availableCows = useMemo(() => {
    const s = search.toLowerCase();
    return eligibleCows
      .filter((c) => !exposedSet.has(c.id))
      .filter(
        (c) =>
          !s || c.brinco.toLowerCase().includes(s) || c.nome?.toLowerCase().includes(s)
      )
      .slice(0, 50);
  }, [eligibleCows, exposedCowIds, search]);

  const handleAdd = (id: string) => {
    onUpdate([...exposedCowIds, id]);
  };
  const handleRemove = (id: string) => {
    onUpdate(exposedCowIds.filter((i) => i !== id));
  };
  const handleAddAll = () => {
    const allIds = new Set(exposedCowIds);
    eligibleCows.forEach((c) => allIds.add(c.id));
    onUpdate(Array.from(allIds));
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center overflow-y-auto p-4 pt-8">
      <div
        className="bg-base-800 rounded-xl p-6 w-full max-w-lg my-4 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">
            Vacas Expostas ({exposedCowIds.length})
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">&times;</button>
        </div>

        {/* Lista das expostas */}
        <div>
          <h4 className="text-sm text-gray-400 mb-2">Vacas na estacao:</h4>
          <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
            {exposedAnimals.length === 0 ? (
              <p className="text-gray-500 text-sm">Nenhuma vaca adicionada</p>
            ) : (
              exposedAnimals.map((a) => (
                <span
                  key={a.id}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-base-700 rounded-full text-sm text-white"
                >
                  {a.brinco}
                  <button
                    onClick={() => handleRemove(a.id)}
                    className="text-gray-400 hover:text-red-400 ml-1"
                  >
                    &times;
                  </button>
                </span>
              ))
            )}
          </div>
        </div>

        {/* Adicionar novas */}
        <div className="border-t border-base-600 pt-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm text-gray-400">Adicionar vacas:</h4>
            <button
              onClick={handleAddAll}
              className="text-xs text-brand-primary hover:text-brand-primary-light"
            >
              Selecionar todas elegiveis ({eligibleCows.length - exposedCowIds.length})
            </button>
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por brinco ou nome..."
            className="w-full bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-white mb-2"
          />
          <div className="max-h-48 overflow-y-auto space-y-1">
            {availableCows.map((cow) => (
              <div
                key={cow.id}
                className="flex items-center justify-between p-2 bg-base-700 rounded-lg hover:bg-base-600 cursor-pointer"
                onClick={() => handleAdd(cow.id)}
              >
                <span className="text-sm text-white">
                  {cow.brinco} - {cow.nome || 'Sem nome'}
                </span>
                <span className="text-xs text-brand-primary">+ Adicionar</span>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-dark"
        >
          Fechar
        </button>
      </div>
    </div>
  );
};

// ============================================
// CARD DE COBERTURA UNIFICADO
// ============================================

const CoverageCard: React.FC<{
  coverage: CoverageRecord;
  season: BreedingSeason;
  availableBulls: Animal[];
  onEdit: () => void;
  onDelete: () => void;
  onQuickDiagnosis: (coverageId: string, result: 'positive' | 'negative') => void;
  onDiagnosisWithRepasse: (coverageId: string, repasseBulls: RepasseBull[]) => void;
  onConfirmPaternity?: (coverageId: string, bullId: string, bullBrinco: string) => void;
}> = ({ coverage, season, availableBulls, onEdit, onDelete, onQuickDiagnosis, onDiagnosisWithRepasse, onConfirmPaternity }) => {
  const isNatural = coverage.type === 'natural';
  const isFiv = coverage.type === 'fiv';
  const hasRepasse = coverage.repasse?.enabled;

  // Estado local para fluxo "Vazia → Repasse"
  const [showRepasseFlow, setShowRepasseFlow] = useState(false);
  const [repasseSelectedBullIds, setRepasseSelectedBullIds] = useState<string[]>([]);
  const [repasseBullSearchText, setRepasseBullSearchText] = useState('');

  const selectedRepasseBullsLocal = useMemo(
    () => repasseSelectedBullIds.map((id) => availableBulls.find((b) => b.id === id)).filter(Boolean) as Animal[],
    [availableBulls, repasseSelectedBullIds]
  );

  const filteredRepasseBullsLocal = useMemo(() => {
    if (!repasseBullSearchText.trim()) return availableBulls.slice(0, 30);
    const s = repasseBullSearchText.toLowerCase();
    return availableBulls.filter(
      (b) => b.brinco.toLowerCase().includes(s) || b.nome?.toLowerCase().includes(s)
    );
  }, [availableBulls, repasseBullSearchText]);

  const handleConfirmRepasse = () => {
    if (repasseSelectedBullIds.length === 0) return;
    const bulls: RepasseBull[] = selectedRepasseBullsLocal.map((b) => ({
      bullId: b.id,
      bullBrinco: b.brinco,
    }));
    onDiagnosisWithRepasse(coverage.id, bulls);
    setShowRepasseFlow(false);
    setRepasseSelectedBullIds([]);
    setRepasseBullSearchText('');
  };

  const handleSkipRepasse = () => {
    onQuickDiagnosis(coverage.id, 'negative');
    setShowRepasseFlow(false);
    setRepasseSelectedBullIds([]);
  };

  // Resultado final: se tem repasse, mostra o resultado do repasse
  const finalResult = hasRepasse
    ? coverage.repasse!.diagnosisResult || 'pending'
    : coverage.pregnancyResult || 'pending';

  // Mostra opção de repasse para coberturas não-natural com DG pendente
  const canShowRepasseOption = coverage.type !== 'natural' && (!coverage.pregnancyResult || coverage.pregnancyResult === 'pending');

  return (
    <div className="bg-base-700 rounded-xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white">{coverage.cowBrinco}</span>
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
            coverage.type === 'iatf' ? 'bg-blue-500/20 text-blue-400' :
            coverage.type === 'fiv' ? 'bg-purple-500/20 text-purple-400' :
            coverage.type === 'ia' ? 'bg-cyan-500/20 text-cyan-400' :
            'bg-green-500/20 text-green-400'
          }`}>
            {typeLabels[coverage.type]}
          </span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${resultColors[finalResult]}`}>
            {resultLabels[finalResult]}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onEdit}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-base-600 rounded-lg transition-colors"
            title="Editar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
            </svg>
          </button>
          <button
            onClick={() => {
              if (confirm('Excluir esta cobertura?')) onDelete();
            }}
            className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-900/30 rounded-lg transition-colors"
            title="Excluir"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>

      {/* Detalhes da cobertura */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <div className="text-gray-400">
          {isNatural ? 'Periodo:' : 'Data:'}
        </div>
        <div className="text-white">
          {isNatural
            ? `${formatDate(season.startDate)} - ${formatDate(season.endDate)}`
            : formatDate(coverage.date)}
        </div>

        {isNatural && coverage.bullBrinco && (
          <>
            <div className="text-gray-400">Touro:</div>
            <div className="text-white">{coverage.bullBrinco}</div>
          </>
        )}

        {!isNatural && coverage.semenCode && (
          <>
            <div className="text-gray-400">Semen:</div>
            <div className="text-white">{coverage.semenCode}</div>
          </>
        )}

        {isFiv && coverage.donorCowBrinco && (
          <>
            <div className="text-purple-400">Doadora:</div>
            <div className="text-purple-300">{coverage.donorCowBrinco}</div>
          </>
        )}

        {coverage.technician && (
          <>
            <div className="text-gray-400">Tecnico:</div>
            <div className="text-white">{coverage.technician}</div>
          </>
        )}
      </div>

      {/* Diagnóstico */}
      <div className="border-t border-base-600 pt-2">
        <div className="flex items-center justify-between">
          <div className="text-sm">
            <span className="text-gray-400">DG: </span>
            <span className={`font-medium ${
              coverage.pregnancyResult === 'positive' ? 'text-emerald-400' :
              coverage.pregnancyResult === 'negative' ? 'text-red-400' :
              'text-amber-400'
            }`}>
              {resultLabels[coverage.pregnancyResult || 'pending']}
            </span>
            {coverage.pregnancyCheckDate && (
              <span className="text-gray-500 ml-2">({formatDate(coverage.pregnancyCheckDate)})</span>
            )}
          </div>
          {/* Botões rápidos de DG */}
          {(!coverage.pregnancyResult || coverage.pregnancyResult === 'pending') && !showRepasseFlow && (
            <div className="flex gap-1">
              <button
                onClick={() => onQuickDiagnosis(coverage.id, 'positive')}
                className="px-2 py-1 bg-emerald-600 text-white text-xs rounded hover:bg-emerald-700"
              >
                Prenhe
              </button>
              {canShowRepasseOption ? (
                <button
                  onClick={() => setShowRepasseFlow(true)}
                  className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                >
                  Vazia
                </button>
              ) : (
                <button
                  onClick={() => onQuickDiagnosis(coverage.id, 'negative')}
                  className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                >
                  Vazia
                </button>
              )}
            </div>
          )}
        </div>
        {coverage.pregnancyResult === 'positive' && coverage.expectedCalvingDate && (
          <p className="text-xs text-gray-500 mt-1">
            Parto previsto: {formatDate(coverage.expectedCalvingDate)}
          </p>
        )}

        {/* Fluxo inline: Vazia → Encaminhar para Repasse */}
        {showRepasseFlow && (
          <div className="mt-3 p-3 bg-amber-900/20 border border-amber-700 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-amber-400">
                Vaca vazia — Encaminhar para repasse?
              </h4>
              <button
                onClick={() => { setShowRepasseFlow(false); setRepasseSelectedBullIds([]); setRepasseBullSearchText(''); }}
                className="text-gray-400 hover:text-white text-xs"
              >
                Cancelar
              </button>
            </div>
            <p className="text-xs text-amber-300/70">
              Selecione o(s) touro(s) para monta natural (max. 2). O diagnostico sera registrado como vazia e o repasse sera habilitado automaticamente.
            </p>

            {/* Bulls selecionados como chips */}
            {selectedRepasseBullsLocal.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedRepasseBullsLocal.map((bull) => (
                  <span
                    key={bull.id}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-900/30 border border-emerald-600 rounded-full text-xs text-emerald-400"
                  >
                    {bull.brinco} {bull.nome ? `- ${bull.nome}` : ''}
                    <button
                      type="button"
                      onClick={() => setRepasseSelectedBullIds((ids) => ids.filter((id) => id !== bull.id))}
                      className="text-emerald-300 hover:text-red-400 ml-1"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Seletor de touros */}
            {selectedRepasseBullsLocal.length < 2 && (
              <div>
                <input
                  type="text"
                  value={repasseBullSearchText}
                  onChange={(e) => setRepasseBullSearchText(e.target.value)}
                  placeholder="Buscar touro..."
                  className="w-full bg-base-700 border border-base-600 rounded-lg px-3 py-1.5 text-white text-sm mb-1"
                />
                <select
                  value=""
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val && !repasseSelectedBullIds.includes(val)) {
                      setRepasseSelectedBullIds((ids) => [...ids, val]);
                    }
                  }}
                  className="w-full bg-base-700 border border-base-600 rounded-lg px-3 py-1.5 text-white text-sm"
                  size={Math.min(4, filteredRepasseBullsLocal.filter((b) => !repasseSelectedBullIds.includes(b.id)).length + 1)}
                >
                  <option value="">Selecione o touro...</option>
                  {filteredRepasseBullsLocal
                    .filter((b) => !repasseSelectedBullIds.includes(b.id))
                    .map((bull) => (
                      <option key={bull.id} value={bull.id}>
                        {bull.brinco} - {bull.nome || 'Sem nome'}
                      </option>
                    ))}
                </select>
              </div>
            )}

            {selectedRepasseBullsLocal.length >= 2 && (
              <p className="text-xs text-amber-400">
                Maximo de 2 touros selecionados. Apos o nascimento, confirme qual e o pai.
              </p>
            )}

            {/* Botões de ação */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleConfirmRepasse}
                disabled={repasseSelectedBullIds.length === 0}
                className={`flex-1 px-3 py-2 text-white text-sm rounded-lg font-medium transition-colors ${
                  repasseSelectedBullIds.length === 0
                    ? 'bg-gray-600 cursor-not-allowed'
                    : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                Confirmar Repasse ({repasseSelectedBullIds.length} {repasseSelectedBullIds.length === 1 ? 'touro' : 'touros'})
              </button>
              <button
                onClick={handleSkipRepasse}
                className="px-3 py-2 bg-red-600/80 hover:bg-red-700 text-white text-sm rounded-lg transition-colors"
              >
                Apenas Vazia
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Repasse */}
      {hasRepasse && (() => {
        const repasse = coverage.repasse!;
        const bulls = getRepasseBulls(repasse);
        const isPendingPat = hasPendingPaternity(repasse);
        const bullLabel = getRepasseBullLabel(repasse);

        return (
          <div className="border-t border-base-600 pt-2 bg-amber-900/10 rounded-lg p-2 -mx-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-amber-400 uppercase">Repasse - Monta Natural</span>
              {isPendingPat && (
                <span className="px-2 py-0.5 bg-yellow-600/20 text-yellow-400 text-xs rounded-full animate-pulse">
                  Paternidade pendente
                </span>
              )}
              {repasse.confirmedSireId && (
                <span className="px-2 py-0.5 bg-emerald-600/20 text-emerald-400 text-xs rounded-full">
                  Pai confirmado
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              {bulls.length > 0 && (
                <>
                  <div className="text-gray-400">{bulls.length > 1 ? 'Touros:' : 'Touro:'}</div>
                  <div className="text-white">
                    {repasse.confirmedSireId ? (
                      <span className="text-emerald-400">{repasse.confirmedSireBrinco}</span>
                    ) : (
                      bullLabel
                    )}
                  </div>
                </>
              )}
              <div className="text-gray-400">Periodo:</div>
              <div className="text-white">
                {formatDate(repasse.startDate || season.startDate)} -{' '}
                {formatDate(repasse.endDate || season.endDate)}
              </div>
              <div className="text-gray-400">DG Repasse:</div>
              <div className={`font-medium ${
                repasse.diagnosisResult === 'positive' ? 'text-emerald-400' :
                repasse.diagnosisResult === 'negative' ? 'text-red-400' :
                'text-amber-400'
              }`}>
                {resultLabels[repasse.diagnosisResult || 'pending']}
                {repasse.diagnosisDate && (
                  <span className="text-gray-500 ml-1">({formatDate(repasse.diagnosisDate)})</span>
                )}
              </div>
            </div>

            {/* Confirmar paternidade */}
            {isPendingPat && onConfirmPaternity && (
              <div className="mt-3 p-2 bg-yellow-900/20 border border-yellow-700 rounded-lg">
                <p className="text-xs text-yellow-400 mb-2">
                  Dois touros no repasse. Confirme o pai apos o nascimento:
                </p>
                <div className="flex gap-2">
                  {bulls.map((b) => (
                    <button
                      key={b.bullId}
                      onClick={() => {
                        if (confirm(`Confirmar ${b.bullBrinco} como pai deste bezerro?`)) {
                          onConfirmPaternity(coverage.id, b.bullId, b.bullBrinco);
                        }
                      }}
                      className="flex-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded-lg font-medium transition-colors"
                    >
                      {b.bullBrinco}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Notas */}
      {coverage.notes && (
        <p className="text-xs text-gray-500 italic">{coverage.notes}</p>
      )}
    </div>
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
}) => {
  const [selectedSeason, setSelectedSeason] = useState<BreedingSeason | null>(null);
  const [showNewSeasonForm, setShowNewSeasonForm] = useState(false);
  const [showCoverageForm, setShowCoverageForm] = useState(false);
  const [showEditSeason, setShowEditSeason] = useState(false);
  const [showExposedManager, setShowExposedManager] = useState(false);
  const [editingCoverage, setEditingCoverage] = useState<CoverageRecord | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'coverages' | 'diagnostics' | 'calvings'>(
    'overview'
  );

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

  const handleQuickDiagnosis = useCallback(async (coverageId: string, result: 'positive' | 'negative') => {
    if (!currentSeason) return;
    try {
      await onUpdateDiagnosis(currentSeason.id, coverageId, result, new Date());
    } catch (err) {
      console.error('Erro ao registrar diagnóstico:', err);
      alert('Erro ao registrar diagnóstico. Tente novamente.');
    }
  }, [currentSeason, onUpdateDiagnosis]);

  const handleConfirmPaternity = useCallback(async (coverageId: string, bullId: string, bullBrinco: string) => {
    if (!currentSeason) return;
    try {
      await onConfirmPaternity(currentSeason.id, coverageId, bullId, bullBrinco);
    } catch (err) {
      console.error('Erro ao confirmar paternidade:', err);
      alert('Erro ao confirmar paternidade. Tente novamente.');
    }
  }, [currentSeason, onConfirmPaternity]);

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
          startDate: new Date(),
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
          onCancel={() => setShowCoverageForm(false)}
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
          {metrics.repasseCount > 0 && (
            <MetricCard
              label="Repasse"
              value={`${metrics.repassePregnant}/${metrics.repasseCount}`}
              icon="🔄"
              color="border-amber-500"
            />
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-base-700 overflow-x-auto">
        {([
          { key: 'overview' as const, label: 'Visao Geral' },
          { key: 'coverages' as const, label: `Coberturas (${sortedCoverages.length})` },
          { key: 'diagnostics' as const, label: `Diagnosticos (${metrics?.pregnancyChecksDue.length || 0})` },
          { key: 'calvings' as const, label: `Partos (${expectedCalvings.length})` },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
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
                <div className="text-xs text-gray-500">Prenhes (sem repasse) / Expostas</div>
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
      {activeTab === 'coverages' && (
        <div className="space-y-3">
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
          ) : (
            sortedCoverages.map((coverage) => (
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
      )}

      {/* TAB: Diagnósticos */}
      {activeTab === 'diagnostics' && metrics && (
        <div className="bg-base-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">
            Diagnosticos Pendentes ({metrics.pregnancyChecksDue.length})
          </h3>
          {metrics.pregnancyChecksDue.length === 0 ? (
            <p className="text-gray-400 text-center py-8">Nenhum diagnostico pendente no momento</p>
          ) : (
            <div className="space-y-3">
              {metrics.pregnancyChecksDue.map((check, idx) => (
                <div
                  key={`${check.cowId}-${idx}`}
                  className="flex items-center justify-between p-4 bg-base-700 rounded-lg"
                >
                  <div>
                    <div className="font-medium text-white">{check.cowBrinco}</div>
                    <div className="text-sm text-gray-400">
                      Previsto para: {formatDate(check.dueDate)}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleQuickDiagnosis(check.coverageId, 'positive')}
                      className="px-3 py-1 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700"
                    >
                      Prenhe
                    </button>
                    <button
                      onClick={() => handleQuickDiagnosis(check.coverageId, 'negative')}
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

      {/* TAB: Partos Previstos */}
      {activeTab === 'calvings' && (
        <div className="space-y-4">
          {/* Alerta de paternidade pendente */}
          {pendingPaternityRecords.length > 0 && (
            <div className="bg-yellow-900/20 border border-yellow-700 rounded-xl p-4">
              <h3 className="text-lg font-semibold text-yellow-400 mb-3">
                Paternidade Pendente ({pendingPaternityRecords.length})
              </h3>
              <p className="text-sm text-yellow-300/80 mb-3">
                Estas vacas foram repassadas com 2 touros. Confirme o pai apos o nascimento do bezerro.
              </p>
              <div className="space-y-2">
                {pendingPaternityRecords.map((coverage) => {
                  const bulls = getRepasseBulls(coverage.repasse!);
                  return (
                    <div key={coverage.id} className="flex items-center justify-between p-3 bg-base-800 rounded-lg">
                      <div>
                        <span className="font-medium text-white">{coverage.cowBrinco}</span>
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
                  );
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
    </div>
  );
};

export default BreedingSeasonManager;
