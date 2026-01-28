import { ScaleReading, ScaleImportResult, ScaleSkippedLine, Animal, WeightEntry, WeighingType } from '../types';

// ============================================
// ⚖️ INTEGRAÇÃO COM BALANÇA DIGITAL
// ============================================

/**
 * Formatos suportados de arquivos de balança
 */
export type ScaleFormat = 'csv' | 'txt' | 'tru-test' | 'gallagher' | 'generic';

// Limites de peso para validação (bovinos)
const WEIGHT_MIN = 10;
const WEIGHT_MAX = 2000;
const WEIGHT_SUSPECT_LOW = 30;
const WEIGHT_SUSPECT_HIGH = 1200;

interface ParseResult {
  readings: ScaleReading[];
  skippedLines: ScaleSkippedLine[];
}

/**
 * Remove BOM e normaliza line endings
 */
const sanitizeContent = (content: string): string => {
  return content.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
};

/**
 * Remove aspas de um campo CSV se presente
 */
const unquote = (field: string): string => {
  const trimmed = field.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/""/g, '"');
  }
  return trimmed;
};

/**
 * Divide uma linha CSV respeitando campos entre aspas.
 * Recebe o separador já detectado para consistência entre linhas.
 */
const splitCSVLine = (line: string, separator: string): string[] => {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === separator && !inQuotes) {
      fields.push(unquote(current));
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(unquote(current));

  return fields;
};

/**
 * Detecta o separador CSV predominante na linha (fora de aspas)
 */
const detectSeparator = (line: string): string => {
  let inQuotes = false;
  let commas = 0;
  let semicolons = 0;
  let tabs = 0;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (!inQuotes) {
      if (char === ',') commas++;
      else if (char === ';') semicolons++;
      else if (char === '\t') tabs++;
    }
  }

  // Semicolons são comuns em CSVs brasileiros (locale pt-BR usa , como decimal)
  if (semicolons >= commas && semicolons >= tabs) return ';';
  if (tabs >= commas) return '\t';
  return ',';
};

/**
 * Tenta parsear um valor como peso numérico.
 * Aceita tanto ponto quanto vírgula como separador decimal.
 */
const parseWeight = (value: string): number | null => {
  if (!value) return null;
  // Normaliza: troca vírgula decimal por ponto
  const normalized = value.replace(',', '.');
  const num = parseFloat(normalized);
  if (isNaN(num) || num <= 0) return null;
  return num;
};

/**
 * Verifica se um valor parece ser um brinco/identificação de animal.
 * Aceita formatos reais: ABC001, BR-12345, FSP.0042, 001234, etc.
 */
const isBrincoLike = (value: string): boolean => {
  if (!value || value.length < 1 || value.length > 20) return false;
  // Rejeita se é puramente numérico dentro da faixa de peso (seria confundido com peso)
  const asNum = parseFloat(value.replace(',', '.'));
  if (!isNaN(asNum) && asNum > WEIGHT_MIN && asNum < WEIGHT_MAX) return false;
  // Aceita alfanuméricos com traços, pontos, underscores
  return /^[A-Z0-9][A-Z0-9._\-]{0,19}$/i.test(value);
};

/**
 * Parseia data em vários formatos.
 * Prioridade: YYYY-MM-DD (ISO/americano, formato da balança) > DD/MM/YYYY (brasileiro)
 */
const parseDate = (str: string): Date | null => {
  if (!str) return null;

  // YYYY-MM-DD (formato ISO / americano — padrão da balança)
  const matchISO = str.match(/(\d{4})[\/\-](\d{2})[\/\-](\d{2})/);
  if (matchISO) {
    return new Date(parseInt(matchISO[1]), parseInt(matchISO[2]) - 1, parseInt(matchISO[3]));
  }

  // DD/MM/YYYY ou DD-MM-YYYY (formato brasileiro, fallback)
  const matchBR = str.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{2,4})/);
  if (matchBR) {
    const day = parseInt(matchBR[1]);
    const month = parseInt(matchBR[2]) - 1;
    let year = parseInt(matchBR[3]);
    if (year < 100) year += 2000;
    return new Date(year, month, day);
  }

  return null;
};

/**
 * Verifica se parece ser uma data
 */
const isDateLike = (value: string): boolean => {
  return /\d{2}[\/\-]\d{2}[\/\-]\d{2,4}/.test(value) || /\d{4}[\/\-]\d{2}[\/\-]\d{2}/.test(value);
};

/**
 * Detecta se a primeira linha é um header
 */
const isHeaderLine = (line: string): boolean => {
  const lower = line.toLowerCase();
  const headerKeywords = [
    'peso', 'weight', 'brinco', 'id', 'animal', 'identificação',
    'identificacao', 'massa', 'kg', 'data', 'date', 'nome', 'ear_tag',
    'tag', 'numero', 'número',
  ];
  return headerKeywords.some(kw => lower.includes(kw));
};

/**
 * Adiciona warnings de peso suspeito
 */
const addWeightWarnings = (weight: number, warnings: string[]) => {
  if (weight < WEIGHT_SUSPECT_LOW) {
    warnings.push(`Peso muito baixo (${weight} kg). Verifique se está correto.`);
  } else if (weight > WEIGHT_SUSPECT_HIGH) {
    warnings.push(`Peso muito alto (${weight} kg). Verifique se está correto.`);
  }
};

