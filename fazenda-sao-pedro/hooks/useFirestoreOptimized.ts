import { useState, useEffect, useCallback, useReducer, useRef } from 'react';
import { db, Timestamp, FieldValue } from '../services/firebase';
import { Animal, CalendarEvent, Task, ManagementArea, Sexo, WeighingType, AppUser } from '../types';

// ============================================
// 🔧 CACHE LOCAL COM INDEXEDDB
// ============================================

const CACHE_VERSION = 'v2';
const CACHE_EXPIRY_MS = 30 * 60 * 1000; // 30 minutos - economia de ~50% leituras Firestore

interface CacheEntry<T> {
    data: T[];
    timestamp: number;
    version: string;
}

class LocalCache {
    private dbName = 'fazenda-cache';
    private db: IDBDatabase | null = null;

    async init(): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains('cache')) {
                    db.createObjectStore('cache', { keyPath: 'key' });
                }
            };
        });
    }

    async get<T>(key: string): Promise<CacheEntry<T> | null> {
        if (!this.db) await this.init();
        
        return new Promise((resolve) => {
            const transaction = this.db!.transaction(['cache'], 'readonly');
            const store = transaction.objectStore('cache');
            const request = store.get(key);
            
            request.onsuccess = () => {
                const result = request.result;
                if (result && result.version === CACHE_VERSION) {
                    resolve(result);
                } else {
                    resolve(null);
                }
            };
            request.onerror = () => resolve(null);
        });
    }

    async set<T>(key: string, data: T[]): Promise<void> {
        if (!this.db) await this.init();
        
        return new Promise((resolve) => {
            const transaction = this.db!.transaction(['cache'], 'readwrite');
            const store = transaction.objectStore('cache');
            store.put({
                key,
                data,
                timestamp: Date.now(),
                version: CACHE_VERSION
            });
            transaction.oncomplete = () => resolve();
        });
    }

    async clear(): Promise<void> {
        if (!this.db) return;
        
        return new Promise((resolve) => {
            const transaction = this.db!.transaction(['cache'], 'readwrite');
            const store = transaction.objectStore('cache');
            store.clear();
            transaction.oncomplete = () => resolve();
        });
    }

    isFresh(timestamp: number): boolean {
        return Date.now() - timestamp < CACHE_EXPIRY_MS;
    }
}

const localCache = new LocalCache();

// ============================================
// STATE MANAGEMENT
// ============================================

interface FirestoreState {
    animals: Animal[];
    calendarEvents: CalendarEvent[];
    tasks: Task[];
    managementAreas: ManagementArea[];
    loading: {
        animals: boolean;
        calendar: boolean;
        tasks: boolean;
        areas: boolean;
    };
    error: string | null;
    lastSync: number | null;
}

type FirestoreAction =
    | { type: 'SET_DATA'; payload: { collection: keyof Omit<FirestoreState, 'loading' | 'error' | 'lastSync'>; data: any[] } }
    | { type: 'SET_LOADING_STATUS'; payload: { collection: keyof FirestoreState['loading']; status: boolean } }
    | { type: 'SET_ERROR'; payload: string }
    | { type: 'SET_LAST_SYNC'; payload: number }
    // Animals
    | { type: 'LOCAL_ADD_ANIMAL'; payload: Animal }
    | { type: 'LOCAL_UPDATE_ANIMAL'; payload: { animalId: string; updatedData: Partial<Animal> } }
    | { type: 'LOCAL_DELETE_ANIMAL'; payload: { animalId: string } }
    // Calendar Events - NOVO
    | { type: 'LOCAL_ADD_CALENDAR_EVENT'; payload: CalendarEvent }
    | { type: 'LOCAL_UPDATE_CALENDAR_EVENT'; payload: CalendarEvent }
    | { type: 'LOCAL_DELETE_CALENDAR_EVENT'; payload: { eventId: string } }
    // Tasks - NOVO
    | { type: 'LOCAL_ADD_TASK'; payload: Task }
    | { type: 'LOCAL_UPDATE_TASK'; payload: { taskId: string; updatedData: Partial<Task> } }
    | { type: 'LOCAL_DELETE_TASK'; payload: { taskId: string } }
    // Management Areas - NOVO
    | { type: 'LOCAL_ADD_AREA'; payload: ManagementArea }
    | { type: 'LOCAL_UPDATE_AREA'; payload: ManagementArea }
    | { type: 'LOCAL_DELETE_AREA'; payload: { areaId: string } };

