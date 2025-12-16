// ============================================
// 🔧 LAZY LOADING AVANÇADO
// ============================================
// Utilitários para carregamento preguiçoso de componentes
// com suporte a preload, retry e fallback

import { lazy, ComponentType } from 'react';

// ============================================
// TIPOS
// ============================================

type LazyComponentFactory<T extends ComponentType<any>> = () => Promise<{ default: T }>;

interface LazyWithRetryOptions {
    retries?: number;
    delay?: number;
    onError?: (error: Error, attempt: number) => void;
}

interface PreloadableComponent<T extends ComponentType<any>> {
    Component: React.LazyExoticComponent<T>;
    preload: () => Promise<{ default: T }>;
}

// ============================================
// LAZY COM RETRY
// ============================================

/**
 * Cria um componente lazy com retry automático em caso de falha
 * Útil para conexões instáveis
 *
 * @example
 * const Dashboard = lazyWithRetry(() => import('./Dashboard'), { retries: 3 });
 */
export function lazyWithRetry<T extends ComponentType<any>>(
    factory: LazyComponentFactory<T>,
    options: LazyWithRetryOptions = {}
): React.LazyExoticComponent<T> {
    const { retries = 3, delay = 1000, onError } = options;

    return lazy(() => retryImport(factory, retries, delay, onError));
}

async function retryImport<T extends ComponentType<any>>(
    factory: LazyComponentFactory<T>,
    retriesLeft: number,
    delay: number,
    onError?: (error: Error, attempt: number) => void
): Promise<{ default: T }> {
    try {
        return await factory();
    } catch (error) {
        const attempt = 3 - retriesLeft + 1;

        if (onError) {
            onError(error as Error, attempt);
        }

        if (retriesLeft <= 0) {
            console.error(`❌ [LAZY] Falha ao carregar componente após ${attempt} tentativas`);
            throw error;
        }

        console.warn(`⚠️ [LAZY] Tentativa ${attempt} falhou, tentando novamente em ${delay}ms...`);

        await new Promise(resolve => setTimeout(resolve, delay));
        return retryImport(factory, retriesLeft - 1, delay * 1.5, onError);
    }
}

// ============================================
// PRELOADABLE COMPONENT
// ============================================

/**
 * Cria um componente lazy que pode ser pré-carregado
 * Útil para preload em hover ou antecipação de navegação
 *
 * @example
 * const { Component: Reports, preload } = createPreloadableComponent(
 *   () => import('./ReportsView')
 * );
 *
 * // Em hover do botão:
 * onMouseEnter={() => preload()}
 */
export function createPreloadableComponent<T extends ComponentType<any>>(
    factory: LazyComponentFactory<T>
): PreloadableComponent<T> {
    let modulePromise: Promise<{ default: T }> | null = null;

    const preload = () => {
        if (!modulePromise) {
            modulePromise = factory();
        }
        return modulePromise;
    };

    const Component = lazy(() => {
        if (modulePromise) {
            return modulePromise;
        }
        return factory();
    });

    return { Component, preload };
}

// ============================================
// PRELOAD POR ROTA
// ============================================

type RouteComponents = {
    [key: string]: () => Promise<{ default: ComponentType<any> }>;
};

/**
 * Registra componentes para preload por rota
 */
export function createRoutePreloader(routes: RouteComponents) {
    const preloadedRoutes = new Set<string>();

    return {
        /**
         * Pré-carrega componente de uma rota específica
         */
        preloadRoute: (route: string) => {
            if (preloadedRoutes.has(route)) return;

            const factory = routes[route];
            if (factory) {
                preloadedRoutes.add(route);
                factory().catch(console.warn);
                console.log(`📦 [PRELOAD] Pré-carregando rota: ${route}`);
            }
        },

        /**
         * Pré-carrega todas as rotas
         */
        preloadAll: () => {
            Object.keys(routes).forEach(route => {
                if (!preloadedRoutes.has(route)) {
                    preloadedRoutes.add(route);
                    routes[route]().catch(console.warn);
                }
            });
            console.log('📦 [PRELOAD] Todas as rotas pré-carregadas');
        },

        /**
         * Verifica se rota está pré-carregada
         */
        isPreloaded: (route: string) => preloadedRoutes.has(route),
    };
}

