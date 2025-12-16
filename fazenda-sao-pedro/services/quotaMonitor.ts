// ============================================
// 🔧 MONITORAMENTO DE USO DE COTA
// ============================================
// Rastreia leituras/escritas do Firestore para evitar
// ultrapassar limites do plano gratuito (Spark)
//
// Limites Spark Plan:
// - 50K leituras/dia
// - 20K escritas/dia
// - 20K deletes/dia
// - 1GB storage

// ============================================
// TIPOS
// ============================================

export interface QuotaUsage {
    reads: number;
    writes: number;
    deletes: number;
    lastReset: string; // ISO date
    estimatedCost: number; // USD
}

export interface QuotaLimits {
    dailyReads: number;
    dailyWrites: number;
    dailyDeletes: number;
    storageGB: number;
}

export interface QuotaWarning {
    type: 'reads' | 'writes' | 'deletes';
    percentage: number;
    message: string;
}

// ============================================
// CONSTANTES
// ============================================

const QUOTA_STORAGE_KEY = 'fazenda-quota-usage';

// Limites do plano Spark (gratuito)
const SPARK_LIMITS: QuotaLimits = {
    dailyReads: 50000,
    dailyWrites: 20000,
    dailyDeletes: 20000,
    storageGB: 1,
};

// Preços Blaze (por 100K operações)
const BLAZE_PRICES = {
    reads: 0.06,    // $0.06 por 100K leituras
    writes: 0.18,   // $0.18 por 100K escritas
    deletes: 0.02,  // $0.02 por 100K deletes
};

// Thresholds para alertas (percentual)
const WARNING_THRESHOLDS = {
    low: 50,
    medium: 75,
    high: 90,
    critical: 95,
};

// ============================================
// STORAGE
// ============================================

/**
 * Obtém uso atual do localStorage
 */
const getStoredUsage = (): QuotaUsage => {
    try {
        const stored = localStorage.getItem(QUOTA_STORAGE_KEY);
        if (stored) {
            const usage = JSON.parse(stored) as QuotaUsage;

            // Verifica se precisa resetar (novo dia)
            const today = new Date().toISOString().split('T')[0];
            if (usage.lastReset !== today) {
                return createNewUsage();
            }

            return usage;
        }
    } catch (error) {
        console.warn('⚠️ [QUOTA] Erro ao ler uso:', error);
    }

    return createNewUsage();
};

/**
 * Cria novo registro de uso
 */
const createNewUsage = (): QuotaUsage => ({
    reads: 0,
    writes: 0,
    deletes: 0,
    lastReset: new Date().toISOString().split('T')[0],
    estimatedCost: 0,
});

/**
 * Salva uso no localStorage
 */
const saveUsage = (usage: QuotaUsage): void => {
    try {
        localStorage.setItem(QUOTA_STORAGE_KEY, JSON.stringify(usage));
    } catch (error) {
        console.warn('⚠️ [QUOTA] Erro ao salvar uso:', error);
    }
};

// ============================================
// TRACKING
// ============================================

/**
 * Registra leituras do Firestore
 */
export const trackReads = (count: number = 1): QuotaUsage => {
    const usage = getStoredUsage();
    usage.reads += count;
    usage.estimatedCost = calculateCost(usage);
    saveUsage(usage);

    // Log se próximo do limite
    const percentage = (usage.reads / SPARK_LIMITS.dailyReads) * 100;
    if (percentage >= WARNING_THRESHOLDS.medium) {
        console.warn(`⚠️ [QUOTA] Leituras: ${usage.reads}/${SPARK_LIMITS.dailyReads} (${percentage.toFixed(1)}%)`);
    }

    return usage;
};

/**
 * Registra escritas do Firestore
 */
export const trackWrites = (count: number = 1): QuotaUsage => {
    const usage = getStoredUsage();
    usage.writes += count;
    usage.estimatedCost = calculateCost(usage);
    saveUsage(usage);

    const percentage = (usage.writes / SPARK_LIMITS.dailyWrites) * 100;
    if (percentage >= WARNING_THRESHOLDS.medium) {
        console.warn(`⚠️ [QUOTA] Escritas: ${usage.writes}/${SPARK_LIMITS.dailyWrites} (${percentage.toFixed(1)}%)`);
    }

    return usage;
};

