import React from 'react';
import { Animal, FilteredStats, ManagementArea } from '../types';
import {
  CSV_HEADERS,
  exportCalfSnapshotToCSV,
  exportCalfSnapshotToPDF,
  exportToCSV,
  exportToPDF,
  prepareAnimalDataForExport,
} from '../utils/fileUtils';

interface ExportButtonsProps {
  animals: Animal[];
  stats: FilteredStats;
  areas: ManagementArea[];
  variant?: 'default' | 'compact';
}

const ExportButtons: React.FC<ExportButtonsProps> = ({ animals, stats, areas, variant = 'default' }) => {
  const handleCSV = () => {
    const data = prepareAnimalDataForExport(animals);
    exportToCSV(data, CSV_HEADERS, `animais_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const handlePDF = () => {
    exportToPDF(animals, stats, areas, {
      title: 'Relatório de Animais',
      subtitle: `${animals.length} animais filtrados`,
      includeStats: true,
      includeDate: true,
    });
  };

  const handleCalfCSV = () => {
    exportCalfSnapshotToCSV(animals, areas);
  };

  const handleCalfPDF = () => {
    exportCalfSnapshotToPDF(animals, areas);
  };

  const baseButtonClasses =
    'px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors';

  const containerClasses =
    variant === 'compact' ? 'grid grid-cols-2 gap-2 w-full' : 'flex gap-2';

  return (
    <div className={containerClasses}>
      <button
        onClick={handleCSV}
        className={`${baseButtonClasses} bg-green-600 hover:bg-green-700 text-white`}
      >
        <span>📊</span>
        <span>CSV</span>
      </button>
      <button
        onClick={handlePDF}
        className={`${baseButtonClasses} bg-red-600 hover:bg-red-700 text-white`}
      >
        <span>📄</span>
        <span>PDF</span>
      </button>
      <button
        onClick={handleCalfCSV}
        className={`${baseButtonClasses} bg-amber-600 hover:bg-amber-700 text-white`}
        title="Exporta somente terneiros com pesos de desmame/sobreano e genealogia materna para arquivar antes da venda"
      >
        <span>🍼</span>
        <span>Terneiros CSV</span>
      </button>
      <button
        onClick={handleCalfPDF}
        className={`${baseButtonClasses} bg-amber-700 hover:bg-amber-800 text-white`}
        title="Gera PDF com pesos por fase e mãe para arquivar antes da venda anual"
      >
        <span>📔</span>
        <span>Terneiros PDF</span>
      </button>
    </div>
  );
};

export default ExportButtons;
