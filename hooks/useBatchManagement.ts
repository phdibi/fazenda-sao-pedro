import { useState, useCallback, useEffect } from 'react';
import { ManagementBatch, BatchPurpose } from '../types';

const STORAGE_KEY = 'management_batches';

export const useBatchManagement = (userId: string | undefined) => {
  const [batches, setBatches] = useState<ManagementBatch[]>([]);

  // Carrega do localStorage
  useEffect(() => {
    if (!userId) return;
    
    const stored = localStorage.getItem(`${STORAGE_KEY}_${userId}`);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Converte datas de string para Date
        const converted = parsed.map((b: any) => ({
          ...b,
          createdAt: new Date(b.createdAt),
          completedAt: b.completedAt ? new Date(b.completedAt) : undefined,
        }));
        setBatches(converted);
      } catch (e) {
        console.error('Erro ao carregar lotes:', e);
      }
    }
  }, [userId]);

  // Salva no localStorage
  const saveBatches = useCallback((newBatches: ManagementBatch[]) => {
    if (!userId) return;
    localStorage.setItem(`${STORAGE_KEY}_${userId}`, JSON.stringify(newBatches));
    setBatches(newBatches);
  }, [userId]);

  const createBatch = useCallback((batch: Omit<ManagementBatch, 'id'>) => {
    const newBatch: ManagementBatch = {
      ...batch,
      id: `batch-${Date.now()}`,
    };
    saveBatches([...batches, newBatch]);
    return newBatch;
  }, [batches, saveBatches]);

  const updateBatch = useCallback((batchId: string, data: Partial<ManagementBatch>) => {
    const updated = batches.map(b => 
      b.id === batchId ? { ...b, ...data } : b
    );
    saveBatches(updated);
  }, [batches, saveBatches]);

  const deleteBatch = useCallback((batchId: string) => {
    saveBatches(batches.filter(b => b.id !== batchId));
  }, [batches, saveBatches]);

  const completeBatch = useCallback((batchId: string) => {
    const updated = batches.map(b => 
      b.id === batchId 
        ? { ...b, status: 'completed' as const, completedAt: new Date() } 
        : b
    );
    saveBatches(updated);
  }, [batches, saveBatches]);

  const addAnimalToBatch = useCallback((batchId: string, animalId: string) => {
    const updated = batches.map(b => {
      if (b.id === batchId && !b.animalIds.includes(animalId)) {
        return { ...b, animalIds: [...b.animalIds, animalId] };
      }
      return b;
    });
    saveBatches(updated);
  }, [batches, saveBatches]);

  const removeAnimalFromBatch = useCallback((batchId: string, animalId: string) => {
    const updated = batches.map(b => {
      if (b.id === batchId) {
        return { ...b, animalIds: b.animalIds.filter(id => id !== animalId) };
      }
      return b;
    });
    saveBatches(updated);
  }, [batches, saveBatches]);

  const getActiveBatches = useCallback(() => {
    return batches.filter(b => b.status === 'active');
  }, [batches]);

  const getBatchByAnimal = useCallback((animalId: string) => {
    return batches.filter(b => b.status === 'active' && b.animalIds.includes(animalId));
  }, [batches]);

  return {
    batches,
    createBatch,
    updateBatch,
    deleteBatch,
    completeBatch,
    addAnimalToBatch,
    removeAnimalFromBatch,
    getActiveBatches,
    getBatchByAnimal,
  };
};
