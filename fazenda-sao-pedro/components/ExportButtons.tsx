import React from 'react';
import { Animal, FilteredStats, ManagementArea } from '../types';
import { exportToCSV, exportToPDF, prepareAnimalDataForExport, CSV_HEADERS } from '../utils/fileUtils';

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
    </div>
  );
};

export default ExportButtons;