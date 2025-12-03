import React, { useState, useMemo } from 'react';
import { Animal, WeightPrediction } from '../types';
import { predictWeight, predictSlaughterDate, batchPredictWeights } from '../services/weightPrediction';
import { calcularGMDAnimal, formatarGMD, classificarGMD } from '../utils/gmdCalculations';
import Modal from './common/Modal';

interface WeightPredictionModalProps {
  isOpen: boolean;
  onClose: () => void;
  animal?: Animal;
  animals?: Animal[];
  mode: 'single' | 'batch';
}

const WeightPredictionModal: React.FC<WeightPredictionModalProps> = ({
  isOpen,
  onClose,
  animal,
  animals = [],
  mode,
}) => {
  const [targetDate, setTargetDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 3); // 3 meses no futuro
    return d.toISOString().split('T')[0];
  });
  const [targetArrobas, setTargetArrobas] = useState(18);

  // Previsão individual
  const singlePrediction = useMemo(() => {
    if (!animal || mode !== 'single') return null;
    return predictWeight(animal, new Date(targetDate));
  }, [animal, targetDate, mode]);

  const slaughterPrediction = useMemo(() => {
    if (!animal || mode !== 'single') return null;
    return predictSlaughterDate(animal, targetArrobas);
  }, [animal, targetArrobas, mode]);

  const gmdMetrics = useMemo(() => {
    if (!animal) return null;
    return calcularGMDAnimal(animal);
  }, [animal]);

  // Previsão em lote
  const batchPredictions = useMemo(() => {
    if (mode !== 'batch' || !animals.length) return [];
    return batchPredictWeights(animals, new Date(targetDate))
      .sort((a, b) => b.predictedWeight - a.predictedWeight);
  }, [animals, targetDate, mode]);

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 70) return 'text-green-400';
    if (confidence >= 50) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getAnimalById = (id: string) => animals.find(a => a.id === id);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="🔮 Previsão de Peso">
      <div className="space-y-6">
        {/* Seletor de Data */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Data Alvo da Previsão</label>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className="w-full px-3 py-2 bg-base-700 border border-base-600 rounded-lg text-white"
          />
        </div>

        {/* Modo Individual */}
        {mode === 'single' && animal && (
          <>
            {/* Info do Animal */}
            <div className="bg-base-700 rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-white text-lg">
                    {animal.nome || animal.brinco}
                  </h3>
                  <p className="text-gray-400 text-sm">{animal.raca} • {animal.sexo}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-brand-primary">{animal.pesoKg} kg</p>
                  <p className="text-xs text-gray-500">Peso atual</p>
                </div>
              </div>

              {/* GMD Atual */}
              {gmdMetrics?.gmdTotal && gmdMetrics.gmdTotal > 0 && (
                <div className="mt-3 pt-3 border-t border-base-600">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-sm">GMD Histórico:</span>
                    <span className={`font-medium ${classificarGMD(gmdMetrics.gmdTotal).color}`}>
                      {formatarGMD(gmdMetrics.gmdTotal)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Baseado em {gmdMetrics.diasAcompanhamento} dias de acompanhamento
                  </p>
                </div>
              )}
            </div>

            {/* Previsão de Peso */}
            {singlePrediction && (
              <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 rounded-lg p-4 border border-blue-700/50">
                <h4 className="text-sm font-semibold text-gray-300 mb-3">
                  Previsão para {new Date(targetDate).toLocaleDateString('pt-BR')}
                </h4>
                
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-4xl font-bold text-white">
                      {singlePrediction.predictedWeight} kg
                    </p>
                    <p className="text-green-400 text-sm mt-1">
                      +{singlePrediction.predictedWeight - singlePrediction.currentWeight} kg
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-semibold ${getConfidenceColor(singlePrediction.confidence)}`}>
                      {singlePrediction.confidence}%
                    </p>
                    <p className="text-xs text-gray-500">Confiança</p>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-base-600 text-sm text-gray-400">
                  <p>GMD projetado: <span className="text-white">{formatarGMD(singlePrediction.projectedGMD)}</span></p>
                </div>
              </div>
            )}

            {/* Previsão de Abate */}
            <div className="bg-base-800 rounded-lg p-4 border border-base-700">
              <h4 className="text-sm font-semibold text-gray-300 mb-3">
                🎯 Previsão de Abate
              </h4>
              
              <div className="flex items-center gap-4 mb-3">
                <label className="text-sm text-gray-400">Meta:</label>
                <input
                  type="number"
                  value={targetArrobas}
                  onChange={(e) => setTargetArrobas(Number(e.target.value))}
                  min={10}
                  max={30}
                  className="w-20 px-2 py-1 bg-base-700 border border-base-600 rounded text-white text-center"
                />
                <span className="text-gray-400">arrobas ({targetArrobas * 30} kg vivo)</span>
              </div>

              {slaughterPrediction ? (
                <div className="bg-base-700 rounded p-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-white font-medium">
                        {slaughterPrediction.date.toLocaleDateString('pt-BR')}
                      </p>
                      <p className="text-xs text-gray-400">
                        em {slaughterPrediction.daysNeeded} dias
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-gray-400 text-sm">Atual:</p>
                      <p className="text-white">{slaughterPrediction.currentArrobas} @</p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 text-sm">
                  Não foi possível calcular (meta muito distante ou dados insuficientes)
                </p>
              )}
            </div>
          </>
        )}

        {/* Modo Lote */}
        {mode === 'batch' && (
          <>
            <div className="bg-base-700 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-brand-primary">{animals.length}</p>
              <p className="text-sm text-gray-400">animais selecionados</p>
            </div>

            <div className="max-h-96 overflow-y-auto space-y-2">
              {batchPredictions.map((prediction, index) => {
                const animal = getAnimalById(prediction.animalId);
                if (!animal) return null;

                return (
                  <div 
                    key={prediction.animalId}
                    className="flex justify-between items-center p-3 bg-base-800 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-gray-500 text-sm w-6">{index + 1}.</span>
                      <div>
                        <p className="text-white font-medium">{animal.nome || animal.brinco}</p>
                        <p className="text-xs text-gray-400">
                          Atual: {prediction.currentWeight}kg
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-white">
                        {prediction.predictedWeight} kg
                      </p>
                      <p className={`text-xs ${getConfidenceColor(prediction.confidence)}`}>
                        {prediction.confidence}% confiança
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {batchPredictions.length > 0 && (
              <div className="bg-base-700 rounded-lg p-3">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="text-xl font-bold text-white">
                      {Math.round(batchPredictions.reduce((s, p) => s + p.predictedWeight, 0) / batchPredictions.length)} kg
                    </p>
                    <p className="text-xs text-gray-400">Peso médio previsto</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-green-400">
                      +{Math.round(batchPredictions.reduce((s, p) => s + (p.predictedWeight - p.currentWeight), 0))} kg
                    </p>
                    <p className="text-xs text-gray-400">Ganho total previsto</p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Disclaimer */}
        <p className="text-xs text-gray-500 text-center">
          ⚠️ Previsões baseadas em histórico de pesagens e parâmetros da raça. 
          Resultados reais podem variar conforme manejo e condições climáticas.
        </p>
      </div>
    </Modal>
  );
};

export default WeightPredictionModal;
