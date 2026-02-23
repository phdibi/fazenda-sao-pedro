import React, { useState, useMemo } from 'react';
import {
  Animal,
  BreedingSeason,
  CoverageType,
  CoverageRecord,
  RepasseData,
  RepasseBull,
  Sexo,
} from '../../types';
import { useFilteredAnimals } from '../../hooks/useFilteredAnimals';
import { getRepasseBulls } from '../../services/breedingSeasonService';
import { formatDate, toInputDate, typeLabels } from './helpers';

interface CoverageFormProps {
  eligibleCows: Animal[];
  availableBulls: Animal[];
  allAnimals: Animal[];
  season: BreedingSeason;
  onSubmit: (data: Omit<CoverageRecord, 'id' | 'expectedCalvingDate'>) => void;
  onCancel: () => void;
  initialData?: CoverageRecord;
  preselectedCowId?: string;
}

const CoverageForm: React.FC<CoverageFormProps> = ({ eligibleCows, availableBulls, allAnimals, season, onSubmit, onCancel, initialData, preselectedCowId }) => {
  const [cowId, setCowId] = useState(initialData?.cowId || preselectedCowId || '');
  const [cowSearch, setCowSearch] = useState('');
  const [type, setType] = useState<CoverageType>(initialData?.type || 'iatf');
  // Suporte a 1 ou 2 touros na monta natural direta
  const initialNaturalBulls: RepasseBull[] = initialData?.type === 'natural'
    ? (initialData.bulls && initialData.bulls.length > 0
        ? initialData.bulls
        : initialData.bullId
          ? [{ bullId: initialData.bullId, bullBrinco: initialData.bullBrinco || 'Desconhecido' }]
          : [])
    : [];
  const [naturalBullIds, setNaturalBullIds] = useState<string[]>(
    initialNaturalBulls.map((b) => b.bullId)
  );
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
  const selectedNaturalBulls = useMemo(
    () => naturalBullIds.map((id) => availableBulls.find((b) => b.id === id)).filter(Boolean) as Animal[],
    [availableBulls, naturalBullIds]
  );
  const selectedRepasseBulls = useMemo(
    () => repasseBullIds.map((id) => availableBulls.find((b) => b.id === id)).filter(Boolean) as Animal[],
    [availableBulls, repasseBullIds]
  );

  // Vacas disponíveis = elegíveis menos as que já têm cobertura na estação
  const availableCows = useMemo(() => {
    if (!season?.coverageRecords?.length) return eligibleCows;
    const coveredCowIds = new Set(season.coverageRecords.map((r) => r.cowId));
    return eligibleCows.filter((cow) => !coveredCowIds.has(cow.id));
  }, [eligibleCows, season]);

  const filteredCows = useFilteredAnimals(availableCows, cowSearch);
  const filteredBulls = useFilteredAnimals(availableBulls, bullSearch);
  const filteredRepasseBulls = useFilteredAnimals(availableBulls, repasseBullSearch);

  const eligibleDonors = useMemo(
    () => allAnimals.filter((a) => a.sexo === Sexo.Femea),
    [allAnimals]
  );

  const filteredDonors = useFilteredAnimals(eligibleDonors, donorCowSearch);

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
  const showRepasse = type === 'iatf' || type === 'fiv' || type === 'ia';

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
            // Inicio do repasse: preserva existente, ou usa inicio da estação
            startDate: initialData?.repasse?.startDate
              ? new Date(initialData.repasse.startDate)
              : new Date(season.startDate),
            endDate: new Date(season.endDate),
            notes: repasseNotes || undefined,
            diagnosisDate: showRepasse && repasseDiagDate ? new Date(repasseDiagDate + 'T00:00:00') : undefined,
            diagnosisResult: showRepasse ? repasseDiagResult : 'pending',
            // Preserve existing confirmedSireId if editing
            confirmedSireId: initialData?.repasse?.confirmedSireId,
            confirmedSireBrinco: initialData?.repasse?.confirmedSireBrinco,
          }
        : undefined;

    const naturalBullsArray: RepasseBull[] = selectedNaturalBulls.map((b) => ({
      bullId: b.id,
      bullBrinco: b.brinco,
    }));

    onSubmit({
      cowId,
      cowBrinco: selectedCow?.brinco || '',
      // Backward compat: bullId/bullBrinco aponta para o primeiro touro
      bullId: isNatural ? (naturalBullsArray[0]?.bullId || undefined) : undefined,
      bullBrinco: isNatural ? (naturalBullsArray[0]?.bullBrinco || undefined) : undefined,
      // Array de touros para monta natural (1 ou 2)
      bulls: isNatural && naturalBullsArray.length > 0 ? naturalBullsArray : undefined,
      // Preserva confirmedSireId na edição (se existir)
      confirmedSireId: initialData?.confirmedSireId,
      confirmedSireBrinco: initialData?.confirmedSireBrinco,
      semenCode: needsSemen ? semenCode : undefined,
      donorCowId: isFiv && donorCowId ? donorCowId : undefined,
      donorCowBrinco: isFiv && donorCowBrinco ? donorCowBrinco : undefined,
      type,
      date: coverageDate,
      technician: technician || undefined,
      notes: notes || undefined,
      pregnancyResult,
      pregnancyCheckDate: pregnancyCheckDate
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
            Vaca {!initialData && `(${availableCows.length} disponiveis)`}
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

        {/* Campos para NATURAL (suporta 1 ou 2 touros) */}
        {isNatural && (
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Touros da Monta Natural (max. 2) - ({availableBulls.length} disponiveis)
            </label>
            {selectedNaturalBulls.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {selectedNaturalBulls.map((bull) => (
                  <span
                    key={bull.id}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-900/30 border border-emerald-600 rounded-full text-sm text-emerald-400"
                  >
                    {bull.brinco} - {bull.nome || ''}
                    <button
                      type="button"
                      onClick={() => setNaturalBullIds((ids) => ids.filter((id) => id !== bull.id))}
                      className="text-emerald-300 hover:text-red-400 ml-1"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            )}
            {selectedNaturalBulls.length >= 2 ? (
              <p className="text-xs text-amber-400">
                Maximo de 2 touros. Apos o nascimento, voce devera confirmar qual e o pai.
              </p>
            ) : (
              <>
                <input
                  type="text"
                  value={bullSearch}
                  onChange={(e) => setBullSearch(e.target.value)}
                  placeholder="Buscar por brinco ou nome..."
                  className="w-full bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-white mb-2"
                />
                <select
                  value=""
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val && !naturalBullIds.includes(val)) {
                      setNaturalBullIds((ids) => [...ids, val]);
                    }
                  }}
                  className="w-full bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-white"
                  size={4}
                >
                  <option value="">Selecione...</option>
                  {filteredBulls
                    .filter((b) => !naturalBullIds.includes(b.id))
                    .map((bull) => (
                      <option key={bull.id} value={bull.id}>
                        {bull.brinco} - {bull.nome || 'Sem nome'}
                      </option>
                    ))}
                </select>
              </>
            )}
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

        {/* DIAGNOSTICO */}
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

        {/* REPASSE (para IATF/FIV/IA) */}
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

export default CoverageForm;
