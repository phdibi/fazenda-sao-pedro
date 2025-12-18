import { useEffect, useState, useCallback } from 'react';
import { offlineQueue } from '../utils/offlineSync';
import { useFarmData } from '../contexts/FarmContext';

export const useOfflineSyncManager = () => {
    const { firestore } = useFarmData();
    const { db: dbInstance } = firestore;
    const [isSyncing, setIsSyncing] = useState(false);

    const handleSync = useCallback(async () => {
        if (!dbInstance) return;

        setIsSyncing(true);
        console.log('🔄 Internet voltou! Sincronizando dados offline...');
        try {
            await offlineQueue.processQueue(dbInstance);
            alert('✅ Dados sincronizados com sucesso!');
        } catch (error) {
            console.error('Erro ao sincronizar dados:', error);
            alert('❌ Erro ao sincronizar dados offline.');
        } finally {
            setIsSyncing(false);
        }
    }, [dbInstance]);

    useEffect(() => {
        if (!dbInstance) return;

        window.addEventListener('sync-offline-data', handleSync);
        return () => window.removeEventListener('sync-offline-data', handleSync);
    }, [dbInstance, handleSync]);

    return { isSyncing };
};
