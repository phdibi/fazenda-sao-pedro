// ============================================
// 🔧 SERVICE WORKER - REGISTRO E CONTROLE
// ============================================

export interface SWCacheStats {
    [cacheName: string]: {
        count: number;
        urls: string[];
    };
}

/**
 * Registra o Service Worker
 */
export const registerServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
    if (!('serviceWorker' in navigator)) {
        console.warn('⚠️ Service Worker não suportado neste navegador');
        return null;
    }

    try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
            scope: '/'
        });

        console.log('✅ [SW] Service Worker registrado com sucesso');

        // Listener para atualizações
        registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        console.log('🔄 [SW] Nova versão disponível');
                        // Dispara evento para o app mostrar notificação de atualização
                        window.dispatchEvent(new CustomEvent('sw-update-available'));
                    }
                });
            }
        });

        // Listener para mensagens do SW
        navigator.serviceWorker.addEventListener('message', (event) => {
            const { type, timestamp } = event.data || {};

            if (type === 'SYNC_OFFLINE_DATA') {
                console.log('🔄 [SW] Recebido pedido de sync:', timestamp);
                window.dispatchEvent(new CustomEvent('sync-offline-data'));
            }
        });

        return registration;
    } catch (error) {
        console.error('❌ [SW] Falha ao registrar Service Worker:', error);
        return null;
    }
};

/**
 * Força atualização do Service Worker
 */
export const updateServiceWorker = async (): Promise<void> => {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
        await registration.update();
        console.log('🔄 [SW] Verificando atualizações...');
    }
};

/**
 * Força ativação do novo Service Worker
 */
export const skipWaiting = (): void => {
    navigator.serviceWorker.controller?.postMessage({ type: 'SKIP_WAITING' });
};

/**
 * Solicita cache de URLs específicas
 */
export const cacheUrls = (urls: string[]): void => {
    navigator.serviceWorker.controller?.postMessage({
        type: 'CACHE_URLS',
        payload: { urls }
    });
};

/**
 * Limpa caches do Service Worker
 */
export const clearSWCache = async (cacheNames?: string[]): Promise<boolean> => {
    return new Promise((resolve) => {
        if (!navigator.serviceWorker.controller) {
            resolve(false);
            return;
        }

        const messageChannel = new MessageChannel();
        messageChannel.port1.onmessage = (event) => {
            resolve(event.data?.success || false);
        };

        navigator.serviceWorker.controller.postMessage(
            { type: 'CLEAR_CACHE', payload: { caches: cacheNames } },
            [messageChannel.port2]
        );

        // Timeout de 5 segundos
        setTimeout(() => resolve(false), 5000);
    });
};

/**
 * Obtém estatísticas dos caches
 */
export const getCacheStats = async (): Promise<SWCacheStats> => {
    return new Promise((resolve) => {
        if (!navigator.serviceWorker.controller) {
            resolve({});
            return;
        }

        const messageChannel = new MessageChannel();
        messageChannel.port1.onmessage = (event) => {
            resolve(event.data || {});
        };

        navigator.serviceWorker.controller.postMessage(
            { type: 'GET_CACHE_STATS' },
            [messageChannel.port2]
        );

        // Timeout de 5 segundos
        setTimeout(() => resolve({}), 5000);
    });
};

/**
 * Registra para Background Sync
 */
export const registerBackgroundSync = async (tag: string = 'sync-offline-data'): Promise<boolean> => {
    try {
        const registration = await navigator.serviceWorker.ready;

        if ('sync' in registration) {
            await (registration as any).sync.register(tag);
            console.log(`✅ [SW] Background sync registrado: ${tag}`);
            return true;
        }

        console.warn('⚠️ Background Sync não suportado');
        return false;
    } catch (error) {
        console.error('❌ [SW] Erro ao registrar background sync:', error);
        return false;
    }
};

/**
 * Verifica se o app está online
 */
export const isOnline = (): boolean => navigator.onLine;

/**
 * Adiciona listeners para mudanças de conectividade
 */
export const onConnectivityChange = (callback: (online: boolean) => void): () => void => {
    const handleOnline = () => callback(true);
    const handleOffline = () => callback(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
    };
};