// ============================================
// PRELOAD EM IDLE
// ============================================

/**
 * Pré-carrega componentes quando o navegador está ocioso
 * Usa requestIdleCallback para não bloquear a UI
 */
export function preloadOnIdle(
    factories: Array<() => Promise<any>>,
    options: { timeout?: number } = {}
): void {
    const { timeout = 5000 } = options;

    if ('requestIdleCallback' in window) {
        factories.forEach((factory, index) => {
            (window as any).requestIdleCallback(
                () => {
                    factory().catch(console.warn);
                    console.log(`📦 [IDLE-PRELOAD] Componente ${index + 1}/${factories.length} carregado`);
                },
                { timeout }
            );
        });
    } else {
        // Fallback para navegadores sem requestIdleCallback
        setTimeout(() => {
            Promise.all(factories.map(f => f().catch(() => null)));
        }, 2000);
    }
}

// ============================================
// INTERSECTION OBSERVER PRELOAD
// ============================================

/**
 * Pré-carrega componente quando um elemento entra na viewport
 * Útil para seções abaixo da dobra
 */
export function createVisibilityPreloader(
    elementSelector: string,
    factory: () => Promise<any>,
    options: IntersectionObserverInit = {}
): () => void {
    const element = document.querySelector(elementSelector);

    if (!element) {
        console.warn(`⚠️ [PRELOAD] Elemento não encontrado: ${elementSelector}`);
        return () => {};
    }

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    factory().catch(console.warn);
                    console.log(`📦 [VISIBILITY-PRELOAD] Componente carregado ao entrar na viewport`);
                    observer.disconnect();
                }
            });
        },
        {
            rootMargin: '100px',
            threshold: 0,
            ...options
        }
    );

    observer.observe(element);

    return () => observer.disconnect();
}

// ============================================
// NETWORK-AWARE PRELOAD
// ============================================

/**
 * Pré-carrega apenas se a conexão for boa
 * Evita consumir dados em conexões lentas
 */
export function preloadIfFastConnection(
    factories: Array<() => Promise<any>>
): void {
    const connection = (navigator as any).connection;

    if (!connection) {
        // Se não suportar Network Information API, carrega normalmente
        factories.forEach(f => f().catch(console.warn));
        return;
    }

    // Não pré-carrega em conexões lentas ou com economia de dados
    if (connection.saveData) {
        console.log('📵 [PRELOAD] Economia de dados ativa, não pré-carregando');
        return;
    }

    const effectiveType = connection.effectiveType;
    if (effectiveType === '2g' || effectiveType === 'slow-2g') {
        console.log('📵 [PRELOAD] Conexão lenta detectada, não pré-carregando');
        return;
    }

    console.log(`📶 [PRELOAD] Conexão ${effectiveType}, pré-carregando componentes...`);
    factories.forEach(f => f().catch(console.warn));
}

// ============================================
// CHUNK PREFETCH
// ============================================

/**
 * Adiciona link de prefetch para chunks do Vite
 * Isso permite que o navegador baixe chunks antecipadamente
 */
export function prefetchChunk(chunkPath: string): void {
    if (document.querySelector(`link[href="${chunkPath}"]`)) {
        return; // Já existe
    }

    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.as = 'script';
    link.href = chunkPath;
    document.head.appendChild(link);

    console.log(`📦 [PREFETCH] Chunk adicionado: ${chunkPath}`);
}

// ============================================
// COMPONENTES PRÉ-CONFIGURADOS
// ============================================

// Rotas principais da aplicação
export const routePreloader = createRoutePreloader({
    dashboard: () => import('../components/Dashboard'),
    reports: () => import('../components/ReportsView'),
    calendar: () => import('../components/CalendarView'),
    tasks: () => import('../components/TasksView'),
    management: () => import('../components/ManagementView'),
    batches: () => import('../components/BatchManagement'),
});

// Componentes pesados para preload em idle
export const heavyComponents = [
    () => import('../components/ReportsView'),
    () => import('../components/GenealogyTree'),
    () => import('../components/WeatherWidget'),
    () => import('../components/Chatbot'),
];
