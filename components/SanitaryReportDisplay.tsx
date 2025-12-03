import React, { useState, useMemo } from 'react';
import { SanitaryReportData, TopTreatedAnimal } from '../types';
import BarChart from './common/BarChart';
import { ChevronUpIcon, ChevronDownIcon, SparklesIcon } from './common/Icons';

interface SanitaryReportDisplayProps {
  data: SanitaryReportData;
}

interface SortableHeaderProps {
  sortKey: keyof TopTreatedAnimal;
  label: string;
}

const SanitaryReportDisplay = ({ data }: SanitaryReportDisplayProps) => {
  const [sortConfig, setSortConfig] = useState<{ key: keyof TopTreatedAnimal; direction: 'asc' | 'desc' }>({ key: 'treatmentCount', direction: 'desc' });
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [expandedMedication, setExpandedMedication] = useState<string | null>(null);

  const sortedAnimals = useMemo(() => {
    let sortableItems = [...data.topTreatedAnimals];
    if (sortConfig) {
      sortableItems.sort((a, b) => {
        const key = sortConfig.key;
        let comparison = 0;

        switch (key) {
          case 'brinco':
            comparison = a.brinco.localeCompare(b.brinco);
            break;
          case 'nome':
            comparison = a.nome.localeCompare(b.nome);
            break;
          case 'treatmentCount':
            comparison = a.treatmentCount - b.treatmentCount;
            break;
        }

        return sortConfig.direction === 'asc' ? comparison : -comparison;
      });
    }
    return sortableItems;
  }, [data.topTreatedAnimals, sortConfig]);

  const requestSort = (key: keyof TopTreatedAnimal) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };
  
  const handleMonthToggle = (monthLabel: string) => {
    setExpandedMonth(prev => (prev === monthLabel ? null : monthLabel));
  };

  const handleMedicationToggle = (medLabel: string) => {
    setExpandedMedication(prev => (prev === medLabel ? null : medLabel));
  };

  const maxSeasonalValue = useMemo(() => 
    Math.max(...data.seasonalAnalysis.map(d => d.value), 1), // Use 1 to avoid division by zero
    [data.seasonalAnalysis]
  );
  
  const maxMedicationValue = useMemo(() =>
    Math.max(...data.medicationUsage.map(d => d.value), 1),
    [data.medicationUsage]
  );
  
  const colors = [
    'bg-brand-primary',
    'bg-brand-accent-dark',
    'bg-brand-primary-light/80',
    'bg-brand-accent/80',
    'bg-brand-primary/60'
  ];

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

  return (
    <div className="space-y-6">
        {/* --- Charts Grid --- */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-base-800 p-4 rounded-lg shadow-md print-bg-visible">
                <h3 className="font-bold text-white mb-4">Medicamentos Mais Utilizados</h3>
                {data.medicationUsage.length > 0 ? (
                    <div className="space-y-1">
                        {data.medicationUsage.map((medData) => (
                            <div key={medData.label}>
                                <button 
                                    onClick={() => handleMedicationToggle(medData.label)} 
                                    className="w-full p-2 rounded-md hover:bg-base-700/50 transition-colors flex items-center gap-2 text-left"
                                    aria-expanded={expandedMedication === medData.label}
                                    aria-controls={`details-med-${medData.label.replace(/[^a-zA-Z0-9]/g, '')}`}
                                >
                                    <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${expandedMedication === medData.label ? 'rotate-0' : '-rotate-90'}`} />
                                    <span className="text-sm font-medium text-gray-300 w-28 truncate">{medData.label}</span>
                                    <div className="flex-1 bg-base-900/50 rounded-full h-5 overflow-hidden">
                                        <div 
                                            className="bg-brand-primary h-full rounded-full flex items-center justify-end pr-2"
                                            style={{ width: `${(medData.value / maxMedicationValue) * 100}%` }}
                                        >
                                            <span className="text-xs font-bold text-white">{medData.value}</span>
                                        </div>
                                    </div>
                                </button>
                                <div 
                                    id={`details-med-${medData.label.replace(/[^a-zA-Z0-9]/g, '')}`}
                                    className={`ml-8 pl-4 py-2 border-l-2 border-base-700 space-y-2 overflow-hidden transition-all duration-300 ${expandedMedication === medData.label ? 'max-h-96' : 'max-h-0'} print:max-h-full print:block`}
                                >
                                    {expandedMedication === medData.label && (
                                        (() => {
                                            const maxMonthlyValue = Math.max(...medData.monthlyUsage.map(m => m.value), 1);
                                            return (
                                                <>
                                                    <h4 className="text-xs font-semibold text-gray-400 uppercase">Utilização por mês:</h4>
                                                    {medData.monthlyUsage.length > 0 ? medData.monthlyUsage.map((month, index) => (
                                                        <div key={month.label} className="grid grid-cols-3 gap-2 items-center text-sm">
                                                            <div className="truncate text-gray-300 text-xs text-right pr-2">{month.label}</div>
                                                            <div className="col-span-2 flex items-center">
                                                                <div 
                                                                    className={`rounded-r-md h-4 ${colors[index % colors.length]}`}
                                                                    style={{ width: `${(month.value / maxMonthlyValue) * 100}%` }}
                                                                />
                                                                <span className="ml-2 text-xs font-semibold text-white">{month.value}</span>
                                                            </div>
                                                        </div>
                                                    )) : <p className="text-xs text-gray-500">Nenhum registro de uso mensal.</p>}
                                                </>
                                            );
                                        })()
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-gray-500 text-sm text-center py-8">Sem dados para exibir.</p>
                )}
            </div>
            <BarChart title="Análise por Motivo de Aplicação" data={data.reasonAnalysis} />
        </div>
        
        {/* --- Correlated Seasonal Analysis --- */}
        <div className="bg-base-800 p-4 rounded-lg shadow-md print-bg-visible">
            <h3 className="font-bold text-white mb-4">Análise Sazonal de Aplicações Correlacionada</h3>
            {data.seasonalAnalysis.length > 0 ? (
                <div className="space-y-1">
                    {data.seasonalAnalysis.map((monthData) => (
                        <div key={monthData.label}>
                            <button 
                                onClick={() => handleMonthToggle(monthData.label)} 
                                className="w-full p-2 rounded-md hover:bg-base-700/50 transition-colors flex items-center gap-2 text-left"
                                aria-expanded={expandedMonth === monthData.label}
                                aria-controls={`details-${monthData.label.replace(/[^a-zA-Z0-9]/g, '')}`}
                            >
                                <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${expandedMonth === monthData.label ? 'rotate-0' : '-rotate-90'}`} />
                                <span className="text-sm font-medium text-gray-300 w-20 truncate">{monthData.label}</span>
                                <div className="flex-1 bg-base-900/50 rounded-full h-5 overflow-hidden">
                                    <div 
                                        className="bg-brand-accent-dark h-full rounded-full flex items-center justify-end pr-2"
                                        style={{ width: `${(monthData.value / maxSeasonalValue) * 100}%` }}
                                    >
                                        <span className="text-xs font-bold text-white">{monthData.value}</span>
                                    </div>
                                </div>
                            </button>
                            <div 
                                id={`details-${monthData.label.replace(/[^a-zA-Z0-9]/g, '')}`}
                                className={`ml-8 pl-4 py-2 border-l-2 border-base-700 space-y-2 overflow-hidden transition-all duration-300 ${expandedMonth === monthData.label ? 'max-h-96' : 'max-h-0'} print:max-h-full print:block`}
                            >
                                {expandedMonth === monthData.label && (
                                    <>
                                        <h4 className="text-xs font-semibold text-gray-400 uppercase">Medicamentos mais usados neste mês:</h4>
                                        {monthData.medications.length > 0 ? monthData.medications.map((med, index) => (
                                            <div key={med.label} className="grid grid-cols-3 gap-2 items-center text-sm">
                                                <div className="truncate text-gray-300 text-xs text-right pr-2">{med.label}</div>
                                                <div className="col-span-2 flex items-center">
                                                    <div 
                                                        className={`rounded-r-md h-4 ${colors[index % colors.length]}`}
                                                        style={{ width: `${(med.value / monthData.medications[0].value) * 100}%` }}
                                                    />
                                                    <span className="ml-2 text-xs font-semibold text-white">{med.value}</span>
                                                </div>
                                            </div>
                                        )) : <p className="text-xs text-gray-500">Nenhum medicamento registrado.</p>}
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-gray-500 text-sm text-center py-8">Sem dados sazonais para exibir.</p>
            )}
        </div>

        {/* --- Data Table and Recommendations --- */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3 bg-base-800 p-4 rounded-lg shadow-md print-bg-visible">
                <h3 className="font-bold text-white mb-4">Animais com Mais Tratamentos</h3>
                 <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-base-700">
                        <thead className="bg-base-900/50">
                        <tr>
                            <SortableHeader sortKey="brinco" label="Brinco" />
                            <SortableHeader sortKey="nome" label="Nome" />
                            <SortableHeader sortKey="treatmentCount" label="Tratamentos" />
                        </tr>
                        </thead>
                        <tbody className="bg-base-800 divide-y divide-base-700">
                        {sortedAnimals.map((animal) => (
                            <tr key={animal.animalId}>
                                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-white">{animal.brinco}</td>
                                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-300">{animal.nome}</td>
                                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-300 text-center">{animal.treatmentCount}</td>
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

export default SanitaryReportDisplay;
