import { ScaleReading, ScaleImportResult, Animal, WeightEntry, WeighingType } from '../types';

// ============================================
// ⚖️ INTEGRAÇÃO COM BALANÇA DIGITAL
// ============================================

/**
 * Formatos suportados de arquivos de balança
 */
export type ScaleFormat = 'csv' | 'txt' | 'tru-test' | 'gallagher' | 'generic';

/**
 * Parseia arquivo CSV genérico de balança
 * Esperado: brinco,peso,data (ou peso,brinco,data)
 */
const parseGenericCSV = (content: string): ScaleReading[] => {
  const lines = content.trim().split('\n');
  const readings: ScaleReading[] = [];
  
  // Detecta se tem header
  const firstLine = lines[0].toLowerCase();
  const hasHeader = firstLine.includes('peso') || firstLine.includes('weight') || firstLine.includes('brinco');
  const startIndex = hasHeader ? 1 : 0;

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(/[,;\t]/).map(p => p.trim());
    
    // Tenta identificar peso e brinco
    let weight: number | undefined;
    let brinco: string | undefined;
    let timestamp = new Date();

    parts.forEach(part => {
      // É um número (peso)
      const num = parseFloat(part.replace(',', '.'));
      if (!isNaN(num) && num > 10 && num < 2000) {
        weight = num;
      }
      // Parece um brinco (alfanumérico)
      else if (/^[A-Z0-9]{2,10}$/i.test(part)) {
        brinco = part.toUpperCase();
      }
      // Parece uma data
      else if (/\d{2}[\/\-]\d{2}[\/\-]\d{2,4}/.test(part)) {
        const parsed = parseDate(part);
        if (parsed) timestamp = parsed;
      }
    });

    if (weight) {
      readings.push({
        id: `scale-${Date.now()}-${i}`,
        timestamp,
        weight,
        unit: 'kg',
        animalBrinco: brinco,
        matched: false,
      });
    }
  }

  return readings;
};

/**
 * Parseia formato Tru-Test
 */
const parseTruTest = (content: string): ScaleReading[] => {
  // Formato típico Tru-Test: ID,Weight,Date,Time
  const lines = content.trim().split('\n');
  const readings: ScaleReading[] = [];

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    if (parts.length < 2) continue;

    const brinco = parts[0]?.trim();
    const weight = parseFloat(parts[1]?.replace(',', '.'));
    const dateStr = parts[2]?.trim();
    const timeStr = parts[3]?.trim();

    if (isNaN(weight)) continue;

    let timestamp = new Date();
    if (dateStr) {
      const parsed = parseDate(dateStr);
      if (parsed) {
        timestamp = parsed;
        if (timeStr) {
          const [h, m] = timeStr.split(':').map(Number);
          timestamp.setHours(h || 0, m || 0);
        }
      }
    }

    readings.push({
      id: `tru-${Date.now()}-${i}`,
      timestamp,
      weight,
      unit: 'kg',
      animalBrinco: brinco || undefined,
      matched: false,
    });
  }

  return readings;
};

/**
 * Parseia formato Gallagher
 */
const parseGallagher = (content: string): ScaleReading[] => {
  // Formato Gallagher similar, mas pode ter mais campos
  return parseGenericCSV(content); // Usa parser genérico por enquanto
};

/**
 * Parseia data em vários formatos
 */
const parseDate = (str: string): Date | null => {
  // DD/MM/YYYY ou DD-MM-YYYY
  const match1 = str.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{2,4})/);
  if (match1) {
    const day = parseInt(match1[1]);
    const month = parseInt(match1[2]) - 1;
    let year = parseInt(match1[3]);
    if (year < 100) year += 2000;
    return new Date(year, month, day);
  }
  
  // YYYY-MM-DD
  const match2 = str.match(/(\d{4})[\/\-](\d{2})[\/\-](\d{2})/);
  if (match2) {
    return new Date(parseInt(match2[1]), parseInt(match2[2]) - 1, parseInt(match2[3]));
  }

  return null;
};

/**
 * Detecta formato do arquivo
 */
export const detectScaleFormat = (content: string, filename: string): ScaleFormat => {
  const lower = filename.toLowerCase();
  
  if (lower.includes('tru-test') || lower.includes('trutest')) return 'tru-test';
  if (lower.includes('gallagher')) return 'gallagher';
  if (lower.endsWith('.csv')) return 'csv';
  if (lower.endsWith('.txt')) return 'txt';
  
  return 'generic';
};

/**
 * Importa arquivo de balança
 */
export const importScaleFile = async (file: File): Promise<ScaleReading[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const format = detectScaleFormat(content, file.name);
        
        let readings: ScaleReading[];
        switch (format) {
          case 'tru-test':
            readings = parseTruTest(content);
            break;
          case 'gallagher':
            readings = parseGallagher(content);
            break;
          default:
            readings = parseGenericCSV(content);
        }

        console.log(`⚖️ [SCALE] Importadas ${readings.length} leituras (formato: ${format})`);
        resolve(readings);
      } catch (error) {
        reject(new Error('Erro ao processar arquivo de balança'));
      }
    };

    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.readAsText(file);
  });
};

/**
 * Faz match das leituras com animais cadastrados
 */
export const matchReadingsWithAnimals = (
  readings: ScaleReading[],
  animals: Animal[]
): ScaleImportResult => {
  const animalMap = new Map<string, Animal>();
  animals.forEach(a => {
    animalMap.set(a.brinco.toUpperCase(), a);
    if (a.nome) animalMap.set(a.nome.toUpperCase(), a);
  });

  let matched = 0;
  const processedReadings = readings.map(reading => {
    if (reading.animalBrinco) {
      const animal = animalMap.get(reading.animalBrinco.toUpperCase());
      if (animal) {
        matched++;
        return {
          ...reading,
          matched: true,
          animalId: animal.id,
        };
      }
    }
    return reading;
  });

  return {
    total: readings.length,
    matched,
    unmatched: readings.length - matched,
    readings: processedReadings,
  };
};

/**
 * Converte leituras matched em WeightEntry para salvar
 */
export const convertToWeightEntries = (
  readings: ScaleReading[],
  defaultType: WeighingType = WeighingType.None
): Map<string, WeightEntry> => {
  const entries = new Map<string, WeightEntry>();

  readings
    .filter(r => r.matched && r.animalId)
    .forEach(reading => {
      entries.set(reading.animalId!, {
        id: `weight-${Date.now()}-${reading.animalId}`,
        date: reading.timestamp,
        weightKg: reading.unit === 'arroba' ? reading.weight * 15 : reading.weight,
        type: defaultType,
      });
    });

  return entries;
};

/**
 * Gera template CSV para download
 */
export const generateScaleTemplate = (): string => {
  const header = 'brinco,peso_kg,data';
  const examples = [
    'ABC001,320.5,15/01/2025',
    'ABC002,285.0,15/01/2025',
    'ABC003,410.2,15/01/2025',
  ];
  return [header, ...examples].join('\n');
};

/**
 * Cria blob para download do template
 */
export const downloadScaleTemplate = () => {
  const content = generateScaleTemplate();
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = 'template_balanca.csv';
  link.click();
  
  URL.revokeObjectURL(url);
};