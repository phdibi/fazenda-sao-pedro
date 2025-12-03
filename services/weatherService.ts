import { WeatherData, WeatherCondition, WeatherAlert, WeatherCorrelation, Animal } from '../types';
import { calcularGMDAnimal } from '../utils/gmdCalculations';

// ============================================
// 🌦️ SERVIÇO DE CLIMA - Open-Meteo (Gratuito)
// ============================================

const WEATHER_API_BASE = 'https://api.open-meteo.com/v1';

// Cache para economizar chamadas
const weatherCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutos

interface OpenMeteoResponse {
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_sum: number[];
    weathercode: number[];
  };
}

// Mapeamento de códigos WMO para condições
const weatherCodeToCondition = (code: number): WeatherCondition => {
  if (code === 0) return WeatherCondition.Ensolarado;
  if (code >= 1 && code <= 3) return WeatherCondition.Nublado;
  if (code >= 51 && code <= 67) return WeatherCondition.Chuvoso;
  if (code >= 80 && code <= 99) return WeatherCondition.Tempestade;
  if (code >= 71 && code <= 77) return WeatherCondition.Geada;
  return WeatherCondition.Nublado;
};

/**
 * Busca previsão do tempo para localização
 */
export const fetchWeatherForecast = async (
  latitude: number,
  longitude: number,
  days: number = 7
): Promise<WeatherData[]> => {
  const cacheKey = `${latitude},${longitude},${days}`;
  const cached = weatherCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('🌦️ [WEATHER CACHE HIT]');
    return cached.data;
  }

  try {
    const url = `${WEATHER_API_BASE}/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode&timezone=America/Sao_Paulo&forecast_days=${days}`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error('Erro ao buscar clima');
    
    const data: OpenMeteoResponse = await response.json();
    
    const weatherData: WeatherData[] = data.daily.time.map((date, i) => ({
      id: `weather-${date}`,
      date: new Date(date),
      location: `${latitude},${longitude}`,
      temperature: {
        min: data.daily.temperature_2m_min[i],
        max: data.daily.temperature_2m_max[i],
        avg: (data.daily.temperature_2m_max[i] + data.daily.temperature_2m_min[i]) / 2,
      },
      humidity: 0, // Open-Meteo free não inclui
      precipitation: data.daily.precipitation_sum[i],
      condition: weatherCodeToCondition(data.daily.weathercode[i]),
    }));

    weatherCache.set(cacheKey, { data: weatherData, timestamp: Date.now() });
    console.log('🌦️ [WEATHER] Dados atualizados');
    
    return weatherData;
  } catch (error) {
    console.error('Erro ao buscar clima:', error);
    return [];
  }
};

/**
 * Busca histórico de clima (últimos 30 dias)
 */
export const fetchWeatherHistory = async (
  latitude: number,
  longitude: number
): Promise<WeatherData[]> => {
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  const formatDate = (d: Date) => d.toISOString().split('T')[0];
  
  try {
    const url = `${WEATHER_API_BASE}/archive?latitude=${latitude}&longitude=${longitude}&start_date=${formatDate(startDate)}&end_date=${formatDate(endDate)}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode&timezone=America/Sao_Paulo`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error('Erro ao buscar histórico');
    
    const data: OpenMeteoResponse = await response.json();
    
    return data.daily.time.map((date, i) => ({
      id: `weather-hist-${date}`,
      date: new Date(date),
      location: `${latitude},${longitude}`,
      temperature: {
        min: data.daily.temperature_2m_min[i],
        max: data.daily.temperature_2m_max[i],
        avg: (data.daily.temperature_2m_max[i] + data.daily.temperature_2m_min[i]) / 2,
      },
      humidity: 0,
      precipitation: data.daily.precipitation_sum[i],
      condition: weatherCodeToCondition(data.daily.weathercode[i]),
    }));
  } catch (error) {
    console.error('Erro ao buscar histórico de clima:', error);
    return [];
  }
};

/**
 * Gera alertas com base nos dados de clima
 */
