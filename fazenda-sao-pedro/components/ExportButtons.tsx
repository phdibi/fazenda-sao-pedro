import React from 'react';
import { Animal, FilteredStats, ManagementArea } from '../types';
import { exportToCSV, exportToPDF, prepareAnimalDataForExport, CSV_HEADERS } from '../utils/fileUtils';

interface ExportButtonsProps {
  animals: Animal[];
  stats: FilteredStats;
  areas: ManagementArea[];
}

const ExportButtons: React.FC<ExportButtonsProps> = ({ animals, stats, areas }) => {
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

  return (
    <div className="flex gap-2">
      <button
        onClick={handleCSV}
        className="px-3 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm flex items-center gap-2"
      >
        <span>📊</span> CSV
      </button>
      <button
        onClick={handlePDF}
        className="px-3 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm flex items-center gap-2"
      >
        <span>📄</span> PDF
      </button>
    </div>
  );
};

export default ExportButtons;