import { log } from './logger';

interface QueuedOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  collection: string;
  data: any;
  timestamp: number;
}

class OfflineQueue {
  private storageKey = 'offline_operations_queue';

  // Adiciona operação na fila (com deduplicação)
  add(operation: Omit<QueuedOperation, 'id' | 'timestamp'>) {
    let queue = this.getQueue();

    // OTIMIZAÇÃO: Remove operações anteriores no mesmo documento
    // Evita múltiplas writes desnecessárias no Firestore
    if (operation.data?.id) {
      queue = queue.filter(op =>
        !(op.collection === operation.collection && op.data?.id === operation.data?.id)
      );
    }

    const newOp: QueuedOperation = {
      ...operation,
      id: `${Date.now()}_${Math.random()}`,
      timestamp: Date.now()
    };
    queue.push(newOp);
    localStorage.setItem(this.storageKey, JSON.stringify(queue));
    log.info('📦 Operação adicionada à fila offline:', newOp);
  }

  // Busca fila
  getQueue(): QueuedOperation[] {
    const stored = localStorage.getItem(this.storageKey);
    return stored ? JSON.parse(stored) : [];
  }

  // Processa fila quando voltar online
  async processQueue(db: any) {
    const queue = this.getQueue();
    if (queue.length === 0) return;

    log.info(`🔄 Processando ${queue.length} operações offline...`);

    for (const op of queue) {
      try {
        if (op.type === 'create') {
          await db.collection(op.collection).add(op.data);
          log.info('✅ Animal criado:', op.data.brinco || op.id);

        } else if (op.type === 'update') {
          const ref = db.collection(op.collection).doc(op.data.id);
          await ref.set(op.data, { merge: true });
          log.info('✅ Operação atualizada:', op.id);

        } else if (op.type === 'delete') {
          const ref = db.collection(op.collection).doc(op.data.id);
          await ref.delete();
          log.info('✅ Operação deletada:', op.id);
        }
      } catch (error) {
        log.error('❌ Erro ao sincronizar:', op.id, error);
        continue;
      }
    }

    // Limpa fila após sincronização
    localStorage.removeItem(this.storageKey);
    log.info('✅ Fila offline processada!');
  }

  // Remove operação específica
  remove(id: string) {
    const queue = this.getQueue().filter(op => op.id !== id);
    localStorage.setItem(this.storageKey, JSON.stringify(queue));
  }

  clearQueue() {
    localStorage.removeItem(this.storageKey);
    log.info('🗑️ Fila offline limpa');
  }
}

export const offlineQueue = new OfflineQueue();

// Listener para detectar quando voltar online
const onlineHandler = () => {
  log.info('🌐 Conectado! Sincronizando dados...');
  window.dispatchEvent(new Event('sync-offline-data'));
};

const offlineHandler = () => {
  log.info('📡 Offline detectado. Dados serão salvos localmente.');
};

window.addEventListener('online', onlineHandler);
window.addEventListener('offline', offlineHandler);

export const cleanupOfflineListeners = () => {
  window.removeEventListener('online', onlineHandler);
  window.removeEventListener('offline', offlineHandler);
};