/**
 * Registra deletes do Firestore
 */
export const trackDeletes = (count: number = 1): QuotaUsage => {
    const usage = getStoredUsage();
    usage.deletes += count;
    usage.estimatedCost = calculateCost(usage);
    saveUsage(usage);

    return usage;
};

/**
 * Registra operação em batch
 */
export const trackBatch = (reads: number, writes: number, deletes: number = 0): QuotaUsage => {
    const usage = getStoredUsage();
    usage.reads += reads;
    usage.writes += writes;
    usage.deletes += deletes;
    usage.estimatedCost = calculateCost(usage);
    saveUsage(usage);

    return usage;
};

// ============================================
// CONSULTAS
// ============================================

/**
 * Obtém uso atual
 */
export const getQuotaUsage = (): QuotaUsage => {
    return getStoredUsage();
};

/**
 * Obtém limites do plano
 */
export const getQuotaLimits = (): QuotaLimits => {
    return { ...SPARK_LIMITS };
};

/**
 * Obtém percentuais de uso
 */
export const getUsagePercentages = (): {
    reads: number;
    writes: number;
    deletes: number;
} => {
    const usage = getStoredUsage();
    return {
        reads: (usage.reads / SPARK_LIMITS.dailyReads) * 100,
        writes: (usage.writes / SPARK_LIMITS.dailyWrites) * 100,
        deletes: (usage.deletes / SPARK_LIMITS.dailyDeletes) * 100,
    };
};

/**
 * Verifica se há alertas
 */
export const getQuotaWarnings = (): QuotaWarning[] => {
    const percentages = getUsagePercentages();
    const warnings: QuotaWarning[] = [];

    if (percentages.reads >= WARNING_THRESHOLDS.low) {
        warnings.push({
            type: 'reads',
            percentage: percentages.reads,
            message: getWarningMessage('leituras', percentages.reads),
        });
    }

    if (percentages.writes >= WARNING_THRESHOLDS.low) {
        warnings.push({
            type: 'writes',
            percentage: percentages.writes,
            message: getWarningMessage('escritas', percentages.writes),
        });
    }

    if (percentages.deletes >= WARNING_THRESHOLDS.low) {
        warnings.push({
            type: 'deletes',
            percentage: percentages.deletes,
            message: getWarningMessage('exclusões', percentages.deletes),
        });
    }

    return warnings.sort((a, b) => b.percentage - a.percentage);
};

/**
 * Verifica se está no limite crítico
 */
export const isQuotaCritical = (): boolean => {
    const percentages = getUsagePercentages();
    return percentages.reads >= WARNING_THRESHOLDS.critical ||
           percentages.writes >= WARNING_THRESHOLDS.critical ||
           percentages.deletes >= WARNING_THRESHOLDS.critical;
};

/**
 * Verifica se pode fazer mais operações
 */
export const canPerformOperation = (type: 'read' | 'write' | 'delete', count: number = 1): boolean => {
    const usage = getStoredUsage();

    switch (type) {
        case 'read':
            return usage.reads + count <= SPARK_LIMITS.dailyReads;
        case 'write':
            return usage.writes + count <= SPARK_LIMITS.dailyWrites;
        case 'delete':
            return usage.deletes + count <= SPARK_LIMITS.dailyDeletes;
        default:
            return true;
    }
};

// ============================================
// CUSTOS (Blaze Plan)
// ============================================

/**
 * Calcula custo estimado (se fosse Blaze)
 */
const calculateCost = (usage: QuotaUsage): number => {
    const readCost = (usage.reads / 100000) * BLAZE_PRICES.reads;
    const writeCost = (usage.writes / 100000) * BLAZE_PRICES.writes;
    const deleteCost = (usage.deletes / 100000) * BLAZE_PRICES.deletes;

    return Number((readCost + writeCost + deleteCost).toFixed(4));
};

/**
 * Obtém custo estimado do dia
 */
export const getEstimatedDailyCost = (): string => {
    const usage = getStoredUsage();
    return `$${usage.estimatedCost.toFixed(4)}`;
};

/**
 * Projeta custo mensal baseado no uso atual
 */
