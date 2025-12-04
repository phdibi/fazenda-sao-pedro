import React, { useState, useEffect, useMemo } from 'react';
import { WeatherData, WeatherAlert, Animal } from '../types';
import { 
  fetchWeatherForecast, 
  generateWeatherAlerts, 
  DEFAULT_LOCATION,
  correlateWeatherWithGMD,
  fetchWeatherHistory
} from '../services/weatherService';

interface WeatherWidgetProps {
  animals?: Animal[];
  expanded?: boolean;
}

const WeatherWidget: React.FC<WeatherWidgetProps> = ({ animals = [], expanded = false }) => {
  const [forecast, setForecast] = useState<WeatherData[]>([]);
  const [alerts, setAlerts] = useState<WeatherAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAll, setShowAll] = useState(expanded);

  useEffect(() => {
    // OTIMIZAÇÃO: Evita refetch se já tem dados em memória
    if (forecast.length > 0) {
      setIsLoading(false);
      return;
    }

    const loadWeather = async () => {
      setIsLoading(true);
      try {
        const data = await fetchWeatherForecast(
          DEFAULT_LOCATION.latitude,
          DEFAULT_LOCATION.longitude,
          7
        );
        setForecast(data);
        setAlerts(generateWeatherAlerts(data));
      } catch (error) {
        console.error('Erro ao carregar clima:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadWeather();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const today = forecast[0];
  const nextDays = forecast.slice(1, showAll ? 7 : 4);

  const conditionIcons: Record<string, string> = {
    'Ensolarado': '☀️',
    'Nublado': '☁️',
    'Chuvoso': '🌧️',
    'Tempestade': '⛈️',
    'Geada': '❄️',
    'Seco': '🌵',
  };

  const alertIcons: Record<string, string> = {
    'geada': '❄️',
    'seca': '☀️',
    'chuva_intensa': '🌧️',
    'calor_extremo': '🌡️',
  };

  const severityColors: Record<string, string> = {
    'low': 'bg-yellow-900/30 border-yellow-700/50 text-yellow-400',
    'medium': 'bg-orange-900/30 border-orange-700/50 text-orange-400',
    'high': 'bg-red-900/30 border-red-700/50 text-red-400',
  };

  if (isLoading) {
    return (
      <div className="bg-base-800 rounded-lg p-4 animate-pulse">
        <div className="h-20 bg-base-700 rounded"></div>
      </div>
    );
  }

  if (!today) {
    return (
      <div className="bg-base-800 rounded-lg p-4 text-center text-gray-500">
        Não foi possível carregar dados do clima
      </div>
    );
  }

  return (
    <div className="bg-base-800 rounded-lg overflow-hidden">
      {/* Header com clima de hoje */}
      <div className="bg-gradient-to-r from-blue-900/50 to-cyan-900/50 p-4">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm text-gray-400">{DEFAULT_LOCATION.name}</p>
            <p className="text-xs text-gray-500">
              {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <span className="text-4xl">{conditionIcons[today.condition] || '🌤️'}</span>
        </div>
        
        <div className="mt-3 flex items-end gap-4">
          <div>
            <p className="text-4xl font-bold text-white">
              {Math.round(today.temperature.avg)}°C
            </p>
            <p className="text-sm text-gray-400">
              {Math.round(today.temperature.min)}° / {Math.round(today.temperature.max)}°
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-400">{today.condition}</p>
            {today.precipitation > 0 && (
              <p className="text-sm text-blue-400">💧 {today.precipitation}mm</p>
            )}
          </div>
        </div>
      </div>

      {/* Alertas */}
      {alerts.length > 0 && (
        <div className="px-4 py-2 space-y-2">
          {alerts.slice(0, 3).map(alert => (
            <div 
              key={alert.id}
              className={`flex items-center gap-2 px-3 py-2 rounded border ${severityColors[alert.severity]}`}
            >
              <span className="text-lg">{alertIcons[alert.type]}</span>
              <p className="text-sm flex-1">{alert.message}</p>
            </div>
          ))}
        </div>
      )}

      {/* Próximos dias */}
      <div className="px-4 pb-4">
        <div className="flex justify-between items-center py-2">
          <p className="text-sm text-gray-400">Próximos dias</p>
          <button 
            onClick={() => setShowAll(!showAll)}
            className="text-xs text-brand-primary hover:underline"
          >
            {showAll ? 'Ver menos' : 'Ver mais'}
          </button>
        </div>
        
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {nextDays.map(day => (
            <div 
              key={day.id}
              className="bg-base-700 rounded-lg p-2 text-center"
            >
              <p className="text-xs text-gray-400">
                {new Date(day.date).toLocaleDateString('pt-BR', { weekday: 'short' })}
              </p>
              <span className="text-xl my-1 block">{conditionIcons[day.condition] || '🌤️'}</span>
              <p className="text-xs text-white">
                {Math.round(day.temperature.min)}° / {Math.round(day.temperature.max)}°
              </p>
              {day.precipitation > 0 && (
                <p className="text-[10px] text-blue-400">{day.precipitation}mm</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Dicas baseadas no clima */}
      {alerts.length > 0 && (
        <div className="px-4 pb-4 pt-2 border-t border-base-700">
          <p className="text-xs text-gray-500 mb-2">💡 Dicas de Manejo:</p>
          <ul className="text-xs text-gray-400 space-y-1">
            {alerts.some(a => a.type === 'geada') && (
              <li>• Proteja bezerros do frio intenso</li>
            )}
            {alerts.some(a => a.type === 'calor_extremo') && (
              <li>• Garanta sombra e água fresca disponível</li>
            )}
            {alerts.some(a => a.type === 'seca') && (
              <li>• Monitore pastagens e considere suplementação</li>
            )}
            {alerts.some(a => a.type === 'chuva_intensa') && (
              <li>• Verifique cercas e abrigos após a chuva</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

// Componente expandido para correlação clima x GMD
export const WeatherCorrelationView: React.FC<{ animals: Animal[] }> = ({ animals }) => {
  const [history, setHistory] = useState<WeatherData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchWeatherHistory(
          DEFAULT_LOCATION.latitude,
          DEFAULT_LOCATION.longitude
        );
        setHistory(data);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const correlations = useMemo(() => {
    if (!history.length) return [];
    return correlateWeatherWithGMD(animals, history);
  }, [animals, history]);

  if (isLoading) {
    return <div className="animate-pulse h-40 bg-base-700 rounded"></div>;
  }

  return (
    <div className="bg-base-800 rounded-lg p-4">
      <h3 className="text-lg font-semibold text-white mb-4">
        📊 Correlação Clima x Performance
      </h3>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-left">
              <th className="pb-2">Período</th>
              <th className="pb-2">Temp. Média</th>
              <th className="pb-2">Precipitação</th>
              <th className="pb-2">GMD Médio</th>
            </tr>
          </thead>
          <tbody className="text-white">
            {correlations.map(c => (
              <tr key={c.period} className="border-t border-base-700">
                <td className="py-2">{c.period}</td>
                <td className="py-2">{c.avgTemperature.toFixed(1)}°C</td>
                <td className="py-2">{c.avgPrecipitation.toFixed(1)}mm</td>
                <td className="py-2">{c.avgGMD.toFixed(3)} kg/dia</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-500 mt-4">
        * Análise baseada nos últimos 30 dias. GMD calculado com base nos animais cadastrados.
      </p>
    </div>
  );
};

export default WeatherWidget;
