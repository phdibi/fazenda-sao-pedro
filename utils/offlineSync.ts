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
    if (op.type === 'create') {
      await db.collection(op.collection).add(op.data);
      console.log('✅ Animal criado:', op.data.brinco || op.id);

    } else if (op.type === 'update') {
      const ref = db.collection(op.collection).doc(op.data.id);
      await ref.set(op.data, { merge: true });
      console.log('✅ Operação atualizada:', op.id);

    } else if (op.type === 'delete') {
      const ref = db.collection(op.collection).doc(op.data.id);
      await ref.delete();
      console.log('✅ Operação deletada:', op.id);
    }
  } catch (error) {
    console.error('❌ Erro ao sincronizar:', op.id, error);
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

  // ✅ ADICIONE O clearQueue() AQUI, DENTRO DA CLASSE
  clearQueue() {
    localStorage.removeItem(this.storageKey);
    console.log('🗑️ Fila offline limpa');
  }
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
