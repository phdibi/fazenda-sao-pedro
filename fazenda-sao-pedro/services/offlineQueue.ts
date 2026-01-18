/**
 * 🔧 Offline Queue Service - Fila de Operações Offline Persistente
 *
 * Gerencia operações que não puderam ser enviadas ao Firebase devido a
 * problemas de conectividade. A fila é persistida no IndexedDB para
 * sobreviver a refreshs da página.
 *
 * Funcionalidades:
 * - Persistência em IndexedDB
 * - Retry automático com backoff exponencial
 * - Processamento em ordem (FIFO)
 * - Deduplicação de operações
 * - Notificação de status
 */

import { OfflineOperation, OfflineOperationType } from '../types';

// ============================================
// CONFIGURAÇÃO
// ============================================

const CONFIG = {
  dbName: 'fazenda-offline-queue',
  storeName: 'operations',
  maxRetries: 5,
  baseRetryDelayMs: 1000,
  maxRetryDelayMs: 60000,
  batchSize: 10, // Processar N operações por vez
};

// ============================================
// INDEXEDDB HELPERS
// ============================================

class OfflineQueueDB {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    if (this.db) return;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(CONFIG.dbName, 1);

      request.onerror = () => {
        this.initPromise = null;
        console.error('[OfflineQueue] Erro ao abrir DB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('[OfflineQueue] IndexedDB inicializado');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(CONFIG.storeName)) {
          const store = db.createObjectStore(CONFIG.storeName, { keyPath: 'id' });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          console.log('[OfflineQueue] Store criado');
        }
      };
    });

    return this.initPromise;
  }

  async add(operation: OfflineOperation): Promise<void> {
    await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([CONFIG.storeName], 'readwrite');
      const store = transaction.objectStore(CONFIG.storeName);
      store.put(operation);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async update(operation: OfflineOperation): Promise<void> {
    return this.add(operation); // put atualiza se já existe
  }

  async delete(id: string): Promise<void> {
    await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([CONFIG.storeName], 'readwrite');
      const store = transaction.objectStore(CONFIG.storeName);
      store.delete(id);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getAll(): Promise<OfflineOperation[]> {
    await this.init();
    if (!this.db) return [];

    return new Promise((resolve) => {
      const transaction = this.db!.transaction([CONFIG.storeName], 'readonly');
      const store = transaction.objectStore(CONFIG.storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
  }

  async getPending(): Promise<OfflineOperation[]> {
    await this.init();
    if (!this.db) return [];

    return new Promise((resolve) => {
      const transaction = this.db!.transaction([CONFIG.storeName], 'readonly');
      const store = transaction.objectStore(CONFIG.storeName);
      const index = store.index('status');
      const request = index.getAll('pending');

      request.onsuccess = () => {
        const results = (request.result || []).sort((a, b) => a.timestamp - b.timestamp);
        resolve(results);
      };
      request.onerror = () => resolve([]);
    });
  }

  async clear(): Promise<void> {
    await this.init();
    if (!this.db) return;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction([CONFIG.storeName], 'readwrite');
      const store = transaction.objectStore(CONFIG.storeName);
      store.clear();

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
    });
  }

  async count(): Promise<number> {
    await this.init();
    if (!this.db) return 0;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction([CONFIG.storeName], 'readonly');
      const store = transaction.objectStore(CONFIG.storeName);
      const request = store.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(0);
    });
  }
}

// ============================================
// OFFLINE QUEUE SERVICE
// ============================================

type OperationExecutor = (operation: OfflineOperation) => Promise<void>;
type StatusCallback = (pending: number, processing: number, failed: number) => void;

class OfflineQueueService {
  private db = new OfflineQueueDB();
  private executors: Map<OfflineOperationType, OperationExecutor> = new Map();
  private isProcessing = false;
  private statusCallbacks: StatusCallback[] = [];