/**
 * Parseia arquivo CSV genérico de balança
 * Esperado: brinco,peso,data (ou variações de colunas)
 */
const parseGenericCSV = (content: string): ParseResult => {
  const sanitized = sanitizeContent(content);
  const lines = sanitized.split('\n');
  const readings: ScaleReading[] = [];
  const skippedLines: ScaleSkippedLine[] = [];

  if (lines.length === 0) return { readings, skippedLines };

  const hasHeader = isHeaderLine(lines[0]);
  const startIndex = hasHeader ? 1 : 0;

  // Detecta separador uma única vez a partir da primeira linha de dados
  const firstDataLine = lines.slice(startIndex).find(l => l.trim()) || '';
  const separator = detectSeparator(firstDataLine);

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = splitCSVLine(line, separator);

    let weight: number | undefined;
    let brinco: string | undefined;
    let timestamp = new Date();
    const warnings: string[] = [];

    for (const part of parts) {
      if (!part) continue;

      // Tenta como data primeiro (antes do peso, pois datas não parecem pesos)
      if (isDateLike(part)) {
        const parsed = parseDate(part);
        if (parsed) {
          timestamp = parsed;
          continue;
        }
      }

      // Tenta como peso
      const num = parseWeight(part);
      if (num !== null && num > WEIGHT_MIN && num < WEIGHT_MAX) {
        if (weight !== undefined) {
          warnings.push(`Múltiplos valores de peso na linha ${i + 1}. Usando o primeiro (${weight} kg).`);
        } else {
          weight = num;
        }
        continue;
      }

      // Tenta como brinco
      if (isBrincoLike(part)) {
        if (!brinco) {
          brinco = part.toUpperCase();
        }
        continue;
      }
    }

    if (!weight) {
      skippedLines.push({
        lineNumber: i + 1,
        content: line.substring(0, 120),
        reason: 'Nenhum peso válido encontrado (esperado: entre 10 e 2000 kg)',
      });
      continue;
    }

    addWeightWarnings(weight, warnings);

    if (!brinco) {
      warnings.push('Brinco não identificado na leitura. Atribua manualmente.');
    }

    readings.push({
      id: `scale-${Date.now()}-${i}`,
      timestamp,
      weight,
      unit: 'kg',
      animalBrinco: brinco,
      matched: false,
      warnings: warnings.length > 0 ? warnings : undefined,
    });
  }

  return { readings, skippedLines };
};

/**
 * Parseia formato Tru-Test
 */
const parseTruTest = (content: string): ParseResult => {
  const sanitized = sanitizeContent(content);
  const lines = sanitized.split('\n');
  const readings: ScaleReading[] = [];
  const skippedLines: ScaleSkippedLine[] = [];

  // Detecta separador uma vez a partir da primeira linha de dados
  const firstDataLine = lines.slice(1).find(l => l.trim()) || '';
  const separator = detectSeparator(firstDataLine);

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = splitCSVLine(line, separator);
    if (parts.length < 2) {
      skippedLines.push({
        lineNumber: i + 1,
        content: line.substring(0, 120),
        reason: 'Formato inválido: menos de 2 campos encontrados',
      });
      continue;
    }

    const brinco = parts[0] || '';
    const weight = parseWeight(parts[1] || '');
    const dateStr = parts[2] || '';
    const timeStr = parts[3] || '';
    const warnings: string[] = [];

    if (weight === null) {
      skippedLines.push({
        lineNumber: i + 1,
        content: line.substring(0, 120),
        reason: `Peso inválido: "${parts[1]}"`,
      });
      continue;
    }

    addWeightWarnings(weight, warnings);

    if (!brinco) {
      warnings.push('Brinco não identificado na leitura. Atribua manualmente.');
    }

    let timestamp = new Date();
    if (dateStr) {
      const parsed = parseDate(dateStr);
      if (parsed) {
        timestamp = parsed;
        if (timeStr) {
          const timeParts = timeStr.split(':').map(Number);
          timestamp.setHours(timeParts[0] || 0, timeParts[1] || 0);
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
      warnings: warnings.length > 0 ? warnings : undefined,
    });
  }

  return { readings, skippedLines };
};

/**
 * Parseia formato Gallagher
 */
const parseGallagher = (content: string): ParseResult => {
  return parseGenericCSV(content);
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
export const importScaleFile = async (file: File): Promise<ParseResult> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const format = detectScaleFormat(content, file.name);

        let result: ParseResult;
        switch (format) {
          case 'tru-test':
            result = parseTruTest(content);
            break;
          case 'gallagher':
            result = parseGallagher(content);
            break;
          default:
            result = parseGenericCSV(content);
        }

        console.log(`⚖️ [SCALE] Importadas ${result.readings.length} leituras, ${result.skippedLines.length} linhas ignoradas (formato: ${format})`);
        resolve(result);
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
      } else {
        const existingWarnings = reading.warnings || [];
        const alreadyHasWarning = existingWarnings.some(w => w.includes('não encontrado'));
        if (!alreadyHasWarning) {
          return {
            ...reading,
            warnings: [...existingWarnings, `Brinco "${reading.animalBrinco}" não encontrado no cadastro.`],
          };
        }
      }
    }
    return reading;
  });

  return {
    total: readings.length,
    matched,
    unmatched: readings.length - matched,
    readings: processedReadings,
    skippedLines: [],
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