export const generateWeatherAlerts = (forecast: WeatherData[]): WeatherAlert[] => {
  const alerts: WeatherAlert[] = [];

  forecast.forEach(day => {
    // Alerta de geada
    if (day.temperature.min <= 3) {
      alerts.push({
        id: `alert-geada-${day.date.toISOString()}`,
        type: 'geada',
        severity: day.temperature.min <= 0 ? 'high' : 'medium',
        message: `⚠️ Risco de geada em ${day.date.toLocaleDateString('pt-BR')}. Temperatura mínima: ${day.temperature.min}°C`,
        date: day.date,
        isRead: false,
      });
    }

    // Alerta de calor extremo
    if (day.temperature.max >= 38) {
      alerts.push({
        id: `alert-calor-${day.date.toISOString()}`,
        type: 'calor_extremo',
        severity: day.temperature.max >= 42 ? 'high' : 'medium',
        message: `🌡️ Calor extremo previsto para ${day.date.toLocaleDateString('pt-BR')}. Máxima: ${day.temperature.max}°C. Garanta água e sombra para o rebanho.`,
        date: day.date,
        isRead: false,
      });
    }

    // Alerta de chuva intensa
    if (day.precipitation >= 50) {
      alerts.push({
        id: `alert-chuva-${day.date.toISOString()}`,
        type: 'chuva_intensa',
        severity: day.precipitation >= 80 ? 'high' : 'medium',
        message: `🌧️ Chuva intensa prevista para ${day.date.toLocaleDateString('pt-BR')}. Precipitação: ${day.precipitation}mm`,
        date: day.date,
        isRead: false,
      });
    }
  });

  // Alerta de seca (sem chuva por 7+ dias)
  const diasSemChuva = forecast.filter(d => d.precipitation < 1).length;
  if (diasSemChuva >= 7) {
    alerts.push({
      id: `alert-seca-${Date.now()}`,
      type: 'seca',
      severity: diasSemChuva >= 14 ? 'high' : 'medium',
      message: `☀️ Período seco detectado: ${diasSemChuva} dias sem chuva significativa. Monitore as pastagens.`,
      date: new Date(),
      isRead: false,
    });
  }

  return alerts;
};

/**
 * Correlaciona clima com ganho de peso
 */
export const correlateWeatherWithGMD = (
  animals: Animal[],
  weatherHistory: WeatherData[]
): WeatherCorrelation[] => {
  // Agrupa por semana
  const weeklyData: Map<string, { temps: number[]; precip: number[]; gmds: number[] }> = new Map();

  weatherHistory.forEach(day => {
    const weekKey = getWeekKey(day.date);
    if (!weeklyData.has(weekKey)) {
      weeklyData.set(weekKey, { temps: [], precip: [], gmds: [] });
    }
    const week = weeklyData.get(weekKey)!;
    week.temps.push(day.temperature.avg);
    week.precip.push(day.precipitation);
  });

  // Calcula GMD médio dos animais
  const avgGMD = animals.reduce((sum, a) => {
    const gmd = calcularGMDAnimal(a).gmdTotal || 0;
    return sum + gmd;
  }, 0) / (animals.length || 1);

  // Cria correlações
  const correlations: WeatherCorrelation[] = [];
  weeklyData.forEach((data, period) => {
    correlations.push({
      period,
      avgTemperature: average(data.temps),
      avgPrecipitation: sum(data.precip),
      avgGMD: avgGMD, // Simplificado - ideal seria GMD por período
      animalCount: animals.length,
    });
  });

  return correlations.sort((a, b) => a.period.localeCompare(b.period));
};

// Helpers
const getWeekKey = (date: Date): string => {
  const d = new Date(date);
  const year = d.getFullYear();
  const week = Math.ceil((d.getDate() + new Date(d.getFullYear(), d.getMonth(), 1).getDay()) / 7);
  return `${year}-S${week.toString().padStart(2, '0')}`;
};

const average = (arr: number[]): number => 
  arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

const sum = (arr: number[]): number => 
  arr.reduce((a, b) => a + b, 0);

// Coordenadas padrão (pode ser configurado pelo usuário)
export const DEFAULT_LOCATION = {
  latitude: -29.68, // RS aproximado
  longitude: -53.81,
  name: 'Rio Grande do Sul',
};
