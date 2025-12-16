// ============================================
// 🔧 OTIMIZAÇÃO: COMPRESSÃO DE IMAGENS
// ============================================
// Reduz o tamanho das imagens antes do upload
// Economia estimada: 60-80% do storage e bandwidth

interface CompressionOptions {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    format?: 'image/jpeg' | 'image/webp';
}

const DEFAULT_OPTIONS: CompressionOptions = {
    maxWidth: 800,      // Largura máxima
    maxHeight: 800,     // Altura máxima  
    quality: 0.7,       // 70% de qualidade (bom para fotos de gado)
    format: 'image/webp' // WebP é ~30% menor que JPEG
};

/**
 * Comprime uma imagem antes do upload
 * 
 * @param file - Arquivo de imagem original
 * @param options - Opções de compressão
 * @returns Promise<Blob> - Imagem comprimida
 * 
 * Economia típica:
 * - Foto de celular (4MB) → ~200KB (95% de redução)
 * - Foto média (1MB) → ~80KB (92% de redução)
 */
export const compressImage = async (
    file: File,
    options: CompressionOptions = {}
): Promise<Blob> => {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    
    return new Promise((resolve, reject) => {
        const img = new Image();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
            reject(new Error('Não foi possível criar contexto do canvas'));
            return;
        }

        // 🔧 OTIMIZAÇÃO: Cria objectUrl uma vez e rastreia para cleanup
        const objectUrl = URL.createObjectURL(file);

        img.onload = () => {
            // 🔧 OTIMIZAÇÃO: Libera memória imediatamente após carregar
            URL.revokeObjectURL(objectUrl);
            
            // Calcula dimensões mantendo proporção
            let { width, height } = img;
            
            if (width > opts.maxWidth! || height > opts.maxHeight!) {
                const ratio = Math.min(
                    opts.maxWidth! / width,
                    opts.maxHeight! / height
                );
                width = Math.round(width * ratio);
                height = Math.round(height * ratio);
            }

            canvas.width = width;
            canvas.height = height;

            // Desenha imagem redimensionada
            ctx.drawImage(img, 0, 0, width, height);

            // Converte para blob comprimido
            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        console.log(`📷 Imagem comprimida: ${formatBytes(file.size)} → ${formatBytes(blob.size)} (${Math.round((1 - blob.size / file.size) * 100)}% menor)`);
                        resolve(blob);
                    } else {
                        reject(new Error('Falha ao comprimir imagem'));
                    }
                },
                opts.format,
                opts.quality
            );
        };

        img.onerror = () => {
            // 🔧 OTIMIZAÇÃO: Libera memória em caso de erro
            URL.revokeObjectURL(objectUrl);
            reject(new Error('Falha ao carregar imagem'));
        };
        
        // Carrega imagem do arquivo
        img.src = objectUrl;
    });
};

/**
 * Comprime e converte para base64 (útil para preview)
 */
export const compressImageToBase64 = async (
    file: File,
    options: CompressionOptions = {}
): Promise<string> => {
    const blob = await compressImage(file, options);
    
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

/**
 * 🔧 OTIMIZAÇÃO: Thumbnail mais agressivo para listagens
 * Reduzido de 200px/60% para 150px/40% = ~50% menor
 */
export const createThumbnail = async (
    file: File
): Promise<Blob> => {
    return compressImage(file, {
        maxWidth: 150,
        maxHeight: 150,
        quality: 0.4,
        format: 'image/webp'
    });
};

/**
 * 🔧 OTIMIZAÇÃO: Thumbnail a partir de Blob (mais agressivo)
 */
export const createThumbnailFromBlob = async (
    blob: Blob
): Promise<Blob> => {
    // Converte Blob para File temporário
    const file = new File([blob], 'temp.webp', { type: blob.type });
    return compressImage(file, {
        maxWidth: 150,
        maxHeight: 150,
        quality: 0.4,
        format: 'image/webp'
    });
};

/**
 * Prepara imagem para upload: retorna versão normal e thumbnail
 * @param file - Arquivo original
 * @returns Objeto com imagem comprimida e thumbnail
 * 
 * Uso:
 * const { compressed, thumbnail } = await prepareImageForUpload(file);
 * // Upload compressed para visualização completa
 * // Upload thumbnail para listagens (economia de ~85% bandwidth)
 */
export interface PreparedImage {
    compressed: Blob;
    thumbnail: Blob;
    originalSize: number;
    compressedSize: number;
    thumbnailSize: number;
    savings: string;
}

export const prepareImageForUpload = async (
    file: File
): Promise<PreparedImage> => {
    const compressed = await compressImage(file);
    const thumbnail = await createThumbnailFromBlob(compressed);
    
    const originalSize = file.size;
    const compressedSize = compressed.size;
    const thumbnailSize = thumbnail.size;
    const totalSavings = ((originalSize - compressedSize - thumbnailSize) / originalSize * 100).toFixed(1);
    
    console.log(`📷 Imagem preparada:
    • Original: ${formatBytes(originalSize)}
    • Comprimida: ${formatBytes(compressedSize)}
    • Thumbnail: ${formatBytes(thumbnailSize)}
    • Economia total: ${totalSavings}%`);
    
    return {
        compressed,
        thumbnail,
        originalSize,
        compressedSize,
        thumbnailSize,
        savings: `${totalSavings}%`
    };
};

/**
 * Formata bytes para string legível
 */
const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Verifica se o navegador suporta WebP
 */
export const supportsWebP = (): boolean => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
};

