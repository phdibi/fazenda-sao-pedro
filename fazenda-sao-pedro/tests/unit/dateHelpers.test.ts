/**
 * Testes unitários para dateHelpers
 * Execute com: npm test
 */

import { describe, it, expect } from 'vitest';
import {
    formatDate,
    dateToInputValue,
    inputValueToDate,
    calculateAgeInMonths,
    calculateAgeInDays,
    formatAge,
    isDateInRange,
    startOfDay,
    endOfDay,
    addDays,
    diffInDays,
} from '../../utils/dateHelpers';

describe('dateHelpers', () => {
    describe('formatDate', () => {
        it('should format a valid date in pt-BR format', () => {
            const date = new Date(2024, 0, 15); // 15 de janeiro de 2024
            expect(formatDate(date)).toBe('15/01/2024');
        });

        it('should return "Data inválida" for null', () => {
            expect(formatDate(null)).toBe('Data inválida');
        });

        it('should return "Data inválida" for undefined', () => {
            expect(formatDate(undefined)).toBe('Data inválida');
        });

        it('should handle string dates', () => {
            expect(formatDate('2024-01-15')).toBe('15/01/2024');
        });
    });

    describe('dateToInputValue', () => {
        it('should convert date to YYYY-MM-DD format', () => {
            const date = new Date(2024, 0, 15);
            expect(dateToInputValue(date)).toBe('2024-01-15');
        });

        it('should return empty string for null', () => {
            expect(dateToInputValue(null)).toBe('');
        });

        it('should return empty string for undefined', () => {
            expect(dateToInputValue(undefined)).toBe('');
        });
    });

    describe('inputValueToDate', () => {
        it('should convert YYYY-MM-DD string to Date', () => {
            const result = inputValueToDate('2024-01-15');
            expect(result).toBeInstanceOf(Date);
            expect(result?.getFullYear()).toBe(2024);
            expect(result?.getMonth()).toBe(0); // Janeiro
            expect(result?.getDate()).toBe(15);
        });

        it('should return undefined for empty string', () => {
            expect(inputValueToDate('')).toBeUndefined();
        });
    });

    describe('calculateAgeInMonths', () => {
        it('should calculate age in months correctly', () => {
            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
            expect(calculateAgeInMonths(oneYearAgo)).toBe(12);
        });

        it('should return null for undefined', () => {
            expect(calculateAgeInMonths(undefined)).toBeNull();
        });

        it('should return 0 for future date', () => {
            const futureDate = new Date();
            futureDate.setMonth(futureDate.getMonth() + 1);
            const result = calculateAgeInMonths(futureDate);
            expect(result).toBeLessThanOrEqual(0);
        });
    });

    describe('formatAge', () => {
        it('should format age less than 1 month in days', () => {
            const tenDaysAgo = new Date();
            tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
            expect(formatAge(tenDaysAgo)).toContain('dias');
        });

        it('should format age in months', () => {
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
            expect(formatAge(sixMonthsAgo)).toContain('meses');
        });

        it('should format age in years and months', () => {
            const oneYearThreeMonthsAgo = new Date();
            oneYearThreeMonthsAgo.setFullYear(oneYearThreeMonthsAgo.getFullYear() - 1);
            oneYearThreeMonthsAgo.setMonth(oneYearThreeMonthsAgo.getMonth() - 3);
            const result = formatAge(oneYearThreeMonthsAgo);
            expect(result).toContain('ano');
            expect(result).toContain('meses');
        });

        it('should return "Idade desconhecida" for undefined', () => {
            expect(formatAge(undefined)).toBe('Idade desconhecida');
        });
    });

    describe('isDateInRange', () => {
        it('should return true for date within range', () => {
            const date = new Date(2024, 5, 15);
            const start = new Date(2024, 0, 1);
            const end = new Date(2024, 11, 31);
            expect(isDateInRange(date, start, end)).toBe(true);
        });

        it('should return false for date outside range', () => {
            const date = new Date(2023, 5, 15);
            const start = new Date(2024, 0, 1);
            const end = new Date(2024, 11, 31);
            expect(isDateInRange(date, start, end)).toBe(false);
        });

        it('should include boundary dates', () => {
            const start = new Date(2024, 0, 1);
            const end = new Date(2024, 11, 31);
            expect(isDateInRange(start, start, end)).toBe(true);
            expect(isDateInRange(end, start, end)).toBe(true);
        });
    });

    describe('startOfDay and endOfDay', () => {
        it('should set time to 00:00:00.000 for startOfDay', () => {
            const date = new Date(2024, 5, 15, 14, 30, 45);
            const result = startOfDay(date);
            expect(result.getHours()).toBe(0);
            expect(result.getMinutes()).toBe(0);
            expect(result.getSeconds()).toBe(0);
            expect(result.getMilliseconds()).toBe(0);
        });

        it('should set time to 23:59:59.999 for endOfDay', () => {
            const date = new Date(2024, 5, 15, 14, 30, 45);
            const result = endOfDay(date);
            expect(result.getHours()).toBe(23);
            expect(result.getMinutes()).toBe(59);
            expect(result.getSeconds()).toBe(59);
            expect(result.getMilliseconds()).toBe(999);
        });
    });

    describe('addDays', () => {
        it('should add positive days correctly', () => {
            const date = new Date(2024, 0, 15);
            const result = addDays(date, 10);
            expect(result.getDate()).toBe(25);
        });

        it('should subtract days with negative value', () => {
            const date = new Date(2024, 0, 15);
            const result = addDays(date, -10);
            expect(result.getDate()).toBe(5);
        });

        it('should handle month overflow', () => {
            const date = new Date(2024, 0, 25);
            const result = addDays(date, 10);
            expect(result.getMonth()).toBe(1); // Fevereiro
            expect(result.getDate()).toBe(4);
        });
    });

    describe('diffInDays', () => {
        it('should calculate difference correctly', () => {
            const date1 = new Date(2024, 0, 1);
            const date2 = new Date(2024, 0, 11);
            expect(diffInDays(date1, date2)).toBe(10);
        });

        it('should return absolute value', () => {
            const date1 = new Date(2024, 0, 11);
            const date2 = new Date(2024, 0, 1);
            expect(diffInDays(date1, date2)).toBe(10);
        });
    });
});
