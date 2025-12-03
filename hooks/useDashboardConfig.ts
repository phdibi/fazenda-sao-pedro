import { useState, useEffect, useCallback } from 'react';
import { 
  DashboardConfig, 
  DashboardWidget, 
  DashboardWidgetType,
  DEFAULT_DASHBOARD_CONFIG,
  DEFAULT_DASHBOARD_WIDGETS
} from '../types';

const STORAGE_KEY = 'fazenda_dashboard_config';

interface UseDashboardConfigReturn {
  config: DashboardConfig;
  enabledWidgets: DashboardWidget[];
  toggleWidget: (widgetId: string) => void;
  reorderWidgets: (widgetId: string, newOrder: number) => void;
  setWidgetSize: (widgetId: string, size: 'small' | 'medium' | 'large') => void;
  setLayout: (layout: 'grid' | 'list') => void;
  setCompactMode: (compact: boolean) => void;
  resetToDefault: () => void;
  isWidgetEnabled: (type: DashboardWidgetType) => boolean;
}

export const useDashboardConfig = (): UseDashboardConfigReturn => {
  const [config, setConfig] = useState<DashboardConfig>(() => {
    // Tenta carregar do localStorage
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Mescla com defaults para garantir que novos widgets sejam incluídos
        const mergedWidgets = DEFAULT_DASHBOARD_WIDGETS.map(defaultWidget => {
          const savedWidget = parsed.widgets?.find((w: DashboardWidget) => w.type === defaultWidget.type);
          return savedWidget ? { ...defaultWidget, ...savedWidget } : defaultWidget;
        });
        return {
          ...DEFAULT_DASHBOARD_CONFIG,
          ...parsed,
          widgets: mergedWidgets,
        };
      }
    } catch (e) {
      console.warn('Erro ao carregar configuração do dashboard:', e);
    }
    return DEFAULT_DASHBOARD_CONFIG;
  });

  // Salvar no localStorage sempre que mudar
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch (e) {
      console.warn('Erro ao salvar configuração do dashboard:', e);
    }
  }, [config]);

  // Widgets habilitados e ordenados
  const enabledWidgets = config.widgets
    .filter(w => w.enabled)
    .sort((a, b) => a.order - b.order);

  // Toggle widget on/off
  const toggleWidget = useCallback((widgetId: string) => {
    setConfig(prev => ({
      ...prev,
      widgets: prev.widgets.map(w =>
        w.id === widgetId ? { ...w, enabled: !w.enabled } : w
      ),
    }));
  }, []);

  // Reordenar widget
  const reorderWidgets = useCallback((widgetId: string, newOrder: number) => {
    setConfig(prev => {
      const widgets = [...prev.widgets];
      const widgetIndex = widgets.findIndex(w => w.id === widgetId);
      if (widgetIndex === -1) return prev;

      const [widget] = widgets.splice(widgetIndex, 1);
      widget.order = newOrder;

      // Reajustar ordem dos outros widgets
      widgets.forEach((w, i) => {
        if (w.order >= newOrder) {
          w.order = w.order + 1;
        }
      });

      widgets.push(widget);
      widgets.sort((a, b) => a.order - b.order);

      // Normalizar ordens
      widgets.forEach((w, i) => {
        w.order = i + 1;
      });

      return { ...prev, widgets };
    });
  }, []);

  // Alterar tamanho do widget
  const setWidgetSize = useCallback((widgetId: string, size: 'small' | 'medium' | 'large') => {
    setConfig(prev => ({
      ...prev,
      widgets: prev.widgets.map(w =>
        w.id === widgetId ? { ...w, size } : w
      ),
    }));
  }, []);

  // Alterar layout
  const setLayout = useCallback((layout: 'grid' | 'list') => {
    setConfig(prev => ({ ...prev, layout }));
  }, []);

  // Alterar modo compacto
  const setCompactMode = useCallback((compactMode: boolean) => {
    setConfig(prev => ({ ...prev, compactMode }));
  }, []);

  // Reset para padrão
  const resetToDefault = useCallback(() => {
    setConfig(DEFAULT_DASHBOARD_CONFIG);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // Verificar se widget está habilitado por tipo
  const isWidgetEnabled = useCallback((type: DashboardWidgetType): boolean => {
    return config.widgets.find(w => w.type === type)?.enabled ?? false;
  }, [config.widgets]);

  return {
    config,
    enabledWidgets,
    toggleWidget,
    reorderWidgets,
    setWidgetSize,
    setLayout,
    setCompactMode,
    resetToDefault,
    isWidgetEnabled,
  };
};