import React, { useState, useMemo } from 'react';
import { ReproductiveReportData, DamPerformanceData } from '../types';
import { ChevronUpIcon, ChevronDownIcon, SparklesIcon } from './common/Icons';

interface ReproductiveReportDisplayProps {
  data: ReproductiveReportData;
}

interface SortableHeaderProps {
  sortKey: keyof DamPerformanceData;
  label: string;
}

const ReproductiveReportDisplay = ({ data }: ReproductiveReportDisplayProps) => {
  const [sortConfig, setSortConfig] = useState<{ key: keyof DamPerformanceData; direction: 'asc' | 'desc' }>({ key: 'offspringCount', direction: 'desc' });

  const sortedDams = useMemo(() => {
    let sortableItems = [...data.performanceData];
    if (sortConfig) {
      sortableItems.sort((a, b) => {
        const key = sortConfig.key;
        let comparison = 0;
        
        // Helper for sorting nullable numbers. Nulls/undefined go to the bottom.
        const compareNullableNumbers = (numA?: number, numB?: number): number => {
            if (numA == null && numB == null) return 0;
            if (numA == null) return 1; // a is greater (goes down)
            if (numB == null) return -1; // b is greater (a goes up)
            return numA - numB;
        };

        // Helper for sorting nullable strings. Nulls/undefined go to the bottom.
        const compareNullableStrings = (strA?: string, strB?: string): number => {
            if (strA == null && strB == null) return 0;
            if (strA == null) return 1;
            if (strB == null) return -1;
            return strA.localeCompare(strB);
        };
        
        switch (key) {
            case 'damBrinco':
                comparison = a.damBrinco.localeCompare(b.damBrinco);
                break;
            case 'damNome':
                comparison = compareNullableStrings(a.damNome, b.damNome);
                break;
            case 'offspringCount':
                comparison = a.offspringCount - b.offspringCount;
                break;
            case 'avgBirthWeight':
                comparison = compareNullableNumbers(a.avgBirthWeight, b.avgBirthWeight);
                break;
            case 'avgWeaningWeight':
                comparison = compareNullableNumbers(a.avgWeaningWeight, b.avgWeaningWeight);
                break;
            case 'avgYearlingWeight':
                comparison = compareNullableNumbers(a.avgYearlingWeight, b.avgYearlingWeight);
                break;
        }

        return sortConfig.direction === 'asc' ? comparison : -comparison;
      });
    }
    return sortableItems;
  }, [data.performanceData, sortConfig]);

  const requestSort = (key: keyof DamPerformanceData) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };
  
  const SortableHeader = ({ sortKey, label }: SortableHeaderProps) => {
    const isSorted = sortConfig.key === sortKey;
    return (
        <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
            <button onClick={() => requestSort(sortKey)} className="flex items-center gap-1">
                {label}
                {isSorted && sortConfig.direction === 'asc' && <ChevronUpIcon className="w-3 h-3" />}
                {isSorted && sortConfig.direction === 'desc' && <ChevronDownIcon className="w-3 h-3" />}
            </button>
        </th>
    )
  };

  const renderRecommendations = (text: string) => {
     return text.split('. ').map((sentence, index) => {
        if (!sentence) return null;
        const parts = sentence.split('**');
        return (
            <li key={index} className="mb-2">
                {parts.map((part, i) => i % 2 === 1 ? <strong key={i} className="text-brand-primary-light">{part}</strong> : part)}
            </li>
        )
     });
  }

  if (!data || data.performanceData.length === 0) {
      return (
          <div className="bg-base-800 p-8 rounded-lg text-center">
              <h3 className="font-bold text-white mb-4">Análise de Desempenho Reprodutivo</h3>
              <p className="text-gray-500">Não há dados de progênie suficientes para gerar este relatório.</p>
              <p className="text-gray-500 text-sm mt-2">Adicione animais e registre o histórico de progênie de suas fêmeas.</p>
          </div>
      )
  }

  return (
    <div className="space-y-6">
        {/* --- Data Table and Recommendations --- */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3 bg-base-800 p-4 rounded-lg shadow-md print-bg-visible">
                <h3 className="font-bold text-white mb-4">Desempenho das Matrizes</h3>
                 <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-base-700">
                        <thead className="bg-base-900/50">
                        <tr>
                            <SortableHeader sortKey="damBrinco" label="Brinco" />
                            <SortableHeader sortKey="damNome" label="Nome" />
                            <SortableHeader sortKey="offspringCount" label="Nº Crias" />
                            <SortableHeader sortKey="avgBirthWeight" label="Média Nasc. (kg)" />
                            <SortableHeader sortKey="avgWeaningWeight" label="Média Desm. (kg)" />
                            <SortableHeader sortKey="avgYearlingWeight" label="Média Sobreano (kg)" />
                        </tr>
                        </thead>
                        <tbody className="bg-base-800 divide-y divide-base-700">
                        {sortedDams.map((dam) => (
                            <tr key={dam.damId}>
                                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-white">{dam.damBrinco}</td>
                                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-300">{dam.damNome || 'N/A'}</td>
                                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-300 text-center">{dam.offspringCount}</td>
                                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-300 text-center">{dam.avgBirthWeight?.toFixed(2) || '-'}</td>
                                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-300 text-center">{dam.avgWeaningWeight?.toFixed(2) || '-'}</td>
                                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-300 text-center">{dam.avgYearlingWeight?.toFixed(2) || '-'}</td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            </div>
            <div className="lg:col-span-2 bg-base-800 p-4 rounded-lg shadow-md print-bg-visible">
                 <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                    <SparklesIcon className="w-5 h-5 text-brand-primary-light" />
                    Recomendações Estratégicas da IA
                </h3>
                <ul className="list-disc pl-5 space-y-2 text-sm text-gray-300">
                   {renderRecommendations(data.recommendations)}
                </ul>
            </div>
        </div>
    </div>
  );
};

export default ReproductiveReportDisplay;