/**
 * Obtém formato ideal para o navegador
 */
export const getOptimalFormat = (): 'image/webp' | 'image/jpeg' => {
    return supportsWebP() ? 'image/webp' : 'image/jpeg';
};

// ============================================
// 🔧 OTIMIZAÇÃO: LAZY LOADING DE IMAGENS
// ============================================

/**
 * Hook para lazy loading de imagens
 * Carrega imagens apenas quando visíveis na tela
 */
export const createLazyImageObserver = (
    callback: (entry: IntersectionObserverEntry) => void
): IntersectionObserver => {
    return new IntersectionObserver(
        (entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    callback(entry);
                }
            });
        },
        {
            rootMargin: '50px', // Carrega 50px antes de aparecer
            threshold: 0.1
        }
    );
};

// ============================================
// 🔧 OTIMIZAÇÃO: CACHE DE IMAGENS
// ============================================

const IMAGE_CACHE_NAME = 'fazenda-images-v1';

/**
 * Salva imagem no cache do navegador
 */
export const cacheImage = async (url: string): Promise<void> => {
    if (!('caches' in window)) return;
    
    try {
        const cache = await caches.open(IMAGE_CACHE_NAME);
        await cache.add(url);
    } catch (error) {
        console.warn('Falha ao cachear imagem:', error);
    }
};

/**
 * Busca imagem do cache
 */
export const getCachedImage = async (url: string): Promise<Response | undefined> => {
    if (!('caches' in window)) return undefined;
    
    try {
        const cache = await caches.open(IMAGE_CACHE_NAME);
        return await cache.match(url);
    } catch {
        return undefined;
    }
};

/**
 * Limpa cache de imagens antigas
 */
export const cleanImageCache = async (maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<void> => {
    if (!('caches' in window)) return;

    // Por simplicidade, limpa todo o cache antigo
    // Em produção, você pode implementar lógica mais sofisticada
    const cacheNames = await caches.keys();
    for (const name of cacheNames) {
        if (name.startsWith('fazenda-images-') && name !== IMAGE_CACHE_NAME) {
            await caches.delete(name);
        }
    }
};

// ============================================
// 🔧 OTIMIZAÇÃO: CACHE DE IMAGENS POR HASH
// ============================================
// Evita re-download de imagens idênticas usando hash do conteúdo

const IMAGE_HASH_DB_NAME = 'fazenda-image-hashes';
const IMAGE_HASH_STORE_NAME = 'hashes';

/**
 * Gera hash simples de uma string (URL)
 * Usado para criar chave de cache única
 */
const simpleHash = (str: string): string => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
};

/**
 * Gera hash do conteúdo de um Blob
 * Permite identificar imagens idênticas mesmo com URLs diferentes
 */
export const generateImageHash = async (blob: Blob): Promise<string> => {
    const buffer = await blob.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
};

/**
 * Interface para o cache de hash de imagens
 */
interface ImageHashEntry {
    url: string;
    hash: string;
    timestamp: number;
    size: number;
}

/**
 * Abre o IndexedDB para cache de hashes
 */
const openHashDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(IMAGE_HASH_DB_NAME, 1);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(IMAGE_HASH_STORE_NAME)) {
                const store = db.createObjectStore(IMAGE_HASH_STORE_NAME, { keyPath: 'hash' });
                store.createIndex('url', 'url', { unique: false });
                store.createIndex('timestamp', 'timestamp', { unique: false });
            }
        };
    });
};

