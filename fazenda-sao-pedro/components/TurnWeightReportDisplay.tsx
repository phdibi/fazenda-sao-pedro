import React from 'react';
import { TurnWeightAnalysis } from '../types';

interface TurnWeightReportDisplayProps {
  data: TurnWeightAnalysis;
}

const TurnWeightReportDisplay: React.FC<TurnWeightReportDisplayProps> = ({ data }) => {
  if (data.totalAnimals === 0) {
    return (
      <div className="text-center text-gray-400 py-10 bg-base-800 rounded-lg">
        <p>Nenhum dado de Peso de Virada encontrado no período selecionado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-base-800 p-4 rounded-lg shadow-lg">
          <h3 className="text-gray-400 text-sm font-medium">Animais Avaliados</h3>
          <p className="text-3xl font-bold text-white mt-1">{data.totalAnimals}</p>
        </div>
        <div className="bg-base-800 p-4 rounded-lg shadow-lg">
          <h3 className="text-gray-400 text-sm font-medium">Média Peso de Virada</h3>
          <p className="text-3xl font-bold text-brand-primary mt-1">{data.averageWeight.toFixed(1)} kg</p>
        </div>
        <div className="bg-base-800 p-4 rounded-lg shadow-lg">
          <h3 className="text-gray-400 text-sm font-medium">Maior Peso</h3>
          <p className="text-3xl font-bold text-green-400 mt-1">
            {data.topPerformers[0]?.weight} kg
            <span className="text-sm text-gray-400 ml-2 block font-normal">
              {data.topPerformers[0]?.brinco}
            </span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 5 */}
        <div className="bg-base-800 p-6 rounded-lg shadow-lg">
          <h3 className="text-lg font-bold text-white mb-4">Top 5 - Peso de Virada</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-base-700">
                  <th className="text-left py-2 text-gray-400 text-sm">Brinco</th>
                  <th className="text-left py-2 text-gray-400 text-sm">Raça</th>
                  <th className="text-right py-2 text-gray-400 text-sm">Peso (kg)</th>
                </tr>
              </thead>
              <tbody>
                {data.topPerformers.map((animal, idx) => (
                  <tr key={animal.brinco} className="border-b border-base-700/50 hover:bg-base-700/30">
                    <td className="py-3 text-white">
                        {idx === 0 && '🥇 '}
                        {idx === 1 && '🥈 '}
                        {idx === 2 && '🥉 '}
                        {animal.brinco}
                    </td>
                    <td className="py-3 text-gray-300">{animal.raca}</td>
                    <td className="py-3 text-right font-bold text-brand-primary">{animal.weight}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Por Raça */}
        <div className="bg-base-800 p-6 rounded-lg shadow-lg">
          <h3 className="text-lg font-bold text-white mb-4">Desempenho por Raça</h3>
          <div className="space-y-4">
            {data.breedAnalysis.map((breed) => (
              <div key={breed.raca} className="relative">
                <div className="flex justify-between items-end mb-1">
                  <span className="text-white font-medium">{breed.raca}</span>
                  <span className="text-sm text-gray-400">{breed.avgWeight.toFixed(1)} kg avg</span>
                </div>
                <div className="w-full bg-base-900 rounded-full h-2">
                  <div
                    className="bg-brand-secondary h-2 rounded-full"
                    style={{ width: `${(breed.avgWeight / (data.topPerformers[0]?.weight || 1)) * 100}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500 mt-1">{breed.count} animais</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recomendações da IA */}
      <div className="bg-gradient-to-r from-base-800 to-base-900 p-6 rounded-lg border border-brand-primary/20">
        <h3 className="text-lg font-bold text-brand-primary mb-2 flex items-center gap-2">
          <span>🤖</span> Análise da IA
        </h3>
        <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">
          {data.recommendations}
        </p>
      </div>
    </div>
  );
};

export default TurnWeightReportDisplay;
