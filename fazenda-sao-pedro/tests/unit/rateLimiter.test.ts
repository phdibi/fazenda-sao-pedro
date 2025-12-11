/**
 * Testes unitários para rateLimiter
 * Execute com: npm test
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { RateLimiter, RateLimitError, isRateLimitError } from '../../services/rateLimiter';

describe('RateLimiter', () => {
    let limiter: RateLimiter;

    beforeEach(() => {
        limiter = new RateLimiter(3, 1000); // 3 chamadas por segundo
    });

    describe('check', () => {
        it('should allow first call', () => {
            const result = limiter.check();
            expect(result.allowed).toBe(true);
            expect(result.remainingCalls).toBe(3);
        });

        it('should track remaining calls', async () => {
            await limiter.acquire();
            const result = limiter.check();
            expect(result.remainingCalls).toBe(2);
        });
    });

    describe('acquire', () => {
        it('should acquire successfully within limit', async () => {
            await expect(limiter.acquire()).resolves.toBeUndefined();
            await expect(limiter.acquire()).resolves.toBeUndefined();
            await expect(limiter.acquire()).resolves.toBeUndefined();
        });

        it('should throw RateLimitError when limit exceeded', async () => {
            await limiter.acquire();
            await limiter.acquire();
            await limiter.acquire();
            
            await expect(limiter.acquire()).rejects.toThrow(RateLimitError);
        });

        it('should include reset time in error', async () => {
            await limiter.acquire();
            await limiter.acquire();
            await limiter.acquire();
            
            try {
                await limiter.acquire();
            } catch (error) {
                expect(error).toBeInstanceOf(RateLimitError);
                expect((error as RateLimitError).resetInMs).toBeGreaterThan(0);
                expect((error as RateLimitError).resetInMs).toBeLessThanOrEqual(1000);
            }
        });
    });

    describe('waitAndAcquire', () => {
        it('should acquire immediately when under limit', async () => {
            const start = Date.now();
            await limiter.waitAndAcquire();
            const elapsed = Date.now() - start;
            expect(elapsed).toBeLessThan(100);
        });
    });

    describe('getStats', () => {
        it('should return correct stats', async () => {
            await limiter.acquire();
            await limiter.acquire();
            
            const stats = limiter.getStats();
            expect(stats.used).toBe(2);
            expect(stats.remaining).toBe(1);
            expect(stats.total).toBe(3);
        });
    });

    describe('reset', () => {
        it('should clear all calls', async () => {
            await limiter.acquire();
            await limiter.acquire();
            await limiter.acquire();
            
            limiter.reset();
            
            const stats = limiter.getStats();
            expect(stats.used).toBe(0);
            expect(stats.remaining).toBe(3);
        });
    });

    describe('window expiration', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('should allow calls after window expires', async () => {
            const fastLimiter = new RateLimiter(2, 500);
            
            await fastLimiter.acquire();
            await fastLimiter.acquire();
            
            await expect(fastLimiter.acquire()).rejects.toThrow(RateLimitError);
            
            vi.advanceTimersByTime(600);
            
            await expect(fastLimiter.acquire()).resolves.toBeUndefined();
        });
    });
});

describe('RateLimitError', () => {
    it('should have correct properties', () => {
        const error = new RateLimitError('Test error', 5000);
        expect(error.message).toBe('Test error');
        expect(error.resetInMs).toBe(5000);
        expect(error.name).toBe('RateLimitError');
        expect(error.isRateLimitError).toBe(true);
    });
});

describe('isRateLimitError', () => {
    it('should return true for RateLimitError', () => {
        const error = new RateLimitError('Test', 1000);
        expect(isRateLimitError(error)).toBe(true);
    });

    it('should return false for regular Error', () => {
        const error = new Error('Test');
        expect(isRateLimitError(error)).toBe(false);
    });

    it('should return false for null', () => {
        expect(isRateLimitError(null)).toBe(false);
    });
});
