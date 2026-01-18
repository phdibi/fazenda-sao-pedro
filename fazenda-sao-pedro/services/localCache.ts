/**
 * LocalCache - Serviço de cache local usando IndexedDB
 *
 * Funcionalidades:
 * - Cache persistente entre sessões
 * - Versionamento para invalidação automática
 * - Expiração por tempo (stale-while-revalidate)
 * - Singleton thread-safe (evita race conditions)
 * - 🔧 OTIMIZAÇÃO: Compressão LZ-string (~50-70% economia de espaço)
 */

import { CACHE_VERSION, CACHE_EXPIRY_MS } from '../constants/app';
import LZString from 'lz-string';

// 🔧 OTIMIZAÇÃO: Configuração de compressão
const COMPRESSION_CONFIG = {
  enabled: true,
  // Só comprimir dados maiores que 1KB (compressão de dados pequenos não vale a pena)
  minSizeBytes: 1024,
  // Log de economia de espaço
  logCompression: false,
};

export interface CacheEntry<T> {
  data: T[];
  timestamp: number;
  version: string;
}

// 🔧 Estrutura interna com suporte a compressão
interface StoredCacheEntry {
  key: string;
  data?: any[];
  compressedData?: string;
  isCompressed: boolean;
  timestamp: number;
  version: string;
  originalSize?: number;
  compressedSize?: number;
}

// 🔧 OTIMIZAÇÃO: Funções de compressão/descompressão
const compressData = <T>(data: T[]): { compressed: string; originalSize: number; compressedSize: number } => {
  const jsonString = JSON.stringify(data);
  const originalSize = jsonString.length;
  const compressed = LZString.compressToUTF16(jsonString);
  const compressedSize = compressed.length;

  if (COMPRESSION_CONFIG.logCompression) {
    const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(1);
    console.log(`🗜️ [COMPRESSION] ${originalSize} → ${compressedSize} bytes (${ratio}% economia)`);
  }

  return { compressed, originalSize, compressedSize };
};

const decompressData = <T>(compressed: string): T[] => {
  const decompressed = LZString.decompressFromUTF16(compressed);
  if (!decompressed) {
    throw new Error('Falha ao descomprimir dados');
  }
  return JSON.parse(decompressed);
};

