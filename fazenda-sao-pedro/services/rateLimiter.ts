/**
 * Rate Limiter para controlar chamadas à API Gemini
 * Implementa sliding window para controle de taxa
 */

import { RATE_LIMIT } from '../constants/app';

interface RateLimitResult {
    allowed: boolean;
    remainingCalls: number;
    resetInMs: number;
}

class RateLimiter {
    private calls: number[] = [];
    private readonly maxCalls: number;
    private readonly windowMs: number;

    constructor(maxCalls: number = RATE_LIMIT.calls, windowMs: number = RATE_LIMIT.windowMs) {
        this.maxCalls = maxCalls;
        this.windowMs = windowMs;
    }

    /**
     * Limpa chamadas expiradas da janela de tempo
     */
    private cleanExpiredCalls(): void {
        const now = Date.now();
        this.calls = this.calls.filter(timestamp => now - timestamp < this.windowMs);
    }

    /**
     * Verifica se uma nova chamada é permitida
     */
    check(): RateLimitResult {
        this.cleanExpiredCalls();

        const remainingCalls = Math.max(0, this.maxCalls - this.calls.length);
        const oldestCall = this.calls[0];
        const resetInMs = oldestCall 
            ? Math.max(0, this.windowMs - (Date.now() - oldestCall))
            : 0;

        return {
            allowed: this.calls.length < this.maxCalls,
            remainingCalls,
            resetInMs,
        };
    }

    /**
     * Registra uma nova chamada e verifica se é permitida
     * @throws Error se o limite foi excedido
     */
    async acquire(): Promise<void> {
        const result = this.check();

        if (!result.allowed) {
            const waitSeconds = Math.ceil(result.resetInMs / 1000);
            throw new RateLimitError(
                `Limite de requisições excedido. Aguarde ${waitSeconds} segundos.`,
                result.resetInMs
            );
        }

        this.calls.push(Date.now());
    }

    /**
     * Aguarda até que uma chamada seja permitida
     * Útil para operações em lote
     */
    async waitAndAcquire(): Promise<void> {
        const result = this.check();

        if (!result.allowed) {
            // Aguarda até a janela de tempo liberar
            await new Promise(resolve => setTimeout(resolve, result.resetInMs + 100));
        }

        await this.acquire();
    }

    /**
     * Retorna estatísticas do rate limiter
     */
    getStats(): { used: number; remaining: number; total: number; resetInMs: number } {
        this.cleanExpiredCalls();
        const oldestCall = this.calls[0];
        
        return {
            used: this.calls.length,
            remaining: Math.max(0, this.maxCalls - this.calls.length),
            total: this.maxCalls,
            resetInMs: oldestCall 
                ? Math.max(0, this.windowMs - (Date.now() - oldestCall))
                : 0,
        };
    }

    /**
     * Reseta o contador (útil para testes)
     */
    reset(): void {
        this.calls = [];
    }
}

/**
 * Erro específico para rate limiting
 */
export class RateLimitError extends Error {
    readonly resetInMs: number;
    readonly isRateLimitError = true;

    constructor(message: string, resetInMs: number) {
        super(message);
        this.name = 'RateLimitError';
        this.resetInMs = resetInMs;
    }
}

/**
 * Verifica se um erro é de rate limiting
 */
export const isRateLimitError = (error: unknown): error is RateLimitError => {
    return error instanceof RateLimitError || 
        (error !== null && 
         typeof error === 'object' && 
         'isRateLimitError' in error);
};

// Instância singleton para API Gemini
export const geminiRateLimiter = new RateLimiter();

// Instância para outras APIs (se necessário no futuro)
export const createRateLimiter = (maxCalls: number, windowMs: number) => 
    new RateLimiter(maxCalls, windowMs);

export { RateLimiter };
