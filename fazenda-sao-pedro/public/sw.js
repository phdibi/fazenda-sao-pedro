// ============================================
// 🔧 SERVICE WORKER - OFFLINE FIRST
// ============================================
// Estratégias:
// - Cache First: Para assets estáticos (JS, CSS, imagens)
// - Network First: Para APIs e dados dinâmicos
// - Stale While Revalidate: Para dados que podem ficar desatualizados

const CACHE_VERSION = 'v3';
const STATIC_CACHE = `fazenda-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `fazenda-dynamic-${CACHE_VERSION}`;
const IMAGE_CACHE = `fazenda-images-${CACHE_VERSION}`;
const API_CACHE = `fazenda-api-${CACHE_VERSION}`;

// Assets estáticos para pré-cache
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/logo.png',
];

// Padrões de URL para diferentes estratégias
const PATTERNS = {
    static: /\.(js|css|woff2?|ttf|eot)$/i,
    images: /\.(png|jpg|jpeg|gif|webp|svg|ico)$/i,
    api: /firestore\.googleapis\.com|firebase/i,
    gemini: /generativelanguage\.googleapis\.com/i,
};

// ============================================
// INSTALAÇÃO
// ============================================
self.addEventListener('install', (event) => {
    console.log('🔧 [SW] Instalando Service Worker...');

    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => {
                console.log('📦 [SW] Pré-cacheando assets estáticos');
                return cache.addAll(STATIC_ASSETS).catch(err => {
                    console.warn('⚠️ [SW] Alguns assets não puderam ser cacheados:', err);
                });
            })
            .then(() => {
                // Força ativação imediata
                return self.skipWaiting();
            })
    );
});

// ============================================
// ATIVAÇÃO
// ============================================
self.addEventListener('activate', (event) => {
    console.log('✅ [SW] Service Worker ativado');

    event.waitUntil(
        Promise.all([
            // Limpa caches antigos
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => {
                            return name.startsWith('fazenda-') &&
                                   !name.includes(CACHE_VERSION);
                        })
                        .map((name) => {
                            console.log(`🧹 [SW] Removendo cache antigo: ${name}`);
                            return caches.delete(name);
                        })
                );
            }),
            // Assume controle de todas as páginas imediatamente
            self.clients.claim()
        ])
    );
});

// ============================================
// ESTRATÉGIAS DE CACHE
// ============================================

// Cache First - Para assets estáticos
async function cacheFirst(request, cacheName) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
        return cachedResponse;
    }

    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const cache = await caches.open(cacheName);
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        console.warn('⚠️ [SW] Falha ao buscar:', request.url);
        throw error;
    }
}

// Network First - Para dados dinâmicos
async function networkFirst(request, cacheName, timeout = 3000) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const networkResponse = await fetch(request, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (networkResponse.ok) {
            const cache = await caches.open(cacheName);
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        console.log('📦 [SW] Usando cache para:', request.url);
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        throw error;
    }
}

// Stale While Revalidate - Para dados que podem ficar desatualizados
async function staleWhileRevalidate(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);

    // Busca em background
    const fetchPromise = fetch(request).then((networkResponse) => {
        if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    }).catch(() => null);

    // Retorna cache imediatamente se disponível
    return cachedResponse || fetchPromise;
}

// ============================================
// INTERCEPTAÇÃO DE REQUESTS
// ============================================
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Ignora requests não-GET
    if (request.method !== 'GET') {
        return;
    }

    // Ignora extensões do Chrome e URLs internas
    if (url.protocol === 'chrome-extension:' ||
        url.hostname === 'localhost' && url.port !== '3000') {
        return;
    }

    // Estratégia baseada no tipo de recurso
    if (PATTERNS.api.test(url.href) || PATTERNS.gemini.test(url.href)) {
        // APIs: Network First com fallback para cache
        event.respondWith(networkFirst(request, API_CACHE, 5000));
    } else if (PATTERNS.images.test(url.pathname)) {
        // Imagens: Cache First
        event.respondWith(cacheFirst(request, IMAGE_CACHE));
    } else if (PATTERNS.static.test(url.pathname)) {
        // Assets estáticos: Cache First
        event.respondWith(cacheFirst(request, STATIC_CACHE));
    } else if (url.origin === self.location.origin) {
        // Navegação e HTML: Stale While Revalidate
        event.respondWith(staleWhileRevalidate(request, DYNAMIC_CACHE));
    }
});

// ============================================
// SYNC EM BACKGROUND
// ============================================
self.addEventListener('sync', (event) => {
    console.log('🔄 [SW] Background sync triggered:', event.tag);

    if (event.tag === 'sync-offline-data') {
        event.waitUntil(
            // Notifica o app para sincronizar dados offline
            self.clients.matchAll().then((clients) => {
                clients.forEach((client) => {
                    client.postMessage({
                        type: 'SYNC_OFFLINE_DATA',
                        timestamp: Date.now()
                    });
                });
            })
        );
    }
});

// ============================================
// PUSH NOTIFICATIONS (Preparado para futuro)
// ============================================
self.addEventListener('push', (event) => {
    if (!event.data) return;

    try {
        const data = event.data.json();

        event.waitUntil(
            self.registration.showNotification(data.title || 'Fazenda São Pedro', {
                body: data.body || 'Nova atualização disponível',
                icon: '/logo.png',
                badge: '/logo.png',
                tag: data.tag || 'default',
                data: data.url || '/'
            })
        );
    } catch (error) {
        console.error('❌ [SW] Erro ao processar push:', error);
    }
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    event.waitUntil(
        self.clients.matchAll({ type: 'window' }).then((clients) => {
            // Foca na janela existente ou abre nova
            for (const client of clients) {
                if (client.url === event.notification.data && 'focus' in client) {
                    return client.focus();
                }
            }
            return self.clients.openWindow(event.notification.data || '/');
        })
    );
});

// ============================================
// MENSAGENS DO APP
// ============================================
self.addEventListener('message', (event) => {
    const { type, payload } = event.data || {};

    switch (type) {
        case 'SKIP_WAITING':
            self.skipWaiting();
            break;

        case 'CACHE_URLS':
            // Permite que o app solicite cache de URLs específicas
            if (payload && Array.isArray(payload.urls)) {
                caches.open(DYNAMIC_CACHE).then((cache) => {
                    cache.addAll(payload.urls).catch(console.warn);
                });
            }
            break;

        case 'CLEAR_CACHE':
            // Limpa caches específicos ou todos
            const cachesToClear = payload?.caches || [DYNAMIC_CACHE, API_CACHE];
            Promise.all(cachesToClear.map(name => caches.delete(name)))
                .then(() => {
                    event.ports[0]?.postMessage({ success: true });
                });
            break;

        case 'GET_CACHE_STATS':
            // Retorna estatísticas dos caches
            getCacheStats().then((stats) => {
                event.ports[0]?.postMessage(stats);
            });
            break;
    }
});

// ============================================
// UTILIDADES
// ============================================
async function getCacheStats() {
    const stats = {};
    const cacheNames = await caches.keys();

    for (const name of cacheNames) {
        if (name.startsWith('fazenda-')) {
            const cache = await caches.open(name);
            const keys = await cache.keys();
            stats[name] = {
                count: keys.length,
                urls: keys.slice(0, 10).map(r => r.url) // Primeiras 10 URLs
            };
        }
    }

    return stats;
}

console.log('🚀 [SW] Service Worker carregado');
