import React, { useState, useCallback } from 'react';
import { Animal, ScaleReading, WeighingType } from '../types';
import { importScaleFile, matchReadingsWithAnimals, downloadScaleTemplate } from '../utils/scaleImport';
import Modal from './common/Modal';

interface ScaleImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  animals: Animal[];
  onImportComplete: (weights: Map<string, { weight: number; date: Date; type: WeighingType }>) => void;
}

const ScaleImportModal: React.FC<ScaleImportModalProps> = ({
  isOpen,
  onClose,
  animals,
  onImportComplete,
}) => {
  const [step, setStep] = useState<'upload' | 'review' | 'confirm'>('upload');
  const [readings, setReadings] = useState<ScaleReading[]>([]);
  const [matchResult, setMatchResult] = useState<{ matched: number; unmatched: number; total: number } | null>(null);
  const [weighingType, setWeighingType] = useState<WeighingType>(WeighingType.None);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setError(null);

    try {
      const rawReadings = await importScaleFile(file);
      const result = matchReadingsWithAnimals(rawReadings, animals);
      
      setReadings(result.readings);
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

  const handleConfirmImport = useCallback(() => {
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
  }, [readings, weighingType, onImportComplete]);

  const handleClose = () => {
    setStep('upload');
    setReadings([]);
    setMatchResult(null);
    setError(null);
    onClose();
  };

  const getAnimalByBrinco = (brinco?: string) => {
    if (!brinco) return null;
    return animals.find(a => a.brinco.toUpperCase() === brinco.toUpperCase());
  };

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
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-base-700 rounded-lg p-3">
                <p className="text-2xl font-bold text-white">{matchResult.total}</p>
                <p className="text-xs text-gray-400">Total</p>
              </div>
              <div className="bg-green-900/30 rounded-lg p-3">
                <p className="text-2xl font-bold text-green-400">{matchResult.matched}</p>
                <p className="text-xs text-gray-400">Encontrados</p>
              </div>
              <div className="bg-red-900/30 rounded-lg p-3">
                <p className="text-2xl font-bold text-red-400">{matchResult.unmatched}</p>
                <p className="text-xs text-gray-400">Não encontrados</p>
              </div>
            </div>

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

            <div>
              <h4 className="text-sm font-semibold text-gray-400 mb-2">Leituras</h4>
              <div className="max-h-64 overflow-y-auto space-y-1">
                {readings.map((reading, index) => {
                  const animal = reading.animalId ? animals.find(a => a.id === reading.animalId) : null;
                  
                  return (
                    <div 
                      key={index}
                      className={`flex justify-between items-center p-2 rounded ${
                        reading.matched ? 'bg-green-900/20' : 'bg-red-900/20'
                      }`}
                    >
                      <div>
                        <span className={reading.matched ? 'text-white' : 'text-red-400'}>
                          {reading.animalBrinco || 'Sem brinco'}
                        </span>
                        {animal && (
                          <span className="text-gray-400 text-xs ml-2">
                            ({animal.nome || 'sem nome'})
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="text-white font-medium">{reading.weight} kg</span>
                        <span className="text-gray-500 text-xs block">
                          {new Date(reading.timestamp).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <button
                onClick={() => setStep('upload')}
                className="flex-1 px-4 py-2 bg-base-700 text-white rounded-lg hover:bg-base-600"
              >
                Voltar
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={matchResult.matched === 0}
                className="flex-1 px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-dark disabled:opacity-50"
              >
                Importar {matchResult.matched} Pesagens
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

export default ScaleImportModal;