class LocalCache {
  private dbName = 'fazenda-cache';
  private storeName = 'cache';
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  /**
   * Inicializa conexão com IndexedDB (singleton)
   * Thread-safe: múltiplas chamadas aguardam a mesma promise
   */
  async init(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    if (this.db) {
      return Promise.resolve();
    }

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => {
        this.initPromise = null;
        console.error('[LocalCache] Erro ao abrir IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('[LocalCache] IndexedDB inicializado');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'key' });
          console.log('[LocalCache] Object store criado');
        }
      };
    });

    return this.initPromise;
  }

  /**
   * Recupera dados do cache
   * 🔧 OTIMIZAÇÃO: Suporte a dados comprimidos
   * @returns CacheEntry se válido, null se expirado ou inexistente
   */
  async get<T>(key: string): Promise<CacheEntry<T> | null> {
    await this.init();

    if (!this.db) return null;

    return new Promise((resolve) => {
      try {
        const transaction = this.db!.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.get(key);

        request.onsuccess = () => {
          const result = request.result as StoredCacheEntry | undefined;
          if (result && result.version === CACHE_VERSION) {
            try {
              // 🔧 Descomprimir se necessário
              let data: T[];
              if (result.isCompressed && result.compressedData) {
                data = decompressData<T>(result.compressedData);
                if (COMPRESSION_CONFIG.logCompression) {
                  console.log(`🗜️ [DECOMPRESS] ${key}: ${result.compressedSize} → ${result.originalSize} bytes`);
                }
              } else {
                data = result.data as T[];
              }

              resolve({
                data,
                timestamp: result.timestamp,
                version: result.version,
              });
            } catch (decompressError) {
              console.warn('[LocalCache] Erro ao descomprimir:', decompressError);
              resolve(null);
            }
          } else {
            resolve(null);
          }
        };

        request.onerror = () => {
          console.warn('[LocalCache] Erro ao ler cache:', request.error);
          resolve(null);
        };
      } catch (error) {
        console.warn('[LocalCache] Erro na transação:', error);
        resolve(null);
      }
    });
  }

  /**
   * Armazena dados no cache
   * 🔧 OTIMIZAÇÃO: Comprime automaticamente dados grandes
   */
  async set<T>(key: string, data: T[]): Promise<void> {
    await this.init();

    if (!this.db) return;

    return new Promise((resolve) => {
      try {
        const transaction = this.db!.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);

        // 🔧 OTIMIZAÇÃO: Comprimir se habilitado e dados grandes o suficiente
        const jsonSize = JSON.stringify(data).length;
        const shouldCompress = COMPRESSION_CONFIG.enabled && jsonSize >= COMPRESSION_CONFIG.minSizeBytes;

        let entry: StoredCacheEntry;

        if (shouldCompress) {
          const { compressed, originalSize, compressedSize } = compressData(data);
          entry = {
            key,
            compressedData: compressed,
            isCompressed: true,
            timestamp: Date.now(),
            version: CACHE_VERSION,
            originalSize,
            compressedSize,
          };

          if (COMPRESSION_CONFIG.logCompression) {
            const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(1);
            console.log(`🗜️ [CACHE SET] ${key}: ${originalSize} → ${compressedSize} bytes (${ratio}% economia)`);
          }
        } else {
          entry = {
            key,
            data,
            isCompressed: false,
            timestamp: Date.now(),
            version: CACHE_VERSION,
          };
        }

        store.put(entry);

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => {
          console.warn('[LocalCache] Erro ao gravar cache:', transaction.error);
          resolve();
        };
      } catch (error) {
        console.warn('[LocalCache] Erro na transação de escrita:', error);
        resolve();
      }
    });
  }

  /**
   * Limpa todo o cache
   */
  async clear(): Promise<void> {
    await this.init();

    if (!this.db) return;

    return new Promise((resolve) => {
      try {
        const transaction = this.db!.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        store.clear();

        transaction.oncomplete = () => {
          console.log('[LocalCache] Cache limpo');
          resolve();
        };
        transaction.onerror = () => resolve();
      } catch (error) {
        console.warn('[LocalCache] Erro ao limpar cache:', error);
        resolve();
      }
    });
  }

  /**
   * Remove uma entrada específica do cache
   */
  async delete(key: string): Promise<void> {
    await this.init();

    if (!this.db) return;

    return new Promise((resolve) => {
      try {
        const transaction = this.db!.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        store.delete(key);

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => resolve();
      } catch (error) {
        resolve();
      }
    });
  }

  /**
   * Verifica se o cache ainda é válido (não expirou)
   */
  isFresh(timestamp: number): boolean {
    return Date.now() - timestamp < CACHE_EXPIRY_MS;
  }

  /**
   * Retorna idade do cache em minutos
   */
  getAgeMinutes(timestamp: number): number {
    return Math.floor((Date.now() - timestamp) / (60 * 1000));
  }

  /**
   * 🔧 OTIMIZAÇÃO: Limpa entradas antigas do cache
   * Previne crescimento indefinido do IndexedDB
   * @param maxAgeMs Idade máxima em milissegundos (padrão: 7 dias)
   */
  async cleanOldEntries(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): Promise<number> {
    await this.init();

    if (!this.db) return 0;

    return new Promise((resolve) => {
      try {
        const transaction = this.db!.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.openCursor();
        
        let deletedCount = 0;
        const now = Date.now();

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
          
          if (cursor) {
            const entry = cursor.value;
            const age = now - (entry.timestamp || 0);
            
            // Remove se for muito antigo ou versão diferente
            if (age > maxAgeMs || entry.version !== CACHE_VERSION) {
              cursor.delete();
              deletedCount++;
              console.log(`[LocalCache] Removida entrada antiga: ${entry.key}`);
            }
            
            cursor.continue();
          } else {
            // Fim do cursor
            if (deletedCount > 0) {
              console.log(`[LocalCache] Limpeza concluída: ${deletedCount} entradas removidas`);
            }
            resolve(deletedCount);
          }
        };

        request.onerror = () => {
          console.warn('[LocalCache] Erro durante limpeza:', request.error);
          resolve(0);
        };
      } catch (error) {
        console.warn('[LocalCache] Erro na limpeza:', error);
        resolve(0);
      }
    });
  }

  /**
   * Retorna estatísticas do cache
   */
  async getStats(): Promise<{ entryCount: number; totalSize: number; oldestEntry: number }> {
    await this.init();

    if (!this.db) return { entryCount: 0, totalSize: 0, oldestEntry: 0 };

    return new Promise((resolve) => {
      try {
        const transaction = this.db!.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.openCursor();
        
        let entryCount = 0;
        let totalSize = 0;
        let oldestEntry = Date.now();

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
          
          if (cursor) {
            entryCount++;
            totalSize += JSON.stringify(cursor.value).length;
            oldestEntry = Math.min(oldestEntry, cursor.value.timestamp || Date.now());
            cursor.continue();
          } else {
            resolve({ entryCount, totalSize, oldestEntry });
          }
        };

        request.onerror = () => resolve({ entryCount: 0, totalSize: 0, oldestEntry: 0 });
      } catch (error) {
        resolve({ entryCount: 0, totalSize: 0, oldestEntry: 0 });
      }
    });
  }
}

// Exporta instância singleton
export const localCache = new LocalCache();

// Exporta classe para testes
export { LocalCache };

// ============================================
// CACHE COM ÍNDICE - Para buscas rápidas
// ============================================

/**
 * Cache estendido com suporte a índices
 * Permite buscas O(1) por campos específicos
 */
