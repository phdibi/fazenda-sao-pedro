import React from 'react';
import { ChartDataPoint } from '../../types';

interface BarChartProps {
  data: ChartDataPoint[];
  title: string;
}

const BarChart = ({ data, title }: BarChartProps) => {
  if (!data || data.length === 0) {
    return (
      <div className="bg-base-800 p-4 rounded-lg shadow-md print-bg-visible">
        <h3 className="font-bold text-white mb-4">{title}</h3>
        <p className="text-gray-500 text-sm text-center py-8">Sem dados para exibir.</p>
      </div>
    );
  }

  const maxValue = Math.max(...data.map(d => d.value), 0);

  const colors = [
    'bg-brand-primary',
    'bg-brand-accent-dark',
    'bg-brand-primary-light/80',
    'bg-brand-accent/80',
    'bg-brand-primary/60'
  ];

  return (
    <div className="bg-base-800 p-4 rounded-lg shadow-md print-bg-visible">
      <h3 className="font-bold text-white mb-4">{title}</h3>
      <div className="space-y-3">
        {data.map((item, index) => (
          <div key={item.label} className="grid grid-cols-3 gap-2 items-center text-sm">
            <div className="truncate text-gray-300 text-xs text-right pr-2">{item.label}</div>
            <div className="col-span-2 flex items-center">
              <div 
                className={`rounded-r-md h-5 ${colors[index % colors.length]}`}
                style={{ width: `${(item.value / maxValue) * 100}%` }}
              />
              <span className="ml-2 font-semibold text-white">{item.value}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BarChart;