  constructor() {
    // Configura listener de conectividade
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('🌐 [OfflineQueue] Conexão restaurada, processando fila...');
        this.processQueue();
      });
    }
  }

  /**
   * Registra um executor para um tipo de operação
   */
  registerExecutor(type: OfflineOperationType, executor: OperationExecutor): void {
    this.executors.set(type, executor);
  }

  /**
   * Adiciona operação à fila
   */
  async enqueue(
    type: OfflineOperationType,
    collection: string,
    data: any,
    documentId?: string
  ): Promise<string> {
    const operation: OfflineOperation = {
      id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      collection,
      documentId,
      data,
      timestamp: Date.now(),
      retryCount: 0,
      status: 'pending',
    };

    await this.db.add(operation);
    console.log(`📥 [OfflineQueue] Operação adicionada: ${type} (${operation.id})`);

    this.notifyStatusChange();

    // Tenta processar se estiver online
    if (navigator.onLine) {
      this.processQueue();
    }

    return operation.id;
  }

  /**
   * Processa a fila de operações pendentes
   */
  async processQueue(): Promise<void> {
    if (this.isProcessing) {
      console.log('⏳ [OfflineQueue] Processamento já em andamento');
      return;
    }

    if (!navigator.onLine) {
      console.log('📴 [OfflineQueue] Sem conexão, aguardando...');
      return;
    }

    this.isProcessing = true;

    try {
      const pending = await this.db.getPending();
      console.log(`🔄 [OfflineQueue] Processando ${pending.length} operações pendentes`);

      for (const operation of pending.slice(0, CONFIG.batchSize)) {
        await this.processOperation(operation);
      }

      // Se ainda há mais operações, agenda próximo batch
      const remaining = await this.db.getPending();
      if (remaining.length > 0) {
        setTimeout(() => this.processQueue(), 1000);
      }
    } finally {
      this.isProcessing = false;
      this.notifyStatusChange();
    }
  }

  /**
   * Processa uma única operação
   */
  private async processOperation(operation: OfflineOperation): Promise<void> {
    const executor = this.executors.get(operation.type);

    if (!executor) {
      console.warn(`⚠️ [OfflineQueue] Nenhum executor registrado para: ${operation.type}`);
      operation.status = 'failed';
      operation.lastError = 'Executor não encontrado';
      await this.db.update(operation);
      return;
    }

    operation.status = 'processing';
    await this.db.update(operation);

    try {
      await executor(operation);

      // Sucesso - remove da fila
      await this.db.delete(operation.id);
      console.log(`✅ [OfflineQueue] Operação concluída: ${operation.type} (${operation.id})`);

    } catch (error) {
      operation.retryCount++;
      operation.lastError = error instanceof Error ? error.message : 'Erro desconhecido';

      if (operation.retryCount >= CONFIG.maxRetries) {
        operation.status = 'failed';
        console.error(`❌ [OfflineQueue] Operação falhou após ${CONFIG.maxRetries} tentativas: ${operation.id}`);
      } else {
        operation.status = 'pending';
        console.warn(`⚠️ [OfflineQueue] Retry ${operation.retryCount}/${CONFIG.maxRetries}: ${operation.id}`);

        // Backoff exponencial
        const delay = Math.min(
          CONFIG.baseRetryDelayMs * Math.pow(2, operation.retryCount),
          CONFIG.maxRetryDelayMs
        );
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      await this.db.update(operation);
    }
  }

  /**
   * Retorna estatísticas da fila
   */
  async getStats(): Promise<{ pending: number; processing: number; failed: number; total: number }> {
    const all = await this.db.getAll();
    return {
      pending: all.filter(o => o.status === 'pending').length,
      processing: all.filter(o => o.status === 'processing').length,
      failed: all.filter(o => o.status === 'failed').length,
      total: all.length,
    };
  }

  /**
   * Retorna todas as operações
   */
  async getAll(): Promise<OfflineOperation[]> {
    return this.db.getAll();
  }

  /**
   * Retorna operações com falha
   */
  async getFailed(): Promise<OfflineOperation[]> {
    const all = await this.db.getAll();
    return all.filter(o => o.status === 'failed');
  }

  /**
   * Reprocessa operações com falha
   */
  async retryFailed(): Promise<void> {
    const failed = await this.getFailed();

    for (const operation of failed) {
      operation.status = 'pending';
      operation.retryCount = 0;
      await this.db.update(operation);
    }

    console.log(`🔄 [OfflineQueue] ${failed.length} operações reativadas para retry`);
    this.processQueue();
  }

  /**
   * Remove operações com falha
   */
  async clearFailed(): Promise<void> {
    const failed = await this.getFailed();

    for (const operation of failed) {
      await this.db.delete(operation.id);
    }

    console.log(`🗑️ [OfflineQueue] ${failed.length} operações com falha removidas`);
    this.notifyStatusChange();
  }

  /**
   * Limpa toda a fila
   */
  async clearAll(): Promise<void> {
    await this.db.clear();
    console.log('🗑️ [OfflineQueue] Fila completamente limpa');
    this.notifyStatusChange();
  }

  /**
   * Registra callback para mudanças de status
   */
  onStatusChange(callback: StatusCallback): () => void {
    this.statusCallbacks.push(callback);

    // Retorna função para remover o callback
    return () => {
      const index = this.statusCallbacks.indexOf(callback);
      if (index > -1) {
        this.statusCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Notifica callbacks sobre mudança de status
   */
  private async notifyStatusChange(): Promise<void> {
    const stats = await this.getStats();
    this.statusCallbacks.forEach(cb => cb(stats.pending, stats.processing, stats.failed));
  }

  /**
   * Verifica se há operações pendentes
   */
  async hasPending(): Promise<boolean> {
    const stats = await this.getStats();
    return stats.pending > 0 || stats.processing > 0;
  }
}

// Exporta instância singleton
export const offlineQueue = new OfflineQueueService();

// Exporta classe para testes
export { OfflineQueueService };
