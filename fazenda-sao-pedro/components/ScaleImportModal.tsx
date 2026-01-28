import React, { useState, useCallback, useMemo } from 'react';
import { Animal, ScaleReading, ScaleSkippedLine, WeighingType } from '../types';
import { importScaleFile, matchReadingsWithAnimals, downloadScaleTemplate } from '../utils/scaleImport';
import Modal from './common/Modal';

interface ScaleImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  animals: Animal[];
  onImportComplete: (weights: Map<string, { weight: number; date: Date; type: WeighingType }>) => void;
}

/** Indexed reading preserves position for O(1) lookup instead of indexOf */
interface IndexedReading {
  reading: ScaleReading;
  originalIndex: number;
}

const ScaleImportModal: React.FC<ScaleImportModalProps> = ({
  isOpen,
  onClose,
  animals,
  onImportComplete,
}) => {
  const [step, setStep] = useState<'upload' | 'review' | 'confirm'>('upload');
  const [readings, setReadings] = useState<ScaleReading[]>([]);
  const [skippedLines, setSkippedLines] = useState<ScaleSkippedLine[]>([]);
  const [matchResult, setMatchResult] = useState<{ matched: number; unmatched: number; total: number } | null>(null);
  const [weighingType, setWeighingType] = useState<WeighingType>(WeighingType.None);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editBrinco, setEditBrinco] = useState('');
  const [editWeight, setEditWeight] = useState('');
  const [showSkipped, setShowSkipped] = useState(false);
  const [filter, setFilter] = useState<'all' | 'matched' | 'unmatched' | 'warnings'>('all');

  // Pre-sorted active animals for the edit dropdown (computed once, not on every render)
  const sortedActiveAnimals = useMemo(() =>
    animals
      .filter(a => a.status === 'Ativo')
      .sort((a, b) => a.brinco.localeCompare(b.brinco)),
    [animals]
  );

  // Animal lookup by ID — O(1) instead of O(n) per reading in render
  const animalsById = useMemo(() => {
    const map = new Map<string, Animal>();
    animals.forEach(a => map.set(a.id, a));
    return map;
  }, [animals]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setError(null);

    try {
      const parseResult = await importScaleFile(file);
      const result = matchReadingsWithAnimals(parseResult.readings, animals);

      // Merge skippedLines from parse + match
      const allSkipped = [...parseResult.skippedLines, ...result.skippedLines];

      setReadings(result.readings);
      setSkippedLines(allSkipped);
      setMatchResult({
        matched: result.matched,
        unmatched: result.unmatched,
        total: result.total,
      });
      setStep('review');
    } catch (err) {
      setError('Erro ao processar arquivo. Verifique o formato.');
    } finally {
      setIsProcessing(false);
    }
  }, [animals]);

  // Re-match a single reading after edit
  const rematchReading = useCallback((reading: ScaleReading): ScaleReading => {
    if (!reading.animalBrinco) return { ...reading, matched: false, animalId: undefined };

    const brincoUpper = reading.animalBrinco.toUpperCase();
    const animal = animals.find(
      a => a.brinco.toUpperCase() === brincoUpper || (a.nome && a.nome.toUpperCase() === brincoUpper)
    );

    if (animal) {
      // Remove warning "não encontrado" if now matched
      const warnings = (reading.warnings || []).filter(w => !w.includes('não encontrado'));
      return {
        ...reading,
        matched: true,
        animalId: animal.id,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    }

    // Still not found
    const existingWarnings = (reading.warnings || []).filter(w => !w.includes('não encontrado'));
    return {
      ...reading,
      matched: false,
      animalId: undefined,
      warnings: [...existingWarnings, `Brinco "${reading.animalBrinco}" não encontrado no cadastro.`],
    };
  }, [animals]);

  const handleStartEdit = (index: number) => {
    const reading = readings[index];
    setEditingIndex(index);
    setEditBrinco(reading.animalBrinco || '');
    setEditWeight(String(reading.weight));
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditBrinco('');
    setEditWeight('');
  };

  const handleSaveEdit = () => {
    if (editingIndex === null) return;

    const updated = [...readings];
    const reading = { ...updated[editingIndex] };

    // Update brinco
    const newBrinco = editBrinco.trim().toUpperCase();
    reading.animalBrinco = newBrinco || undefined;

    // Update weight
    const newWeight = parseFloat(editWeight.replace(',', '.'));
    if (!isNaN(newWeight) && newWeight > 0) {
      reading.weight = newWeight;
      // Re-validate weight warnings
      const nonWeightWarnings = (reading.warnings || []).filter(
        w => !w.includes('Peso muito') && !w.includes('Brinco não identificado')
      );
      const newWarnings = [...nonWeightWarnings];
      if (newWeight < 30) {
        newWarnings.push(`Peso muito baixo (${newWeight} kg). Verifique se está correto.`);
      } else if (newWeight > 1200) {
        newWarnings.push(`Peso muito alto (${newWeight} kg). Verifique se está correto.`);
      }
      if (!newBrinco) {
        newWarnings.push('Brinco não identificado na leitura. Atribua manualmente.');
      }
      reading.warnings = newWarnings.length > 0 ? newWarnings : undefined;
    }

    // Re-match
    const rematched = rematchReading(reading);
    updated[editingIndex] = rematched;
    setReadings(updated);

    // Recalculate match result
    const matched = updated.filter(r => r.matched).length;
    setMatchResult({
      matched,
      unmatched: updated.length - matched,
      total: updated.length,
    });

    handleCancelEdit();
  };

  const handleSelectAnimal = (index: number, animalId: string) => {
    const updated = [...readings];
    const animal = animalsById.get(animalId);
    if (!animal) return;

    const reading = { ...updated[index] };
    reading.animalId = animal.id;
    reading.animalBrinco = animal.brinco;
    reading.matched = true;
    // Remove "não encontrado" and "Brinco não identificado" warnings
    reading.warnings = (reading.warnings || []).filter(
      w => !w.includes('não encontrado') && !w.includes('Brinco não identificado')
    );
    if (reading.warnings.length === 0) reading.warnings = undefined;

    updated[index] = reading;
    setReadings(updated);

    const matched = updated.filter(r => r.matched).length;
    setMatchResult({
      matched,
      unmatched: updated.length - matched,
      total: updated.length,
    });
  };

  const handleConfirmImport = () => {
    const weightsMap = new Map<string, { weight: number; date: Date; type: WeighingType }>();

    readings
      .filter(r => r.matched && r.animalId)
      .forEach(reading => {
        weightsMap.set(reading.animalId!, {
          weight: reading.weight,
          date: reading.timestamp,
          type: weighingType,
        });
      });

    onImportComplete(weightsMap);
    handleClose();
  };

  const handleClose = () => {
    setStep('upload');
    setReadings([]);
    setSkippedLines([]);
    setMatchResult(null);
    setError(null);
    setEditingIndex(null);
    setFilter('all');
    setShowSkipped(false);
    onClose();
  };

  // Indexed readings with original position — avoids O(n) indexOf in render
  const indexedReadings: IndexedReading[] = useMemo(() =>
    readings.map((reading, idx) => ({ reading, originalIndex: idx })),
    [readings]
  );

  // Filtered readings
  const filteredReadings = useMemo(() => {
    switch (filter) {
      case 'matched': return indexedReadings.filter(ir => ir.reading.matched);
      case 'unmatched': return indexedReadings.filter(ir => !ir.reading.matched);
      case 'warnings': return indexedReadings.filter(ir => ir.reading.warnings && ir.reading.warnings.length > 0);
      default: return indexedReadings;
    }
  }, [indexedReadings, filter]);

  const warningsCount = useMemo(() =>
    readings.filter(r => r.warnings && r.warnings.length > 0).length,
    [readings]
  );

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Importar Dados da Balança">
      <div className="space-y-4">
        {/* Step 1: Upload */}
        {step === 'upload' && (
          <>
            <div className="text-center py-8">
              <div className="text-6xl mb-4">⚖️</div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Importar Arquivo de Balança
              </h3>
              <p className="text-gray-400 text-sm mb-6">
                Suporte para CSV, TXT e formatos Tru-Test, Gallagher
              </p>

              <label className="inline-block">
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={isProcessing}
                />
                <span className="px-6 py-3 bg-brand-primary text-white rounded-lg cursor-pointer hover:bg-brand-primary-dark transition-colors inline-block">
                  {isProcessing ? 'Processando...' : 'Selecionar Arquivo'}
                </span>
              </label>

              {error && (
                <p className="text-red-400 text-sm mt-4">{error}</p>
              )}
            </div>

            <div className="border-t border-base-700 pt-4">
              <p className="text-sm text-gray-400 mb-2">Formato esperado do arquivo:</p>
              <code className="block bg-base-900 p-3 rounded text-xs text-gray-300">
                brinco,peso_kg,data<br/>
                ABC001,320.5,15/01/2025<br/>
                ABC002,285.0,15/01/2025
              </code>
              <button
                onClick={downloadScaleTemplate}
                className="mt-3 text-sm text-brand-primary hover:underline"
              >
                📥 Baixar modelo de arquivo
              </button>
            </div>
          </>
        )}

        {/* Step 2: Review */}
        {step === 'review' && matchResult && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-base-700 rounded-lg p-3">
                <p className="text-2xl font-bold text-white">{matchResult.total}</p>
                <p className="text-xs text-gray-400">Total</p>
              </div>
              <div className="bg-green-900/30 rounded-lg p-3">
                <p className="text-2xl font-bold text-green-400">{matchResult.matched}</p>
                <p className="text-xs text-gray-400">Encontrados</p>
              </div>
              <div className={`rounded-lg p-3 ${matchResult.unmatched > 0 ? 'bg-red-900/30' : 'bg-base-700'}`}>
                <p className={`text-2xl font-bold ${matchResult.unmatched > 0 ? 'text-red-400' : 'text-gray-400'}`}>{matchResult.unmatched}</p>
                <p className="text-xs text-gray-400">Não encontrados</p>
              </div>
            </div>

            {/* Alert banners */}
            {matchResult.unmatched > 0 && (
              <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-3 text-sm">
                <p className="text-yellow-300 font-medium">
                  ⚠️ {matchResult.unmatched} leitura{matchResult.unmatched > 1 ? 's' : ''} sem animal correspondente
                </p>
                <p className="text-yellow-200/70 text-xs mt-1">
                  Clique no ícone de edição para corrigir o brinco ou atribuir um animal manualmente.
                </p>
              </div>
            )}

            {warningsCount > 0 && (
              <div className="bg-orange-900/20 border border-orange-700/50 rounded-lg p-3 text-sm">
                <p className="text-orange-300 font-medium">
                  ⚠️ {warningsCount} leitura{warningsCount > 1 ? 's' : ''} com avisos
                </p>
                <p className="text-orange-200/70 text-xs mt-1">
                  Verifique pesos suspeitos ou brincos não identificados antes de importar.
                </p>
              </div>
            )}

            {skippedLines.length > 0 && (
              <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-3 text-sm">
                <button
                  onClick={() => setShowSkipped(!showSkipped)}
                  className="w-full text-left"
                >
                  <p className="text-red-300 font-medium">
                    ❌ {skippedLines.length} linha{skippedLines.length > 1 ? 's' : ''} ignorada{skippedLines.length > 1 ? 's' : ''} do arquivo
                    <span className="text-red-400/60 text-xs ml-2">{showSkipped ? '▲ ocultar' : '▼ ver detalhes'}</span>
                  </p>
                </button>
                {showSkipped && (
                  <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                    {skippedLines.map((sl, idx) => (
                      <div key={idx} className="bg-red-900/30 rounded px-2 py-1 text-xs">
                        <span className="text-red-300">Linha {sl.lineNumber}:</span>{' '}
                        <span className="text-gray-400 font-mono">{sl.content}</span>
                        <br/>
                        <span className="text-red-400/80">Motivo: {sl.reason}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Weighing type */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">Tipo de Pesagem</label>
              <select
                value={weighingType}
                onChange={(e) => setWeighingType(e.target.value as WeighingType)}
                className="w-full px-3 py-2 bg-base-700 border border-base-600 rounded-lg text-white"
              >
                {Object.values(WeighingType).map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            {/* Filter tabs */}
            <div className="flex gap-1 bg-base-800 rounded-lg p-1">
              {([
                { key: 'all' as const, label: 'Todos', count: readings.length },
                { key: 'matched' as const, label: 'OK', count: matchResult.matched },
                { key: 'unmatched' as const, label: 'Sem match', count: matchResult.unmatched },
                { key: 'warnings' as const, label: 'Avisos', count: warningsCount },
              ]).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                    filter === tab.key
                      ? 'bg-base-600 text-white'
                      : 'text-gray-400 hover:text-gray-300'
                  }`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>

            {/* Readings list */}
            <div>
              <div className="max-h-72 overflow-y-auto space-y-1">
                {filteredReadings.length === 0 && (
                  <p className="text-gray-500 text-sm text-center py-4">
                    Nenhuma leitura neste filtro.
                  </p>
                )}
                {filteredReadings.map(({ reading, originalIndex }) => {
                  const animal = reading.animalId ? animalsById.get(reading.animalId) ?? null : null;
                  const isEditing = editingIndex === originalIndex;
                  const hasWarnings = reading.warnings && reading.warnings.length > 0;

                  return (
                    <div key={reading.id}>
                      <div
                        className={`flex justify-between items-center p-2 rounded ${
                          reading.matched
                            ? hasWarnings ? 'bg-yellow-900/15 border border-yellow-800/30' : 'bg-green-900/20'
                            : 'bg-red-900/20 border border-red-800/30'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm ${reading.matched ? 'text-white' : 'text-red-400'}`}>
                              {reading.matched ? '✓' : '✗'}{' '}
                              {reading.animalBrinco || 'Sem brinco'}
                            </span>
                            {animal && (
                              <span className="text-gray-400 text-xs truncate">
                                ({animal.nome || animal.brinco})
                              </span>
                            )}
                          </div>
                          {/* Inline warnings */}
                          {hasWarnings && (
                            <div className="mt-0.5">
                              {reading.warnings!.map((w, wIdx) => (
                                <p key={wIdx} className="text-xs text-yellow-400/80 leading-tight">
                                  ⚠ {w}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="text-right flex items-center gap-2 shrink-0">
                          <div>
                            <span className="text-white font-medium text-sm">{reading.weight} kg</span>
                            <span className="text-gray-500 text-xs block">
                              {new Date(reading.timestamp).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                          <button
                            onClick={() => isEditing ? handleCancelEdit() : handleStartEdit(originalIndex)}
                            className="p-1.5 rounded hover:bg-base-600 text-gray-400 hover:text-white transition-colors"
                            title="Editar leitura"
                          >
                            {isEditing ? '✕' : '✎'}
                          </button>
                        </div>
                      </div>

                      {/* Edit panel */}
                      {isEditing && (
                        <div className="bg-base-800 border border-base-600 rounded-lg p-3 mt-1 space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs text-gray-400 mb-1">Brinco</label>
                              <input
                                type="text"
                                value={editBrinco}
                                onChange={(e) => setEditBrinco(e.target.value)}
                                className="w-full px-2 py-1.5 bg-base-700 border border-base-600 rounded text-white text-sm"
                                placeholder="Ex: ABC001"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-400 mb-1">Peso (kg)</label>
                              <input
                                type="text"
                                value={editWeight}
                                onChange={(e) => setEditWeight(e.target.value)}
                                className="w-full px-2 py-1.5 bg-base-700 border border-base-600 rounded text-white text-sm"
                                placeholder="Ex: 320.5"
                              />
                            </div>
                          </div>

                          {/* Quick select animal */}
                          {!reading.matched && (
                            <div>
                              <label className="block text-xs text-gray-400 mb-1">
                                Ou selecione um animal manualmente:
                              </label>
                              <select
                                value=""
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handleSelectAnimal(originalIndex, e.target.value);
                                    handleCancelEdit();
                                  }
                                }}
                                className="w-full px-2 py-1.5 bg-base-700 border border-base-600 rounded text-white text-sm"
                              >
                                <option value="">Selecionar animal...</option>
                                {sortedActiveAnimals.map(a => (
                                  <option key={a.id} value={a.id}>
                                    {a.brinco}{a.nome ? ` - ${a.nome}` : ''}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={handleCancelEdit}
                              className="px-3 py-1 text-xs bg-base-700 text-gray-300 rounded hover:bg-base-600"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={handleSaveEdit}
                              className="px-3 py-1 text-xs bg-brand-primary text-white rounded hover:bg-brand-primary-dark"
                            >
                              Salvar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 pt-4">
              <button
                onClick={() => {
                  setStep('upload');
                  setReadings([]);
                  setSkippedLines([]);
                  setMatchResult(null);
                  setEditingIndex(null);
                  setFilter('all');
                  setShowSkipped(false);
                }}
                className="flex-1 px-4 py-2 bg-base-700 text-white rounded-lg hover:bg-base-600"
              >
                Voltar
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={matchResult.matched === 0}
                className="flex-1 px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-dark disabled:opacity-50"
              >
                Importar {matchResult.matched} Pesage{matchResult.matched === 1 ? 'm' : 'ns'}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

export default ScaleImportModal;