const initialState: FirestoreState = {
    animals: [],
    calendarEvents: [],
    tasks: [],
    managementAreas: [],
    loading: { animals: true, calendar: true, tasks: true, areas: true },
    error: null,
    lastSync: null
};

// Helpers para conversão de timestamps
const convertTimestampsToDates = (data: any): any => {
    if (!data) return data;
    if (Array.isArray(data)) return data.map(item => convertTimestampsToDates(item));
    if (data instanceof Timestamp) return data.toDate();
    if (typeof data === 'object' && data !== null) {
        const converted = { ...data };
        for (const key in converted) {
            converted[key] = convertTimestampsToDates(converted[key]);
        }
        return converted;
    }
    return data;
};

const convertDatesToTimestamps = (data: any): any => {
    if (!data) return data;
    if (Array.isArray(data)) return data.map(item => convertDatesToTimestamps(item));
    if (data instanceof Date) return Timestamp.fromDate(data);
    if (typeof data === 'object' && data !== null) {
        const converted = { ...data };
        for (const key in converted) {
            converted[key] = convertDatesToTimestamps(converted[key]);
        }
        return converted;
    }
    return data;
};

const removeUndefined = (obj: any): any => {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) {
        return obj.map(item => removeUndefined(item)).filter(item => item !== undefined);
    }
    const newObj: any = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const value = obj[key];
            if (value !== undefined) {
                newObj[key] = removeUndefined(value);
            }
        }
    }
    return newObj;
};

const firestoreReducer = (state: FirestoreState, action: FirestoreAction): FirestoreState => {
    switch (action.type) {
        case 'SET_LOADING_STATUS':
            return { ...state, loading: { ...state.loading, [action.payload.collection]: action.payload.status } };
        case 'SET_DATA':
            return { ...state, [action.payload.collection]: action.payload.data };
        case 'SET_ERROR':
            return { ...state, error: action.payload };
        case 'SET_LAST_SYNC':
            return { ...state, lastSync: action.payload };
        
        // ============================================
        // ANIMALS
        // ============================================
        case 'LOCAL_ADD_ANIMAL':
            return { ...state, animals: [...state.animals, action.payload] };
        case 'LOCAL_UPDATE_ANIMAL':
            return {
                ...state,
                animals: state.animals.map(animal =>
                    animal.id === action.payload.animalId
                        ? { ...animal, ...action.payload.updatedData }
                        : animal
                ),
            };
        case 'LOCAL_DELETE_ANIMAL':
            return { ...state, animals: state.animals.filter(animal => animal.id !== action.payload.animalId) };
        
        // ============================================
        // CALENDAR EVENTS - ATUALIZAÇÃO OTIMISTA
        // ============================================
        case 'LOCAL_ADD_CALENDAR_EVENT':
            return { 
                ...state, 
                calendarEvents: [...state.calendarEvents, action.payload] 
            };
        case 'LOCAL_UPDATE_CALENDAR_EVENT':
            return {
                ...state,
                calendarEvents: state.calendarEvents.map(event =>
                    event.id === action.payload.id ? action.payload : event
                ),
            };
        case 'LOCAL_DELETE_CALENDAR_EVENT':
            return { 
                ...state, 
                calendarEvents: state.calendarEvents.filter(event => event.id !== action.payload.eventId) 
            };
        
        // ============================================
        // TASKS - ATUALIZAÇÃO OTIMISTA
        // ============================================
        case 'LOCAL_ADD_TASK':
            return { 
                ...state, 
                tasks: [...state.tasks, action.payload] 
            };
        case 'LOCAL_UPDATE_TASK':
            return {
                ...state,
                tasks: state.tasks.map(task =>
                    task.id === action.payload.taskId
                        ? { ...task, ...action.payload.updatedData }
                        : task
                ),
            };
        case 'LOCAL_DELETE_TASK':
            return { 
                ...state, 
                tasks: state.tasks.filter(task => task.id !== action.payload.taskId) 
            };
        
        // ============================================
        // MANAGEMENT AREAS - ATUALIZAÇÃO OTIMISTA
        // ============================================
        case 'LOCAL_ADD_AREA':
            return { 
                ...state, 
                managementAreas: [...state.managementAreas, action.payload] 
            };
        case 'LOCAL_UPDATE_AREA':
            return {
                ...state,
                managementAreas: state.managementAreas.map(area =>
                    area.id === action.payload.id ? action.payload : area
                ),
            };
        case 'LOCAL_DELETE_AREA':
            return { 
                ...state, 
                managementAreas: state.managementAreas.filter(area => area.id !== action.payload.areaId) 
            };
        
        default:
            return state;
    }
};

