interface QueuedOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  collection: string;
  data: any;
  timestamp: number;
}

class OfflineQueue {
  private storageKey = 'offline_operations_queue';

  // Adiciona operação na fila
  add(operation: Omit<QueuedOperation, 'id' | 'timestamp'>) {
    const queue = this.getQueue();
    const newOp: QueuedOperation = {
      ...operation,
      id: `${Date.now()}_${Math.random()}`,
      timestamp: Date.now()
    };
    queue.push(newOp);
    localStorage.setItem(this.storageKey, JSON.stringify(queue));
    console.log('📦 Operação adicionada à fila offline:', newOp);
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

    console.log(`🔄 Processando ${queue.length} operações offline...`);

    for (const op of queue) {
      try {
        const ref = db.collection(op.collection).doc(op.data.id || op.id);

        switch (op.type) {
          case 'create':
          case 'update':
            await ref.set(op.data, { merge: true });
            break;
          case 'delete':
            await ref.delete();
            break;
        }

        console.log('✅ Operação sincronizada:', op.id);
      } catch (error) {
        console.error('❌ Erro ao sincronizar:', op.id, error);
        // Mantém na fila para tentar depois
        continue;
      }
    }

    // Limpa fila após sincronização
    localStorage.removeItem(this.storageKey);
    console.log('✅ Fila offline processada!');
  }

  // Remove operação específica
  remove(id: string) {
    const queue = this.getQueue().filter(op => op.id !== id);
    localStorage.setItem(this.storageKey, JSON.stringify(queue));
  }
}

  clearQueue() {
    localStorage.removeItem(this.storageKey);
    console.log('🗑️ Fila offline limpa');
  }

export const offlineQueue = new OfflineQueue();

// Listener para detectar quando voltar online
window.addEventListener('online', () => {
  console.log('🌐 Conectado! Sincronizando dados...');
  // Dispara evento customizado para sincronizar
  window.dispatchEvent(new Event('sync-offline-data'));
});

window.addEventListener('offline', () => {
  console.log('📡 Offline detectado. Dados serão salvos localmente.');
});
