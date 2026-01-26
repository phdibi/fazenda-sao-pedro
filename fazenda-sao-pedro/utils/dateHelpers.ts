/**
 * Utilitários centralizados para manipulação de datas
 * Evita duplicação de código em todo o projeto
 */

import { Timestamp } from '../services/firebase';

/**
 * Converte Timestamps do Firestore para objetos Date
 * Processa recursivamente objetos e arrays
 */
export const convertTimestampsToDates = (data: any): any => {
    if (!data) return data;
    if (Array.isArray(data)) return data.map(item => convertTimestampsToDates(item));
    // Verifica se é um Timestamp do Firestore (pode ser null antes da inicialização)
    if (Timestamp && data instanceof Timestamp) return data.toDate();
    // Fallback: verifica se tem o método toDate (duck typing)
    if (data && typeof data.toDate === 'function') return data.toDate();
    if (typeof data === 'object' && data !== null) {
        const converted = { ...data };
        for (const key in converted) {
            converted[key] = convertTimestampsToDates(converted[key]);
        }
        return converted;
    }
    return data;
};

/**
 * Converte objetos Date para Timestamps do Firestore
 * Processa recursivamente objetos e arrays
 */
export const convertDatesToTimestamps = (data: any): any => {
    if (!data) return data;
    if (Array.isArray(data)) {
        // 🔧 FIX: Filtra nulls de arrays para evitar itens vazios
        return data
            .map(item => convertDatesToTimestamps(item))
            .filter(item => item !== null);
    }
    // Verifica se Timestamp está disponível antes de usar
    if (data instanceof Date) {
        // 🔧 FIX: Skip Invalid Dates to prevent Firestore data corruption
        // IMPORTANTE: Retorna null em vez de undefined para que o campo seja
        // explicitamente removido pelo removeUndefined() ou preservado
        if (isNaN(data.getTime())) {
            console.warn('⚠️ [DATE] Skipping Invalid Date in convertDatesToTimestamps - this field will be excluded');
            return null; // null será filtrado se necessário, undefined causava sobrescrita
        }
        if (Timestamp && typeof Timestamp.fromDate === 'function') {
            return Timestamp.fromDate(data);
        }
        // Fallback: retorna a Date como está (será convertida posteriormente)
        return data;
    }
    if (typeof data === 'object' && data !== null) {
        const converted = { ...data };
        for (const key in converted) {
            const convertedValue = convertDatesToTimestamps(converted[key]);
            // 🔧 FIX: Remove campos com null de objetos para não salvar nulls no Firestore
            if (convertedValue === null) {
                delete converted[key];
            } else {
                converted[key] = convertedValue;
            }
        }
        return converted;
    }
    return data;
};

/**
 * Formata uma data para exibição em português brasileiro
 */
export const formatDate = (date: Date | string | undefined | null): string => {
    if (!date) return 'Data inválida';
    const d = new Date(date);
    if (isNaN(d.getTime())) {
        return 'Data inválida';
    }
    return d.toLocaleDateString('pt-BR');
};

/**
 * Formata uma data para uso em inputs HTML type="date"
 */
export const dateToInputValue = (date: Date | string | undefined | null): string => {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) {
        return '';
    }
    return d.toISOString().split('T')[0];
};

/**
 * Converte string de input para Date (considerando timezone local)
 */
export const inputValueToDate = (value: string): Date | undefined => {
    if (!value) return undefined;
    // Adiciona T00:00:00 para garantir que a data seja parseada no timezone local
    return new Date(value + 'T00:00:00');
};

/**
 * Calcula a idade em meses a partir de uma data de nascimento
 */
export const calculateAgeInMonths = (birthDate: Date | string | undefined): number | null => {
    if (!birthDate) return null;
    const birth = new Date(birthDate);
    if (isNaN(birth.getTime())) return null;

    const now = new Date();
    const months = (now.getFullYear() - birth.getFullYear()) * 12
        + (now.getMonth() - birth.getMonth());

    // Ajusta se o dia do mês ainda não chegou
    if (now.getDate() < birth.getDate()) {
        return Math.max(0, months - 1);
    }
    return Math.max(0, months);
};

/**
 * Calcula a idade em dias
 */
export const calculateAgeInDays = (birthDate: Date | string | undefined): number | null => {
    if (!birthDate) return null;
    const birth = new Date(birthDate);
    if (isNaN(birth.getTime())) return null;

    const now = new Date();
    const diffTime = now.getTime() - birth.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Formata idade em texto legível (ex: "1 ano e 3 meses")
 */
export const formatAge = (birthDate: Date | string | undefined): string => {
    const months = calculateAgeInMonths(birthDate);
    if (months === null) return 'Idade desconhecida';

    if (months < 1) {
        const days = calculateAgeInDays(birthDate);
        return days !== null ? `${days} dias` : 'Recém-nascido';
    }

    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;

    if (years === 0) {
        return `${months} ${months === 1 ? 'mês' : 'meses'}`;
    }

    if (remainingMonths === 0) {
        return `${years} ${years === 1 ? 'ano' : 'anos'}`;
    }

    return `${years} ${years === 1 ? 'ano' : 'anos'} e ${remainingMonths} ${remainingMonths === 1 ? 'mês' : 'meses'}`;
};

/**
 * Verifica se uma data está dentro de um intervalo
 */
export const isDateInRange = (
    date: Date | string,
    start: Date | string,
    end: Date | string
): boolean => {
    const d = new Date(date);
    const s = new Date(start);
    const e = new Date(end);

    if (isNaN(d.getTime()) || isNaN(s.getTime()) || isNaN(e.getTime())) {
        return false;
    }

    return d >= s && d <= e;
};

/**
 * Retorna o início do dia (00:00:00)
 */
export const startOfDay = (date: Date): Date => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
};

/**
 * Retorna o fim do dia (23:59:59.999)
 */
export const endOfDay = (date: Date): Date => {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
};

/**
 * Adiciona dias a uma data
 */
export const addDays = (date: Date, days: number): Date => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
};

/**
 * Retorna a diferença em dias entre duas datas
 */
export const diffInDays = (date1: Date | string, date2: Date | string): number => {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};
