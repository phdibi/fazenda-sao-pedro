// ============================================
// 🔧 COMPRESSÃO DE DADOS PARA FIRESTORE
// ============================================
// Reduz o tamanho dos documentos para economizar
// storage e bandwidth no Firestore
//
// Técnicas:
// 1. Compressão de strings longas (base64 + gzip)
// 2. Abreviação de chaves de objetos
// 3. Remoção de dados redundantes
// 4. Compactação de arrays de histórico

// ============================================
// TIPOS
// ============================================

interface CompressionStats {
    originalSize: number;
    compressedSize: number;
    savings: number;
    savingsPercent: string;
}

// ============================================
// ABREVIAÇÕES DE CHAVES
// ============================================
// Mapeia nomes longos para curtos (economiza ~40% em documentos grandes)

const KEY_ABBREVIATIONS: Record<string, string> = {
    // Animal
    'dataNascimento': 'dn',
    'historicoSanitario': 'hs',
    'historicoPesagens': 'hp',
    'historicoPrenhez': 'hpr',
    'historicoAborto': 'ha',
    'historicoProgenie': 'hpg',
    'managementAreaId': 'mai',
    'createdAt': 'ca',
    'updatedAt': 'ua',

    // Peso Entry
    'weightKg': 'w',
    'date': 'd',
    'type': 't',

    // Medicação
    'medicamento': 'm',
    'dosagem': 'ds',
    'motivo': 'mt',
    'dataAplicacao': 'da',
    'proximaDose': 'pd',
    'observacoes': 'ob',

    // Prenhez
    'dateConfirmed': 'dc',
    'expectedDueDate': 'ed',
    'pregnancyType': 'pt',
    'bullId': 'bi',
    'notes': 'n',

    // Progênie
    'offspringBrinco': 'ofb',
    'birthWeightKg': 'bw',
    'weaningWeightKg': 'ww',
    'yearlingWeightKg': 'yw',
};

const KEY_EXPANSIONS = Object.fromEntries(
    Object.entries(KEY_ABBREVIATIONS).map(([k, v]) => [v, k])
);

// ============================================
// COMPRESSÃO DE STRINGS (GZIP)
// ============================================

/**
 * Comprime string usando CompressionStream (gzip)
 * Disponível em navegadores modernos
 */
export const compressString = async (text: string): Promise<string> => {
    if (!('CompressionStream' in window)) {
        console.warn('⚠️ CompressionStream não suportado');
        return text;
    }

    try {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(encoder.encode(text));
                controller.close();
            }
        });

        const compressedStream = stream.pipeThrough(new CompressionStream('gzip'));
        const compressedBlob = await new Response(compressedStream).blob();
        const arrayBuffer = await compressedBlob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        // Converte para base64
        const base64 = btoa(String.fromCharCode(...uint8Array));

        return `__gz__${base64}`;
    } catch (error) {
        console.warn('⚠️ Falha ao comprimir:', error);
        return text;
    }
};

/**
 * Descomprime string gzip
 */
export const decompressString = async (compressed: string): Promise<string> => {
    if (!compressed.startsWith('__gz__')) {
        return compressed;
    }

    if (!('DecompressionStream' in window)) {
        console.warn('⚠️ DecompressionStream não suportado');
        return compressed;
    }

    try {
        const base64 = compressed.slice(6); // Remove '__gz__'
        const binaryString = atob(base64);
        const bytes = Uint8Array.from(binaryString, c => c.charCodeAt(0));
        const blob = new Blob([bytes]);

        const decompressedStream = blob.stream().pipeThrough(new DecompressionStream('gzip'));
        return await new Response(decompressedStream).text();
    } catch (error) {
        console.warn('⚠️ Falha ao descomprimir:', error);
        return compressed;
    }
};

// ============================================
// COMPRESSÃO DE OBJETOS
// ============================================

/**
 * Comprime objeto abreviando chaves
 */
export const compressObject = <T extends Record<string, any>>(obj: T): Record<string, any> => {
    if (!obj || typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
        return obj.map(item => compressObject(item));
    }

    const compressed: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
        const shortKey = KEY_ABBREVIATIONS[key] || key;

        if (value && typeof value === 'object') {
            compressed[shortKey] = compressObject(value);
        } else {
            compressed[shortKey] = value;
        }
    }

    return compressed;
};

/**
 * Expande objeto restaurando chaves originais
 */
export const expandObject = <T extends Record<string, any>>(obj: T): Record<string, any> => {
    if (!obj || typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
        return obj.map(item => expandObject(item));
    }

    const expanded: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
        const longKey = KEY_EXPANSIONS[key] || key;

        if (value && typeof value === 'object') {
            expanded[longKey] = expandObject(value);
        } else {
            expanded[longKey] = value;
        }
    }

    return expanded;
};

// ============================================
// COMPACTAÇÃO DE HISTÓRICOS
// ============================================

/**
 * Compacta array de histórico removendo dados redundantes
 * Ex: Remove entradas duplicadas consecutivas
 */