export const getProjectedMonthlyCost = (): string => {
    const usage = getStoredUsage();
    const dailyCost = usage.estimatedCost;
    const monthlyCost = dailyCost * 30;
    return `$${monthlyCost.toFixed(2)}`;
};

// ============================================
// HISTÓRICO
// ============================================

const HISTORY_KEY = 'fazenda-quota-history';
const MAX_HISTORY_DAYS = 30;

/**
 * Salva uso do dia no histórico
 */
export const saveToHistory = (): void => {
    try {
        const usage = getStoredUsage();
        const history: QuotaUsage[] = JSON.parse(
            localStorage.getItem(HISTORY_KEY) || '[]'
        );

        // Evita duplicatas do mesmo dia
        const today = usage.lastReset;
        const existingIndex = history.findIndex(h => h.lastReset === today);

        if (existingIndex >= 0) {
            history[existingIndex] = usage;
        } else {
            history.unshift(usage);
        }

        // Mantém apenas últimos N dias
        const trimmedHistory = history.slice(0, MAX_HISTORY_DAYS);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmedHistory));
    } catch (error) {
        console.warn('⚠️ [QUOTA] Erro ao salvar histórico:', error);
    }
};

/**
 * Obtém histórico de uso
 */
export const getUsageHistory = (): QuotaUsage[] => {
    try {
        return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    } catch {
        return [];
    }
};

/**
 * Obtém média de uso dos últimos N dias
 */
export const getAverageUsage = (days: number = 7): {
    reads: number;
    writes: number;
    deletes: number;
} => {
    const history = getUsageHistory().slice(0, days);

    if (history.length === 0) {
        return { reads: 0, writes: 0, deletes: 0 };
    }

    const totals = history.reduce(
        (acc, day) => ({
            reads: acc.reads + day.reads,
            writes: acc.writes + day.writes,
            deletes: acc.deletes + day.deletes,
        }),
        { reads: 0, writes: 0, deletes: 0 }
    );

    return {
        reads: Math.round(totals.reads / history.length),
        writes: Math.round(totals.writes / history.length),
        deletes: Math.round(totals.deletes / history.length),
    };
};

// ============================================
// UTILIDADES
// ============================================

/**
 * Gera mensagem de alerta
 */
const getWarningMessage = (type: string, percentage: number): string => {
    if (percentage >= WARNING_THRESHOLDS.critical) {
        return `⛔ CRÍTICO: ${type} em ${percentage.toFixed(0)}% do limite diário!`;
    }
    if (percentage >= WARNING_THRESHOLDS.high) {
        return `🔴 ALTO: ${type} em ${percentage.toFixed(0)}% do limite diário`;
    }
    if (percentage >= WARNING_THRESHOLDS.medium) {
        return `🟠 MÉDIO: ${type} em ${percentage.toFixed(0)}% do limite diário`;
    }
    return `🟡 ATENÇÃO: ${type} em ${percentage.toFixed(0)}% do limite diário`;
};

/**
 * Reseta contadores (para testes)
 */
export const resetQuota = (): void => {
    saveUsage(createNewUsage());
    console.log('🔄 [QUOTA] Contadores resetados');
};

/**
 * Formata resumo de uso
 */
export const getUsageSummary = (): string => {
    const usage = getStoredUsage();
    const percentages = getUsagePercentages();

    return `
📊 Uso do Firestore (${usage.lastReset})
━━━━━━━━━━━━━━━━━━━━━━━━━━
📖 Leituras: ${usage.reads.toLocaleString()}/${SPARK_LIMITS.dailyReads.toLocaleString()} (${percentages.reads.toFixed(1)}%)
✏️ Escritas: ${usage.writes.toLocaleString()}/${SPARK_LIMITS.dailyWrites.toLocaleString()} (${percentages.writes.toFixed(1)}%)
🗑️ Exclusões: ${usage.deletes.toLocaleString()}/${SPARK_LIMITS.dailyDeletes.toLocaleString()} (${percentages.deletes.toFixed(1)}%)
━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 Custo estimado (Blaze): ${getEstimatedDailyCost()}
📅 Projeção mensal: ${getProjectedMonthlyCost()}
    `.trim();
};
