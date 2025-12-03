import React from 'react';
import { DashboardWidget } from '../types';

interface DashboardSettingsProps {
  widgets: DashboardWidget[];
  toggleWidget: (id: string) => void;
  setWidgetSize: (id: string, size: 'small' | 'medium' | 'large') => void;
  resetToDefault: () => void;
  onClose: () => void;
}

const DashboardSettings: React.FC<DashboardSettingsProps> = ({
  widgets,
  toggleWidget,
  setWidgetSize,
  resetToDefault,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-base-800 rounded-lg p-6 w-full max-w-md max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">Configurar Dashboard</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>

        <div className="space-y-3">
          {widgets.map(widget => (
            <div key={widget.id} className="flex items-center justify-between p-3 bg-base-700 rounded-lg">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={widget.enabled}
                  onChange={() => toggleWidget(widget.id)}
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm">{widget.title}</span>
              </div>
              <select
                value={widget.size}
                onChange={(e) => setWidgetSize(widget.id, e.target.value as 'small' | 'medium' | 'large')}
                disabled={!widget.enabled}
                className="bg-base-600 text-xs rounded px-2 py-1"
              >
                <option value="small">P</option>
                <option value="medium">M</option>
                <option value="large">G</option>
              </select>
            </div>
          ))}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={resetToDefault}
            className="flex-1 py-2 bg-base-700 hover:bg-base-600 rounded-lg text-sm"
          >
            Restaurar Padrão
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2 bg-brand-primary hover:bg-brand-primary-dark rounded-lg text-sm"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default DashboardSettings;