class IndexedCache<T extends { id: string }> {
    private cache: LocalCache;
    private indices: Map<string, Map<string, string>> = new Map();
    private baseKey: string;

    constructor(baseKey: string, cache: LocalCache = localCache) {
        this.baseKey = baseKey;
        this.cache = cache;
    }

    /**
     * Define dados e cria índices
     */
    async set(data: T[], indexFields: (keyof T)[] = []): Promise<void> {
        await this.cache.set(this.baseKey, data);

        // Cria índices para campos especificados
        for (const field of indexFields) {
            const index = new Map<string, string>();
            data.forEach(item => {
                const value = item[field];
                if (value !== undefined && value !== null) {
                    const key = String(value).toLowerCase().trim();
                    index.set(key, item.id);
                }
            });
            this.indices.set(String(field), index);
        }
    }

    /**
     * Busca por ID
     */
    async getById(id: string): Promise<T | null> {
        const cached = await this.cache.get<T>(this.baseKey);
        if (!cached) return null;
        return cached.data.find(item => item.id === id) || null;
    }

    /**
     * Busca por campo indexado (O(1))
     */
    async getByField(field: keyof T, value: string): Promise<T | null> {
        const index = this.indices.get(String(field));
        if (!index) {
            // Fallback para busca linear se não houver índice
            const cached = await this.cache.get<T>(this.baseKey);
            if (!cached) return null;
            return cached.data.find(item => 
                String(item[field]).toLowerCase().trim() === value.toLowerCase().trim()
            ) || null;
        }

        const id = index.get(value.toLowerCase().trim());
        if (!id) return null;

        return this.getById(id);
    }

    /**
     * Busca múltiplos por campo
     */
    async getManyByField(field: keyof T, values: string[]): Promise<T[]> {
        const results: T[] = [];
        for (const value of values) {
            const item = await this.getByField(field, value);
            if (item) results.push(item);
        }
        return results;
    }

    /**
     * Retorna todos os dados
     */
    async getAll(): Promise<T[]> {
        const cached = await this.cache.get<T>(this.baseKey);
        return cached?.data || [];
    }

    /**
     * Limpa cache e índices
     */
    async clear(): Promise<void> {
        await this.cache.delete(this.baseKey);
        this.indices.clear();
    }

    /**
     * Verifica se o cache está fresco
     */
    async isFresh(): Promise<boolean> {
        const cached = await this.cache.get<T>(this.baseKey);
        if (!cached) return false;
        return this.cache.isFresh(cached.timestamp);
    }
}

/**
 * Factory para criar caches indexados
 */
export const createIndexedCache = <T extends { id: string }>(baseKey: string) => 
    new IndexedCache<T>(baseKey);

export { IndexedCache };

// ============================================
// 🔧 OTIMIZAÇÃO: CACHE DE QUERIES EM MEMÓRIA
// ============================================
// Para resultados de filtros frequentes (ex: animais por área)

const queryCache = new Map<string, { data: any[]; timestamp: number }>();
const QUERY_CACHE_TTL = 5 * 60 * 1000; // 5 minutos

/**
 * Obtém resultado de query do cache ou computa e cacheia
 * @param key Chave única para a query (ex: "animals-by-area-123")
 * @param computeFn Função que computa o resultado se não estiver em cache
 */
export const getCachedQuery = <T>(
    key: string,
    computeFn: () => T[]
): T[] => {
    const cached = queryCache.get(key);

    if (cached && Date.now() - cached.timestamp < QUERY_CACHE_TTL) {
        console.log(`📦 [QUERY CACHE HIT] ${key}`);
        return cached.data as T[];
    }

    const result = computeFn();
    queryCache.set(key, { data: result, timestamp: Date.now() });
    console.log(`💾 [QUERY CACHE SET] ${key} (${result.length} items)`);

    return result;
};

/**
 * Invalida cache de queries (chamar após mutações)
 * @param keyPrefix Prefixo das chaves a invalidar (ex: "animals" invalida todas queries de animais)
 */
export const invalidateQueryCache = (keyPrefix?: string): void => {
    if (keyPrefix) {
        const keysToDelete: string[] = [];
        queryCache.forEach((_, key) => {
            if (key.startsWith(keyPrefix)) {
                keysToDelete.push(key);
            }
        });
        keysToDelete.forEach(key => queryCache.delete(key));
        if (keysToDelete.length > 0) {
            console.log(`🗑️ [QUERY CACHE] Invalidadas ${keysToDelete.length} queries com prefixo "${keyPrefix}"`);
        }
    } else {
        queryCache.clear();
        console.log('🗑️ [QUERY CACHE] Todo cache de queries invalidado');
    }
};

/**
 * Retorna estatísticas do cache de queries
 */
export const getQueryCacheStats = (): { entries: number; keys: string[] } => ({
    entries: queryCache.size,
    keys: Array.from(queryCache.keys())
});
