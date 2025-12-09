/**
 * LocalCache - Serviço de cache local usando IndexedDB
 * 
 * Funcionalidades:
 * - Cache persistente entre sessões
 * - Versionamento para invalidação automática
 * - Expiração por tempo (stale-while-revalidate)
 * - Singleton thread-safe (evita race conditions)
 */

import { CACHE_VERSION, CACHE_EXPIRY_MS } from '../constants/app';

export interface CacheEntry<T> {
  data: T[];
  timestamp: number;
  version: string;
}

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
          const result = request.result;
          if (result && result.version === CACHE_VERSION) {
            resolve(result);
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
   */
  async set<T>(key: string, data: T[]): Promise<void> {
    await this.init();

    if (!this.db) return;

    return new Promise((resolve) => {
      try {
        const transaction = this.db!.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);

        store.put({
          key,
          data,
          timestamp: Date.now(),
          version: CACHE_VERSION,
        });

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
}

// Exporta instância singleton
export const localCache = new LocalCache();

// Exporta classe para testes
export { LocalCache };
