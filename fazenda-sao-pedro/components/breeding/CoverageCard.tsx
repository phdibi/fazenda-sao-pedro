import React, { useState, useMemo } from 'react';
import {
  Animal,
  BreedingSeason,
  CoverageRecord,
  RepasseBull,
} from '../../types';
import {
  getRepasseBulls,
  getRepasseBullLabel,
  hasPendingPaternity,
  getCoverageBulls,
  hasPendingCoveragePaternity,
} from '../../services/breedingSeasonService';
import { formatDate, typeLabels, resultLabels, resultColors } from './helpers';

interface CoverageCardProps {
  coverage: CoverageRecord;
  season: BreedingSeason;
  availableBulls: Animal[];
  onEdit: () => void;
  onDelete: () => void;
  onQuickDiagnosis: (coverageId: string, result: 'positive' | 'negative') => void;
  onDiagnosisWithRepasse: (coverageId: string, repasseBulls: RepasseBull[]) => void;
  onConfirmPaternity?: (coverageId: string, bullId: string, bullBrinco: string) => void;
}

const CoverageCard: React.FC<CoverageCardProps> = ({ coverage, season, availableBulls, onEdit, onDelete, onQuickDiagnosis, onDiagnosisWithRepasse, onConfirmPaternity }) => {
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
          {isNatural && coverage.confirmedSireId && (
            <span className="px-2 py-0.5 bg-emerald-600/20 text-emerald-400 text-xs rounded-full">
              Pai confirmado
            </span>
          )}
          {isNatural && hasPendingCoveragePaternity(coverage) && (
            <span className="px-2 py-0.5 bg-yellow-600/20 text-yellow-400 text-xs rounded-full animate-pulse">
              Paternidade pendente
            </span>
          )}
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

        {isNatural && (() => {
          const mainBulls = getCoverageBulls(coverage);
          if (mainBulls.length === 0) return null;
          if (mainBulls.length === 1) {
            return (
              <>
                <div className="text-gray-400">Touro:</div>
                <div className="text-white">{mainBulls[0].bullBrinco}</div>
              </>
            );
          }
          // 2 touros
          return (
            <>
              <div className="text-gray-400">Touros:</div>
              <div className="text-white">
                {coverage.confirmedSireId ? (
                  <span className="text-emerald-400">{coverage.confirmedSireBrinco}</span>
                ) : (
                  <>
                    {mainBulls.map(b => b.bullBrinco).join(' / ')}
                    <span className="text-amber-400 text-xs ml-1">(pendente)</span>
                  </>
                )}
              </div>
            </>
          );
        })()}

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

        {/* Confirmar paternidade da monta natural (quando 2 touros) */}
        {isNatural && hasPendingCoveragePaternity(coverage) && onConfirmPaternity && (() => {
          const mainBulls = getCoverageBulls(coverage);
          return (
            <div className="mt-3 p-2 bg-yellow-900/20 border border-yellow-700 rounded-lg">
              <p className="text-xs text-yellow-400 mb-2">
                Dois touros na monta natural. Confirme o pai apos o nascimento:
              </p>
              <div className="flex gap-2">
                {mainBulls.map((b) => (
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
          );
        })()}

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

export default CoverageCard;