export const compactHistory = <T extends { date: any }>(
    history: T[],
    dedupKey?: keyof T
): T[] => {
    if (!history || history.length === 0) return history;

    // Ordena por data
    const sorted = [...history].sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    if (!dedupKey) return sorted;

    // Remove duplicatas consecutivas
    return sorted.filter((item, index) => {
        if (index === 0) return true;
        return item[dedupKey] !== sorted[index - 1][dedupKey];
    });
};

/**
 * Limita histórico aos últimos N registros
 * Mantém o primeiro e último para preservar contexto
 */
export const trimHistory = <T>(
    history: T[],
    maxItems: number = 50,
    preserveFirst: boolean = true
): T[] => {
    if (!history || history.length <= maxItems) return history;

    if (preserveFirst) {
        // Mantém primeiro + últimos (maxItems - 1)
        return [
            history[0],
            ...history.slice(-(maxItems - 1))
        ];
    }

    return history.slice(-maxItems);
};

// ============================================
// COMPRESSÃO COMPLETA DE DOCUMENTO
// ============================================

/**
 * Comprime documento para salvar no Firestore
 */
export const compressDocument = async <T extends Record<string, any>>(
    doc: T,
    options: {
        abbreviateKeys?: boolean;
        compressStrings?: boolean;
        trimHistories?: number;
    } = {}
): Promise<{ data: Record<string, any>; stats: CompressionStats }> => {
    const {
        abbreviateKeys = true,
        compressStrings = false, // Desativado por padrão (adiciona complexidade)
        trimHistories = 0,
    } = options;

    const originalSize = JSON.stringify(doc).length;
    let compressed: Record<string, any> = { ...doc };

    // 1. Limita históricos se configurado
    if (trimHistories > 0) {
        const historyKeys = ['historicoSanitario', 'historicoPesagens', 'historicoPrenhez', 'historicoAborto'];

        for (const key of historyKeys) {
            if (compressed[key] && Array.isArray(compressed[key])) {
                compressed[key] = trimHistory(compressed[key], trimHistories);
            }
        }
    }

    // 2. Abrevia chaves
    if (abbreviateKeys) {
        compressed = compressObject(compressed);
    }

    // 3. Comprime strings longas (opcional)
    if (compressStrings) {
        for (const [key, value] of Object.entries(compressed)) {
            if (typeof value === 'string' && value.length > 500) {
                compressed[key] = await compressString(value);
            }
        }
    }

    const compressedSize = JSON.stringify(compressed).length;
    const savings = originalSize - compressedSize;

    return {
        data: compressed,
        stats: {
            originalSize,
            compressedSize,
            savings,
            savingsPercent: `${((savings / originalSize) * 100).toFixed(1)}%`,
        },
    };
};

/**
 * Expande documento do Firestore
 */
export const expandDocument = async <T extends Record<string, any>>(
    doc: T,
    options: {
        expandKeys?: boolean;
        decompressStrings?: boolean;
    } = {}
): Promise<Record<string, any>> => {
    const {
        expandKeys = true,
        decompressStrings = true,
    } = options;

    let expanded: Record<string, any> = { ...doc };

    // 1. Descomprime strings
    if (decompressStrings) {
        for (const [key, value] of Object.entries(expanded)) {
            if (typeof value === 'string' && value.startsWith('__gz__')) {
                expanded[key] = await decompressString(value);
            }
        }
    }

    // 2. Expande chaves
    if (expandKeys) {
        expanded = expandObject(expanded);
    }

    return expanded;
};

// ============================================
// ESTIMATIVA DE ECONOMIA
// ============================================

/**
 * Estima economia de compressão para uma coleção
 */
export const estimateCollectionSavings = async (
    documents: Record<string, any>[]
): Promise<{
    totalOriginal: number;
    totalCompressed: number;
    totalSavings: number;
    averageSavingsPercent: string;
}> => {
    let totalOriginal = 0;
    let totalCompressed = 0;

    for (const doc of documents) {
        const { stats } = await compressDocument(doc);
        totalOriginal += stats.originalSize;
        totalCompressed += stats.compressedSize;
    }

    const totalSavings = totalOriginal - totalCompressed;
    const avgPercent = totalOriginal > 0
        ? ((totalSavings / totalOriginal) * 100).toFixed(1)
        : '0';

    return {
        totalOriginal,
        totalCompressed,
        totalSavings,
        averageSavingsPercent: `${avgPercent}%`,
    };
};

// ============================================
// UTILIDADES
// ============================================

/**
 * Formata bytes para string legível
 */
export const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Calcula tamanho de um documento
 */
export const getDocumentSize = (doc: any): number => {
    return JSON.stringify(doc).length;
};

/**
 * Verifica se documento está comprimido
 */
export const isCompressed = (doc: any): boolean => {
    if (!doc || typeof doc !== 'object') return false;

    // Verifica se tem chaves abreviadas
    const keys = Object.keys(doc);
    return keys.some(k => Object.values(KEY_ABBREVIATIONS).includes(k));
};