// ============================================
// HOOK PRINCIPAL
// ============================================

export const useFirestoreOptimized = (user: AppUser | null) => {
    const [state, dispatch] = useReducer(firestoreReducer, initialState);
    const userId = user?.uid;
    const syncInProgressRef = useRef(false);

    // ============================================
    // FUNÇÃO: Carregar dados com cache
    // ============================================
    const loadWithCache = useCallback(async <T extends { id: string }>(
        collectionName: string,
        firestorePath: string,
        loadingKey: keyof FirestoreState['loading'],
        processEntity?: (entity: any) => T
    ): Promise<T[]> => {
        if (!userId || !db) return [];

        const cacheKey = `${userId}_${collectionName}`;
        
        // Função para buscar do Firestore
        const fetchFromFirestore = async (): Promise<T[]> => {
            console.log(`🔥 [FIRESTORE] Buscando ${collectionName}...`);
            const snapshot = await db.collection(firestorePath)
                .where("userId", "==", userId)
                .get();

            return snapshot.docs.map((doc: any) => {
                const docData = convertTimestampsToDates(doc.data());
                let entity = { id: doc.id, ...docData } as T;
                if (processEntity) entity = processEntity(entity);
                return entity;
            });
        };
        
        // 1. Tenta carregar do cache primeiro
        const cached = await localCache.get<T>(cacheKey);
        
        if (cached) {
            // STALE-WHILE-REVALIDATE: Retorna cache imediatamente
            console.log(`📦 [CACHE ${localCache.isFresh(cached.timestamp) ? 'HIT' : 'STALE'}] ${collectionName}`);
            dispatch({ type: 'SET_DATA', payload: { collection: collectionName as any, data: cached.data } });
            dispatch({ type: 'SET_LOADING_STATUS', payload: { collection: loadingKey, status: false } });
            
            // Se expirou, revalida em background (sem bloquear UI)
            if (!localCache.isFresh(cached.timestamp)) {
                fetchFromFirestore().then(async (data) => {
                    await localCache.set(cacheKey, data);
                    dispatch({ type: 'SET_DATA', payload: { collection: collectionName as any, data } });
                    console.log(`🔄 [REVALIDATED] ${collectionName}`);
                }).catch(err => console.error(`Erro ao revalidar ${collectionName}:`, err));
            }
            return cached.data;
        }

        // 2. Sem cache - busca do Firestore
        try {
            const data = await fetchFromFirestore();
            await localCache.set(cacheKey, data);
            
            dispatch({ type: 'SET_DATA', payload: { collection: collectionName as any, data } });
            dispatch({ type: 'SET_LOADING_STATUS', payload: { collection: loadingKey, status: false } });
            
            return data;
        } catch (error) {
            console.error(`Erro ao buscar ${collectionName}:`, error);
            dispatch({ type: 'SET_ERROR', payload: `Falha ao buscar ${collectionName}` });
            dispatch({ type: 'SET_LOADING_STATUS', payload: { collection: loadingKey, status: false } });
            return [];
        }
    }, [userId]);

    // ============================================
    // FUNÇÃO: Processar entidade Animal
    // ============================================
    const processAnimalEntity = (entity: any): Animal => {
        let finalFotos: string[] = [];
        const rawFotos = entity.fotos;
        
        if (typeof rawFotos === 'string' && rawFotos.trim()) {
            finalFotos = [rawFotos];
        } else if (Array.isArray(rawFotos)) {
            finalFotos = rawFotos
                .map(item => typeof item === 'string' ? item : item?.url)
                .filter((url): url is string => !!url && url.trim() !== '');
        }
        
        if (finalFotos.length === 0) {
            finalFotos = ['https://storage.googleapis.com/aistudio-marketplace/gallery/cattle_management/cow_placeholder.png'];
        }

        return {
            ...entity,
            fotos: finalFotos,
            historicoSanitario: entity.historicoSanitario || [],
            historicoPesagens: entity.historicoPesagens || [],
            historicoPrenhez: entity.historicoPrenhez || [],
            historicoAborto: entity.historicoAborto || [],
            historicoProgenie: entity.historicoProgenie || [],
        };
    };

    // ============================================
    // FUNÇÃO: Atualizar cache local
    // ============================================
    const updateLocalCache = useCallback(async (collectionName: string, data: any[]) => {
        if (!userId) return;
        const cacheKey = `${userId}_${collectionName}`;
        await localCache.set(cacheKey, data);
    }, [userId]);

    // ============================================
    // EFEITO: Carregamento inicial
    // ============================================
    useEffect(() => {
        if (!userId || !db) {
            Object.keys(initialState.loading).forEach(key => {
                dispatch({ type: 'SET_LOADING_STATUS', payload: { collection: key as any, status: false } });
            });
            return;
        }

        const loadAllData = async () => {
            if (syncInProgressRef.current) return;
            syncInProgressRef.current = true;

            try {
                await Promise.all([
                    loadWithCache<Animal>('animals', 'animals', 'animals', processAnimalEntity),
                    loadWithCache<CalendarEvent>('calendarEvents', 'calendar', 'calendar'),
                    loadWithCache<Task>('tasks', 'tasks', 'tasks'),
                    loadWithCache<ManagementArea>('managementAreas', 'areas', 'areas'),
                ]);

                dispatch({ type: 'SET_LAST_SYNC', payload: Date.now() });
            } finally {
                syncInProgressRef.current = false;
            }
        };

        loadAllData();
    }, [userId, loadWithCache]);

    // ============================================
    // FUNÇÃO: Forçar sincronização manual
    // ============================================
    const forceSync = useCallback(async () => {
        if (!userId || syncInProgressRef.current) return;
        
        await localCache.clear();
        
        Object.keys(initialState.loading).forEach(key => {
            dispatch({ type: 'SET_LOADING_STATUS', payload: { collection: key as any, status: true } });
        });

        await Promise.all([
            loadWithCache<Animal>('animals', 'animals', 'animals', processAnimalEntity),
            loadWithCache<CalendarEvent>('calendarEvents', 'calendar', 'calendar'),
            loadWithCache<Task>('tasks', 'tasks', 'tasks'),
            loadWithCache<ManagementArea>('managementAreas', 'areas', 'areas'),
        ]);

        dispatch({ type: 'SET_LAST_SYNC', payload: Date.now() });
    }, [userId, loadWithCache]);

    // ============================================
    // ANIMALS
    // ============================================
    const addAnimal = useCallback(async (animalData: Omit<Animal, 'id' | 'fotos' | 'historicoSanitario' | 'historicoPesagens'>) => {
        if (!userId || !db) return;
        
        try {
            const batch = db.batch();
            const newAnimalRef = db.collection('animals').doc();
            
            const initialWeightHistory = animalData.pesoKg > 0 
                ? [{ id: `initial-${newAnimalRef.id}`, date: animalData.dataNascimento, weightKg: animalData.pesoKg, type: WeighingType.None }]
                : [];

            const fullAnimalData: Omit<Animal, 'id'> = {
                ...animalData,
                fotos: ['https://storage.googleapis.com/aistudio-marketplace/gallery/cattle_management/cow_placeholder.png'],
                historicoSanitario: [],
                historicoPesagens: initialWeightHistory,
                historicoPrenhez: [],
                historicoAborto: [],
                historicoProgenie: [],
            };

                // remove qualquer campo undefined, incluindo dataNascimento se vier vazio
                const sanitizedAnimalData = removeUndefined(fullAnimalData);

                // só depois converte datas em Timestamps
                const dataWithTimestamp = convertDatesToTimestamps(sanitizedAnimalData);

                batch.set(newAnimalRef, { ...dataWithTimestamp, userId });

            if (animalData.maeNome) {
                const motherBrinco = animalData.maeNome.toLowerCase().trim();
                const motherQuery = await db.collection('animals')
                    .where('userId', '==', userId)
                    .where('brinco', '==', motherBrinco)
                    .where('sexo', '==', Sexo.Femea)
                    .limit(1).get();
                
                if (!motherQuery.empty) {
                    const motherRef = motherQuery.docs[0].ref;
                    const newOffspringRecord: any = {
                        id: `prog_${newAnimalRef.id}`,
                        offspringBrinco: animalData.brinco,
                    };
                    if (animalData.pesoKg > 0) {
                        newOffspringRecord.birthWeightKg = animalData.pesoKg;
                    }
                    batch.update(motherRef, {
                        historicoProgenie: FieldValue.arrayUnion(newOffspringRecord)
                    });
                }
            }

            // Atualização otimista ANTES do commit
            const newAnimal: Animal = {
                id: newAnimalRef.id,
                ...fullAnimalData
            };
            dispatch({ type: 'LOCAL_ADD_ANIMAL', payload: newAnimal });

            await batch.commit();
            
            // Atualiza cache
            await updateLocalCache('animals', [...state.animals, newAnimal]);
            
        } catch (error) {
            console.error("Erro ao adicionar animal:", error);
            // Em caso de erro, força sync para reverter
            await forceSync();
            throw error;
        }
    }, [userId, state.animals, updateLocalCache, forceSync]);

    const updateAnimal = useCallback(async (animalId: string, updatedData: Partial<Omit<Animal, 'id'>>) => {
        if (!userId || !db) return;
        
        // Atualização otimista
        dispatch({ type: 'LOCAL_UPDATE_ANIMAL', payload: { animalId, updatedData } });
        
        try {
            const batch = db.batch();
            const animalRef = db.collection('animals').doc(animalId);
            const sanitizedData = removeUndefined(updatedData);
            const dataWithTimestamp = convertDatesToTimestamps(sanitizedData);
            
            batch.update(animalRef, dataWithTimestamp);
            
            // ============================================
            // 🔧 PROPAGAR PESOS ESPECIAIS PARA PROGÊNIE DA MÃE
            // ============================================
            if (updatedData.historicoPesagens) {
                const animal = state.animals.find(a => a.id === animalId);
                if (animal?.maeNome) {
                    // Busca a mãe pelo brinco
                    const maeBrinco = animal.maeNome.toLowerCase().trim();
                    const mae = state.animals.find(a => 
                        a.brinco.toLowerCase().trim() === maeBrinco && 
                        a.sexo === Sexo.Femea
                    );
                    
                    if (mae) {
                        // Procura por pesos especiais (Nascimento, Desmame, Sobreano)
                        const pesagens = updatedData.historicoPesagens;
                        
                        let birthWeight: number | undefined;
                        let weaningWeight: number | undefined;
                        let yearlingWeight: number | undefined;
                        
                        pesagens.forEach(p => {
                            if (p.type === WeighingType.Birth) {
                                birthWeight = p.weightKg;
                            } else if (p.type === WeighingType.Weaning) {
                                weaningWeight = p.weightKg;
                            } else if (p.type === WeighingType.Yearling) {
                                yearlingWeight = p.weightKg;
                            }
                        });
                        
                        // Se tem algum peso especial, atualiza a progênie da mãe
                        if (birthWeight !== undefined || weaningWeight !== undefined || yearlingWeight !== undefined) {
                            const maeProgenie = mae.historicoProgenie || [];
                            const existingRecord = maeProgenie.find(r => r.offspringBrinco.toLowerCase() === animal.brinco.toLowerCase());
                            
                            let updatedProgenie: typeof maeProgenie;
                            
                            if (existingRecord) {
                                // Atualiza registro existente
                                updatedProgenie = maeProgenie.map(r => {
                                    if (r.offspringBrinco.toLowerCase() === animal.brinco.toLowerCase()) {
                                        return {
                                            ...r,
                                            birthWeightKg: birthWeight ?? r.birthWeightKg,
                                            weaningWeightKg: weaningWeight ?? r.weaningWeightKg,
                                            yearlingWeightKg: yearlingWeight ?? r.yearlingWeightKg,
                                        };
                                    }
                                    return r;
                                });
                            } else {
                                // Cria novo registro
                                const newRecord = {
                                    id: `prog_${animalId}`,
                                    offspringBrinco: animal.brinco,
                                    birthWeightKg: birthWeight,
                                    weaningWeightKg: weaningWeight,
                                    yearlingWeightKg: yearlingWeight,
                                };
                                updatedProgenie = [...maeProgenie, newRecord];
                            }
                            
                            // Atualiza a mãe no batch
                            const maeRef = db.collection('animals').doc(mae.id);
                            const cleanedProgenie = removeUndefined(updatedProgenie);
                            batch.update(maeRef, { historicoProgenie: cleanedProgenie });
                            
                            // Atualização otimista da mãe
                            dispatch({ 
                                type: 'LOCAL_UPDATE_ANIMAL', 
                                payload: { 
                                    animalId: mae.id, 
                                    updatedData: { historicoProgenie: updatedProgenie } 
                                } 
                            });
                        }
                    }
                }
            }
            
            await batch.commit();
            
            // Atualiza cache
            const updatedAnimals = state.animals.map(a => 
                a.id === animalId ? { ...a, ...updatedData } : a
            );
            await updateLocalCache('animals', updatedAnimals);
        } catch (error) {
            console.error("Erro ao atualizar animal:", error);
            await forceSync();
            throw error;
        }
    }, [userId, state.animals, updateLocalCache, forceSync]);

    const deleteAnimal = useCallback(async (animalId: string): Promise<void> => {
        if (!userId || !db) throw new Error("Não autenticado");
        
        // Atualização otimista
        dispatch({ type: 'LOCAL_DELETE_ANIMAL', payload: { animalId } });
        
        try {
            await db.collection('animals').doc(animalId).delete();
            
            // Atualiza cache
            const updatedAnimals = state.animals.filter(a => a.id !== animalId);
            await updateLocalCache('animals', updatedAnimals);
        } catch (error) {
            console.error("Erro ao deletar animal:", error);
            await forceSync();
            throw error;
        }
    }, [userId, state.animals, updateLocalCache, forceSync]);

    // ============================================
    // CALENDAR EVENTS - COM ATUALIZAÇÃO OTIMISTA
    // ============================================
    const addOrUpdateCalendarEvent = useCallback(async (event: Omit<CalendarEvent, 'id'> & { id?: string }) => {
        if (!userId || !db) return;
        
        const { id, ...eventData } = event;
        // Remove campos undefined (Firebase não aceita undefined)
        const cleanedEventData = removeUndefined(eventData);
        const dataWithTimestamp = convertDatesToTimestamps(cleanedEventData);
        
        try {
            if (id) {
                // ATUALIZAÇÃO
                const updatedEvent: CalendarEvent = { id, ...eventData } as CalendarEvent;
                
                // Atualização otimista IMEDIATA
                dispatch({ type: 'LOCAL_UPDATE_CALENDAR_EVENT', payload: updatedEvent });
                
                await db.collection('calendar').doc(id).update(dataWithTimestamp);
                
                // Atualiza cache
                const updatedEvents = state.calendarEvents.map(e => e.id === id ? updatedEvent : e);
                await updateLocalCache('calendarEvents', updatedEvents);
            } else {
                // CRIAÇÃO
                const newDocRef = await db.collection('calendar').add({ ...dataWithTimestamp, userId });
                const newEvent: CalendarEvent = { 
                    id: newDocRef.id, 
                    ...eventData 
                } as CalendarEvent;
                
                // Atualização otimista IMEDIATA
                dispatch({ type: 'LOCAL_ADD_CALENDAR_EVENT', payload: newEvent });
                
                // Atualiza cache
                await updateLocalCache('calendarEvents', [...state.calendarEvents, newEvent]);
            }
        } catch (error) {
            console.error("Erro ao salvar evento:", error);
            await forceSync();
            throw error;
        }
    }, [userId, state.calendarEvents, updateLocalCache, forceSync]);

    const deleteCalendarEvent = useCallback(async (eventId: string) => {
        if (!userId || !db) return;
        
        // Atualização otimista IMEDIATA
        dispatch({ type: 'LOCAL_DELETE_CALENDAR_EVENT', payload: { eventId } });
        
        try {
            await db.collection('calendar').doc(eventId).delete();
            
            // Atualiza cache
            const updatedEvents = state.calendarEvents.filter(e => e.id !== eventId);
            await updateLocalCache('calendarEvents', updatedEvents);
        } catch (error) {
            console.error("Erro ao deletar evento:", error);
            await forceSync();
            throw error;
        }
    }, [userId, state.calendarEvents, updateLocalCache, forceSync]);

    // ============================================
    // TASKS - COM ATUALIZAÇÃO OTIMISTA
    // ============================================
    const addTask = useCallback(async (task: Omit<Task, 'id' | 'isCompleted'>) => {
        if (!userId || !db) return;
        
        // Remove campos undefined (Firebase não aceita undefined)
        const cleanedTask = removeUndefined({ ...task, isCompleted: false, userId });
        const dataWithTimestamp = convertDatesToTimestamps(cleanedTask);
        
        try {
            const newDocRef = await db.collection('tasks').add(dataWithTimestamp);
            const newTask: Task = { 
                id: newDocRef.id, 
                ...task, 
                isCompleted: false 
            };
            
            // Atualização otimista IMEDIATA
            dispatch({ type: 'LOCAL_ADD_TASK', payload: newTask });
            
            // Atualiza cache
            await updateLocalCache('tasks', [...state.tasks, newTask]);
        } catch (error) {
            console.error("Erro ao adicionar tarefa:", error);
            await forceSync();
            throw error;
        }
    }, [userId, state.tasks, updateLocalCache, forceSync]);

    const toggleTaskCompletion = useCallback(async (task: Task) => {
        if (!userId || !db) return;
        
        const newCompletedStatus = !task.isCompleted;
        
        // Atualização otimista IMEDIATA
        dispatch({ 
            type: 'LOCAL_UPDATE_TASK', 
            payload: { taskId: task.id, updatedData: { isCompleted: newCompletedStatus } } 
        });
        
        try {
            await db.collection('tasks').doc(task.id).update({ isCompleted: newCompletedStatus });
            
            // Atualiza cache
            const updatedTasks = state.tasks.map(t => 
                t.id === task.id ? { ...t, isCompleted: newCompletedStatus } : t
            );
            await updateLocalCache('tasks', updatedTasks);
        } catch (error) {
            console.error("Erro ao atualizar tarefa:", error);
            await forceSync();
            throw error;
        }
    }, [userId, state.tasks, updateLocalCache, forceSync]);

    const deleteTask = useCallback(async (taskId: string) => {
        if (!userId || !db) return;
        
        // Atualização otimista IMEDIATA
        dispatch({ type: 'LOCAL_DELETE_TASK', payload: { taskId } });
        
        try {
            await db.collection('tasks').doc(taskId).delete();
            
            // Atualiza cache
            const updatedTasks = state.tasks.filter(t => t.id !== taskId);
            await updateLocalCache('tasks', updatedTasks);
        } catch (error) {
            console.error("Erro ao deletar tarefa:", error);
            await forceSync();
            throw error;
        }
    }, [userId, state.tasks, updateLocalCache, forceSync]);

    // ============================================
    // MANAGEMENT AREAS - COM ATUALIZAÇÃO OTIMISTA
    // ============================================
    const addOrUpdateManagementArea = useCallback(async (area: Omit<ManagementArea, 'id'> & { id?: string }) => {
        if (!userId || !db) return;
        
        const { id, ...areaData } = area;
        // Remove campos undefined (Firebase não aceita undefined)
        const cleanedAreaData = removeUndefined(areaData);
        
        try {
            if (id) {
                // ATUALIZAÇÃO
                const updatedArea: ManagementArea = { id, ...areaData } as ManagementArea;
                
                // Atualização otimista IMEDIATA
                dispatch({ type: 'LOCAL_UPDATE_AREA', payload: updatedArea });
                
                await db.collection('areas').doc(id).update(cleanedAreaData);
                
                // Atualiza cache
                const updatedAreas = state.managementAreas.map(a => a.id === id ? updatedArea : a);
                await updateLocalCache('managementAreas', updatedAreas);
            } else {
                // CRIAÇÃO
                const newDocRef = await db.collection('areas').add({ ...cleanedAreaData, userId });
                const newArea: ManagementArea = { 
                    id: newDocRef.id, 
                    ...areaData 
                } as ManagementArea;
                
                // Atualização otimista IMEDIATA
                dispatch({ type: 'LOCAL_ADD_AREA', payload: newArea });
                
                // Atualiza cache
                await updateLocalCache('managementAreas', [...state.managementAreas, newArea]);
            }
        } catch (error) {
            console.error("Erro ao salvar área:", error);
            await forceSync();
            throw error;
        }
    }, [userId, state.managementAreas, updateLocalCache, forceSync]);

    const deleteManagementArea = useCallback(async (areaId: string) => {
        if (!userId || !db) return;
        
        // Atualização otimista IMEDIATA
        dispatch({ type: 'LOCAL_DELETE_AREA', payload: { areaId } });
        
        // Também atualiza os animais que estavam nessa área
        const animalsInArea = state.animals.filter(a => a.managementAreaId === areaId);
        animalsInArea.forEach(animal => {
            dispatch({ 
                type: 'LOCAL_UPDATE_ANIMAL', 
                payload: { animalId: animal.id, updatedData: { managementAreaId: undefined } } 
            });
        });
        
        try {
            const batch = db.batch();
            
            // Remove área dos animais
            const animalsInAreaQuery = db.collection('animals')
                .where('userId', '==', userId)
                .where('managementAreaId', '==', areaId);
            const snapshot = await animalsInAreaQuery.get();
            snapshot.docs.forEach(doc => {
                batch.update(doc.ref, { managementAreaId: FieldValue.delete() });
            });
            
            // Deleta a área
            batch.delete(db.collection('areas').doc(areaId));
            
            await batch.commit();
            
            // Atualiza caches
            const updatedAreas = state.managementAreas.filter(a => a.id !== areaId);
            await updateLocalCache('managementAreas', updatedAreas);
            
            const updatedAnimals = state.animals.map(a => 
                a.managementAreaId === areaId ? { ...a, managementAreaId: undefined } : a
            );
            await updateLocalCache('animals', updatedAnimals);
        } catch (error) {
            console.error("Erro ao deletar área:", error);
            await forceSync();
            throw error;
        }
    }, [userId, state.animals, state.managementAreas, updateLocalCache, forceSync]);

    const assignAnimalsToArea = useCallback(async (areaId: string, animalIdsToAssign: string[]) => {
        if (!userId || !db) return;
        
        const toAssignSet = new Set(animalIdsToAssign);
        
        // Atualização otimista IMEDIATA
        state.animals.forEach(animal => {
            const wasInArea = animal.managementAreaId === areaId;
            const shouldBeInArea = toAssignSet.has(animal.id);
            
            if (wasInArea && !shouldBeInArea) {
                // Remover da área
                dispatch({ 
                    type: 'LOCAL_UPDATE_ANIMAL', 
                    payload: { animalId: animal.id, updatedData: { managementAreaId: undefined } } 
                });
            } else if (!wasInArea && shouldBeInArea) {
                // Adicionar à área
                dispatch({ 
                    type: 'LOCAL_UPDATE_ANIMAL', 
                    payload: { animalId: animal.id, updatedData: { managementAreaId: areaId } } 
                });
            }
        });
        
        try {
            const batch = db.batch();
            
            const animalsInAreaQuery = db.collection('animals')
                .where('userId', '==', userId)
                .where('managementAreaId', '==', areaId);
            const currentAnimalsSnapshot = await animalsInAreaQuery.get();
            const currentlyInAreaSet = new Set<string>(currentAnimalsSnapshot.docs.map(doc => doc.id));

            for (const animalId of toAssignSet) {
                if (!currentlyInAreaSet.has(animalId)) {
                    batch.update(db.collection('animals').doc(animalId), { managementAreaId: areaId });
                }
            }

            for (const animalId of currentlyInAreaSet) {
                if (!toAssignSet.has(animalId)) {
                    batch.update(db.collection('animals').doc(animalId), { managementAreaId: FieldValue.delete() });
                }
            }
            
            await batch.commit();
            
            // Atualiza cache de animais
            const updatedAnimals = state.animals.map(animal => {
                if (toAssignSet.has(animal.id)) {
                    return { ...animal, managementAreaId: areaId };
                } else if (animal.managementAreaId === areaId) {
                    return { ...animal, managementAreaId: undefined };
                }
                return animal;
            });
            await updateLocalCache('animals', updatedAnimals);
        } catch (error) {
            console.error("Erro ao atribuir animais:", error);
            await forceSync();
            throw error;
        }
    }, [userId, state.animals, updateLocalCache, forceSync]);

    return {
        state,
        db,
        forceSync,
        addAnimal,
        updateAnimal,
        deleteAnimal,
        addOrUpdateCalendarEvent,
        deleteCalendarEvent,
        addTask,
        toggleTaskCompletion,
        deleteTask,
        addOrUpdateManagementArea,
        deleteManagementArea,
        assignAnimalsToArea
    };
};