/**
 * Verifica se uma imagem já está no cache pelo hash
 * Retorna a URL cacheada se existir
 */
export const getImageByHash = async (hash: string): Promise<string | null> => {
    try {
        const db = await openHashDB();
        const transaction = db.transaction(IMAGE_HASH_STORE_NAME, 'readonly');
        const store = transaction.objectStore(IMAGE_HASH_STORE_NAME);

        return new Promise((resolve) => {
            const request = store.get(hash);
            request.onsuccess = () => {
                const entry = request.result as ImageHashEntry | undefined;
                if (entry) {
                    console.log(`🖼️ [HASH-CACHE] Hit: ${hash.substring(0, 8)}...`);
                    resolve(entry.url);
                } else {
                    resolve(null);
                }
            };
            request.onerror = () => resolve(null);
        });
    } catch (error) {
        console.warn('⚠️ [HASH-CACHE] Erro ao buscar:', error);
        return null;
    }
};

/**
 * Salva hash de imagem no cache
 */
export const saveImageHash = async (hash: string, url: string, size: number): Promise<void> => {
    try {
        const db = await openHashDB();
        const transaction = db.transaction(IMAGE_HASH_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(IMAGE_HASH_STORE_NAME);

        const entry: ImageHashEntry = {
            hash,
            url,
            timestamp: Date.now(),
            size
        };

        store.put(entry);
        console.log(`🖼️ [HASH-CACHE] Saved: ${hash.substring(0, 8)}... (${formatBytes(size)})`);
    } catch (error) {
        console.warn('⚠️ [HASH-CACHE] Erro ao salvar:', error);
    }
};

/**
 * Verifica se uma URL de imagem já foi baixada (pelo conteúdo)
 * Útil para evitar re-upload de imagens idênticas
 */
export const checkDuplicateImage = async (blob: Blob): Promise<{ isDuplicate: boolean; existingUrl?: string }> => {
    try {
        const hash = await generateImageHash(blob);
        const existingUrl = await getImageByHash(hash);

        if (existingUrl) {
            return { isDuplicate: true, existingUrl };
        }

        return { isDuplicate: false };
    } catch (error) {
        console.warn('⚠️ [HASH-CACHE] Erro ao verificar duplicata:', error);
        return { isDuplicate: false };
    }
};

/**
 * Limpa hashes antigos do cache (mais de 30 dias)
 */
export const cleanOldHashes = async (maxAgeMs: number = 30 * 24 * 60 * 60 * 1000): Promise<number> => {
    try {
        const db = await openHashDB();
        const transaction = db.transaction(IMAGE_HASH_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(IMAGE_HASH_STORE_NAME);
        const index = store.index('timestamp');

        const cutoffTime = Date.now() - maxAgeMs;
        const range = IDBKeyRange.upperBound(cutoffTime);

        let deletedCount = 0;

        return new Promise((resolve) => {
            const request = index.openCursor(range);

            request.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
                if (cursor) {
                    cursor.delete();
                    deletedCount++;
                    cursor.continue();
                } else {
                    console.log(`🧹 [HASH-CACHE] Removidos ${deletedCount} hashes antigos`);
                    resolve(deletedCount);
                }
            };

            request.onerror = () => resolve(0);
        });
    } catch (error) {
        console.warn('⚠️ [HASH-CACHE] Erro na limpeza:', error);
        return 0;
    }
};

/**
 * Obtém estatísticas do cache de hashes
 */
export const getHashCacheStats = async (): Promise<{ count: number; totalSize: number }> => {
    try {
        const db = await openHashDB();
        const transaction = db.transaction(IMAGE_HASH_STORE_NAME, 'readonly');
        const store = transaction.objectStore(IMAGE_HASH_STORE_NAME);

        return new Promise((resolve) => {
            let count = 0;
            let totalSize = 0;

            const request = store.openCursor();

            request.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
                if (cursor) {
                    count++;
                    totalSize += (cursor.value as ImageHashEntry).size || 0;
                    cursor.continue();
                } else {
                    resolve({ count, totalSize });
                }
            };

            request.onerror = () => resolve({ count: 0, totalSize: 0 });
        });
    } catch (error) {
        console.warn('⚠️ [HASH-CACHE] Erro ao obter stats:', error);
        return { count: 0, totalSize: 0 };
    }
};
