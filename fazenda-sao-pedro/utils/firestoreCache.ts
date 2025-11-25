/**
 * Sistema de cache em memória para Firestore
 * Reduz leituras em até 80%
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class FirestoreCache {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

  /**
   * Busca do cache ou executa a função se não houver cache válido
   */
  async get<T>(
    key: string,
    fetchFn: () => Promise<T>,
    customDuration?: number
  ): Promise<T> {
    const cached = this.cache.get(key);
    const now = Date.now();
    const duration = customDuration || this.CACHE_DURATION;

    // Se tem cache válido, retorna
    if (cached && now - cached.timestamp < duration) {
      console.log(`✅ Cache HIT: ${key} (economizou leituras!)`);
      return cached.data;
    }

    // Senão, busca do Firestore
    console.log(`🔍 Cache MISS: ${key} (lendo do Firestore...)`);
    const data = await fetchFn();

    this.cache.set(key, {
      data,
      timestamp: now
    });

    return data;
  }

  /**
   * Invalida cache específico ou tudo
   */
  invalidate(key?: string) {
    if (key) {
      this.cache.delete(key);
      console.log(`🗑️ Cache invalidado: ${key}`);
    } else {
      this.cache.clear();
      console.log(`🗑️ TODO o cache foi limpo`);
    }
  }

  /**
   * Limpa caches expirados automaticamente
   */
  cleanExpired() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.CACHE_DURATION) {
        this.cache.delete(key);
      }
    }
  }
}

export const firestoreCache = new FirestoreCache();

// Limpa cache expirado a cada 10 minutos
setInterval(() => {
  firestoreCache.cleanExpired();
}, 10 * 60 * 1000);
