import React from 'react';

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon: string;
  color: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ label, value, unit, icon, color }) => (
  <div className={`bg-base-800 rounded-lg p-4 border-l-4 ${color}`}>
    <div className="flex items-center justify-between">
      <span className="text-2xl">{icon}</span>
      <div className="text-right">
        <div className="text-xl font-bold text-white">
          {value}
          {unit && <span className="text-sm text-gray-400 ml-1">{unit}</span>}
        </div>
        <div className="text-xs text-gray-400">{label}</div>
      </div>
    </div>
  </div>
);

export default MetricCard;
