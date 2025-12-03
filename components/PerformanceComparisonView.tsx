import React, { useState, useMemo } from 'react';
import { Animal, Raca } from '../types';
import { 
  generatePerformanceComparison, 
  compareBullProgeny, 
  generateRaceBenchmarks,
  identifyTopPerformers,
  identifyUnderperformers,
  compareAnimals
} from '../utils/performanceComparison';
import { formatarGMD, classificarGMD } from '../utils/gmdCalculations';

interface PerformanceComparisonViewProps {
  animals: Animal[];
  onSelectAnimal: (animal: Animal) => void;
}

type TabType = 'ranking' | 'bulls' | 'breeds' | 'compare';

const PerformanceComparisonView: React.FC<PerformanceComparisonViewProps> = ({
  animals,
  onSelectAnimal,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('ranking');
  const [compareAnimal1, setCompareAnimal1] = useState<string>('');
  const [compareAnimal2, setCompareAnimal2] = useState<string>('');

  // Rankings
  const topPerformers = useMemo(() => identifyTopPerformers(animals, 20), [animals]);
  const underperformers = useMemo(() => identifyUnderperformers(animals), [animals]);
  const bullProgeny = useMemo(() => compareBullProgeny(animals), [animals]);
  const raceBenchmarks = useMemo(() => generateRaceBenchmarks(animals), [animals]);

  // Comparação lado a lado
  const comparison = useMemo(() => {
    if (!compareAnimal1 || !compareAnimal2) return null;
    const a1 = animals.find(a => a.id === compareAnimal1);
    const a2 = animals.find(a => a.id === compareAnimal2);
    if (!a1 || !a2) return null;
    return compareAnimals(a1, a2);
  }, [compareAnimal1, compareAnimal2, animals]);

  const tabs = [
    { id: 'ranking', label: '🏆 Ranking GMD', count: topPerformers.length },
    { id: 'bulls', label: '🐂 Por Touro', count: bullProgeny.length },
    { id: 'breeds', label: '📊 Por Raça', count: raceBenchmarks.length },
    { id: 'compare', label: '⚖️ Comparar', count: null },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-white">Comparativo de Performance</h2>
        {underperformers.length > 0 && (
          <span className="px-3 py-1 bg-orange-900/30 text-orange-400 rounded-full text-sm">
            ⚠️ {underperformers.length} abaixo da média
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'bg-brand-primary text-white'
                : 'bg-base-700 text-gray-400 hover:bg-base-600'
            }`}
          >
            {tab.label}
            {tab.count !== null && (
              <span className="ml-2 text-xs opacity-70">({tab.count})</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-base-800 rounded-lg p-4">
        {/* Ranking GMD */}
        {activeTab === 'ranking' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-400 mb-4">
              Top 20 animais com melhor Ganho Médio Diário
            </p>

            {topPerformers.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                Sem dados suficientes de pesagens para calcular GMD
              </p>
            ) : (
              <div className="space-y-2">
                {topPerformers.map((animal, index) => {
                  const gmdClass = classificarGMD(animal.gmd);
                  const isTop3 = index < 3;
                  
                  return (
                    <div
                      key={animal.id}
                      onClick={() => onSelectAnimal(animal)}
                      className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                        isTop3 ? 'bg-gradient-to-r from-yellow-900/20 to-transparent border border-yellow-700/30' : 'bg-base-700 hover:bg-base-600'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold ${
                          index === 0 ? 'bg-yellow-500 text-black' :
                          index === 1 ? 'bg-gray-400 text-black' :
                          index === 2 ? 'bg-orange-600 text-white' :
                          'bg-base-600 text-gray-300'
                        }`}>
                          {index + 1}
                        </span>
                        <div>
                          <p className="text-white font-medium">
                            {animal.nome || animal.brinco}
                          </p>
                          <p className="text-xs text-gray-400">
                            {animal.raca} • {animal.pesoKg}kg
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold ${gmdClass.color}`}>
                          {formatarGMD(animal.gmd)}
                        </p>
                        <p className="text-xs text-gray-500">{gmdClass.label}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Underperformers */}
            {underperformers.length > 0 && (
              <div className="mt-6 pt-6 border-t border-base-700">
                <h4 className="text-sm font-semibold text-orange-400 mb-3">
                  ⚠️ Animais Abaixo da Média (GMD &lt; 70% da média)
                </h4>
                <div className="grid gap-2 md:grid-cols-2">
                  {underperformers.slice(0, 6).map(animal => (
                    <div
                      key={animal.id}
                      onClick={() => onSelectAnimal(animal)}
                      className="flex justify-between items-center p-2 bg-red-900/20 rounded cursor-pointer hover:bg-red-900/30"
                    >
                      <span className="text-white">{animal.nome || animal.brinco}</span>
                      <span className="text-red-400 text-sm">{animal.pesoKg}kg</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Por Touro */}
        {activeTab === 'bulls' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-400 mb-4">
              Performance média dos filhos de cada touro
            </p>

            {bullProgeny.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                Sem dados de paternidade cadastrados
              </p>
            ) : (
              <div className="space-y-3">
                {bullProgeny.map((bull, index) => (
                  <div key={bull.bullName} className="bg-base-700 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="text-white font-bold text-lg">{bull.bullName}</h4>
                        <p className="text-sm text-gray-400">{bull.offspringCount} filhos</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-xl font-bold ${classificarGMD(bull.avgGMD).color}`}>
                          {formatarGMD(bull.avgGMD)}
                        </p>
                        <p className="text-xs text-gray-500">GMD médio</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-3 border-t border-base-600">
                      <div>
                        <p className="text-xs text-gray-500">Peso Desmame Médio</p>
                        <p className="text-white font-medium">
                          {bull.avgWeaningWeight ? `${bull.avgWeaningWeight.toFixed(1)} kg` : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Melhor Filho</p>
                        <p className="text-white font-medium">
                          {bull.bestOffspring.brinco} ({formatarGMD(bull.bestOffspring.gmd)})
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Por Raça */}
        {activeTab === 'breeds' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-400 mb-4">
              Benchmark de performance por raça
            </p>

            {raceBenchmarks.map(benchmark => (
              <div key={benchmark.raca} className="bg-base-700 rounded-lg p-4">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-white font-bold text-lg">{benchmark.raca}</h4>
                  <span className="px-2 py-1 bg-base-600 rounded text-sm text-gray-300">
                    {benchmark.count} animais
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-brand-primary">
                      {benchmark.avgWeight.toFixed(0)}
                    </p>
                    <p className="text-xs text-gray-500">Peso Médio (kg)</p>
                  </div>
                  <div>
                    <p className={`text-2xl font-bold ${classificarGMD(benchmark.avgGMD).color}`}>
                      {benchmark.avgGMD.toFixed(3)}
                    </p>
                    <p className="text-xs text-gray-500">GMD Médio</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">
                      {benchmark.avgAge.toFixed(0)}
                    </p>
                    <p className="text-xs text-gray-500">Idade Média (m)</p>
                  </div>
                </div>

                {benchmark.topPerformers.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-base-600">
                    <p className="text-xs text-gray-500 mb-2">Top 3 da raça:</p>
                    <div className="flex gap-2">
                      {benchmark.topPerformers.slice(0, 3).map((p, i) => (
                        <span key={p.animalId} className="px-2 py-1 bg-base-600 rounded text-xs text-white">
                          {i + 1}. {p.brinco}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Comparar */}
        {activeTab === 'compare' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-400 mb-4">
              Compare dois animais lado a lado
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Animal 1</label>
                <select
                  value={compareAnimal1}
                  onChange={(e) => setCompareAnimal1(e.target.value)}
                  className="w-full px-3 py-2 bg-base-700 border border-base-600 rounded-lg text-white"
                >
                  <option value="">Selecione...</option>
                  {animals.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.nome || a.brinco} ({a.pesoKg}kg)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Animal 2</label>
                <select
                  value={compareAnimal2}
                  onChange={(e) => setCompareAnimal2(e.target.value)}
                  className="w-full px-3 py-2 bg-base-700 border border-base-600 rounded-lg text-white"
                >
                  <option value="">Selecione...</option>
                  {animals.filter(a => a.id !== compareAnimal1).map(a => (
                    <option key={a.id} value={a.id}>
                      {a.nome || a.brinco} ({a.pesoKg}kg)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {comparison && (
              <div className="mt-6 bg-base-700 rounded-lg p-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  {/* Animal 1 */}
                  <div className={comparison.winner.gmd === '1' ? 'ring-2 ring-green-500 rounded-lg p-3' : 'p-3'}>
                    <h4 className="font-bold text-white mb-2">
                      {comparison.animal1.nome || comparison.animal1.brinco}
                    </h4>
                    <p className="text-3xl font-bold text-brand-primary">{comparison.animal1.peso} kg</p>
                    <p className={`text-lg ${classificarGMD(comparison.animal1.gmd).color}`}>
                      {formatarGMD(comparison.animal1.gmd)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{comparison.animal1.idade} meses</p>
                  </div>

                  {/* VS */}
                  <div className="flex flex-col items-center justify-center">
                    <span className="text-2xl text-gray-500">VS</span>
                    {comparison.percentDiff.gmd !== 0 && (
                      <p className={`text-sm mt-2 ${comparison.percentDiff.gmd > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {comparison.percentDiff.gmd > 0 ? '+' : ''}{comparison.percentDiff.gmd.toFixed(1)}% GMD
                      </p>
                    )}
                  </div>

                  {/* Animal 2 */}
                  <div className={comparison.winner.gmd === '2' ? 'ring-2 ring-green-500 rounded-lg p-3' : 'p-3'}>
                    <h4 className="font-bold text-white mb-2">
                      {comparison.animal2.nome || comparison.animal2.brinco}
                    </h4>
                    <p className="text-3xl font-bold text-brand-primary">{comparison.animal2.peso} kg</p>
                    <p className={`text-lg ${classificarGMD(comparison.animal2.gmd).color}`}>
                      {formatarGMD(comparison.animal2.gmd)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{comparison.animal2.idade} meses</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PerformanceComparisonView;
