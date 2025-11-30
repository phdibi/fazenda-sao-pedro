import React from 'react';
import { FilteredStats, DashboardWidget, ManagementArea } from '../types';

interface StatsDashboardProps {
  stats: FilteredStats;
  enabledWidgets: DashboardWidget[];
  areas: ManagementArea[];
  compactMode?: boolean;
}

const StatsDashboard: React.FC<StatsDashboardProps> = ({
  stats,
  enabledWidgets,
  areas,
  compactMode = false,
}) => {
  const getWidgetSize = (size: 'small' | 'medium' | 'large') => {
    if (compactMode) return 'col-span-1';
    switch (size) {
      case 'small': return 'col-span-1';
      case 'medium': return 'col-span-1 md:col-span-2';
      case 'large': return 'col-span-1 md:col-span-2 lg:col-span-3';
    }
  };

  const renderWidget = (widget: DashboardWidget) => {
    switch (widget.type) {
      case 'breed-distribution':
        return (
          <div className="space-y-2">
            {Object.entries(stats.breedDistribution).map(([raca, count]) => (
              <div key={raca} className="flex justify-between items-center">
                <span className="text-sm text-gray-300">{raca}</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 bg-base-700 rounded-full h-2">
                    <div
                      className="bg-brand-primary h-2 rounded-full"
                      style={{ width: `${(count / stats.totalAnimals) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium w-8">{count}</span>
                </div>
              </div>
            ))}
            {Object.keys(stats.breedDistribution).length === 0 && (
              <p className="text-sm text-gray-500 text-center">Sem dados</p>
            )}
          </div>
        );

      case 'sex-distribution':
        const malePercent = stats.totalAnimals > 0 ? (stats.maleCount / stats.totalAnimals) * 100 : 0;
        return (
          <div className="flex items-center justify-center gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">{stats.maleCount}</div>
              <div className="text-xs text-gray-400">Machos</div>
            </div>
            <div className="w-20 h-20 relative">
              <svg viewBox="0 0 36 36" className="w-full h-full">
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#4a5568"
                  strokeWidth="3"
                />
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#60a5fa"
                  strokeWidth="3"
                  strokeDasharray={`${malePercent}, 100`}
                />
              </svg>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-pink-400">{stats.femaleCount}</div>
              <div className="text-xs text-gray-400">Fêmeas</div>
            </div>
          </div>
        );

      case 'age-distribution':
        const ageData = [
          { label: 'Bezerros (0-6m)', value: stats.ageDistribution.bezerros, color: 'bg-green-500' },
          { label: 'Jovens (6-12m)', value: stats.ageDistribution.jovens, color: 'bg-yellow-500' },
          { label: 'Novilhos (12-24m)', value: stats.ageDistribution.novilhos, color: 'bg-orange-500' },
          { label: 'Adultos (24m+)', value: stats.ageDistribution.adultos, color: 'bg-red-500' },
        ];
        return (
          <div className="space-y-2">
            {ageData.map(item => (
              <div key={item.label} className="flex justify-between items-center">
                <span className="text-sm text-gray-300">{item.label}</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 bg-base-700 rounded-full h-2">
                    <div
                      className={`${item.color} h-2 rounded-full`}
                      style={{ width: `${stats.activeCount > 0 ? (item.value / stats.activeCount) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium w-8">{item.value}</span>
                </div>
              </div>
            ))}
          </div>
        );

      case 'weight-chart':
        const weightData = [
          { label: 'Leve (<200kg)', value: stats.weightRangeDistribution.leve },
          { label: 'Médio (200-400kg)', value: stats.weightRangeDistribution.medio },
          { label: 'Pesado (>400kg)', value: stats.weightRangeDistribution.pesado },
        ];
        return (
          <div className="space-y-3">
            <div className="text-center mb-4">
              <div className="text-3xl font-bold text-brand-primary">
                {stats.averageWeight.toFixed(1)} kg
              </div>
              <div className="text-xs text-gray-400">Peso Médio</div>
            </div>
            {weightData.map(item => (
              <div key={item.label} className="flex justify-between items-center">
                <span className="text-sm text-gray-300">{item.label}</span>
                <span className="text-sm font-medium">{item.value}</span>
              </div>
            ))}
          </div>
        );

      case 'area-distribution':
        return (
          <div className="space-y-2">
            {Object.entries(stats.areaDistribution).map(([area, count]) => (
              <div key={area} className="flex justify-between items-center">
                <span className="text-sm text-gray-300 truncate">{area}</span>
                <span className="text-sm font-medium">{count}</span>
              </div>
            ))}
            {Object.keys(stats.areaDistribution).length === 0 && (
              <p className="text-sm text-gray-500 text-center">Sem dados</p>
            )}
          </div>
        );

      case 'health-summary':
        return (
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-400">Total de Tratamentos</span>
              <span className="font-medium">{stats.healthStats.totalTreatments}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-400">Animais Tratados</span>
              <span className="font-medium">{stats.healthStats.animalsWithTreatments}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-400">Medicamento Mais Usado</span>
              <span className="font-medium text-brand-primary truncate ml-2">
                {stats.healthStats.mostUsedMedication}
              </span>
            </div>
          </div>
        );

      default:
        return <p className="text-gray-500 text-sm">Widget não implementado</p>;
    }
  };

  return (
    <div className={`grid gap-4 mb-6 ${compactMode ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
      {/* Cards de resumo fixos */}
      <div className="bg-base-800 rounded-lg p-4 border-l-4 border-brand-primary">
        <div className="text-2xl font-bold">{stats.totalAnimals}</div>
        <div className="text-xs text-gray-400">Total Filtrado</div>
      </div>
      <div className="bg-base-800 rounded-lg p-4 border-l-4 border-green-500">
        <div className="text-2xl font-bold">{stats.activeCount}</div>
        <div className="text-xs text-gray-400">Ativos</div>
      </div>
      <div className="bg-base-800 rounded-lg p-4 border-l-4 border-blue-500">
        <div className="text-2xl font-bold">{stats.averageWeight.toFixed(1)} kg</div>
        <div className="text-xs text-gray-400">Peso Médio</div>
      </div>

      {/* Widgets dinâmicos */}
      {enabledWidgets.map(widget => (
        <div
          key={widget.id}
          className={`bg-base-800 rounded-lg p-4 ${getWidgetSize(widget.size)}`}
        >
          <h3 className="text-sm font-semibold text-gray-300 mb-3">{widget.title}</h3>
          {renderWidget(widget)}
        </div>
      ))}
    </div>
  );
};

export default StatsDashboard;