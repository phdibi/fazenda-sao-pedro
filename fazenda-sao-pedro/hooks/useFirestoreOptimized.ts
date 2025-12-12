import { useState, useEffect, useCallback, useReducer, useRef } from 'react';
import { db, Timestamp, FieldValue } from '../services/firebase';
import { localCache } from '../services/localCache';
import { Animal, FirestoreCollectionName, ManagementBatch, UserRole, WeighingType, AnimalStatus, Sexo, CalendarEvent, AppUser, ManagementArea, MedicationAdministration, PregnancyRecord, PregnancyType, AbortionRecord, Task, LoadingKey, LocalStateCollectionName } from '../types';
import { QUERY_LIMITS, ARCHIVED_COLLECTION_NAME } from '../constants/app';
import { convertTimestampsToDates, convertDatesToTimestamps } from '../utils/dateHelpers';
import { removeUndefined } from '../utils/objectHelpers';

// ============================================
// STATE MANAGEMENT
// ============================================

interface FirestoreState {
    animals: Animal[];
    calendarEvents: CalendarEvent[];
    tasks: Task[];
    managementAreas: ManagementArea[];
    batches: ManagementBatch[];
    loading: {
        animals: boolean;
        calendar: boolean;
        tasks: boolean;
        areas: boolean;
        batches: boolean;
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
    // Calendar Events
    | { type: 'LOCAL_ADD_CALENDAR_EVENT'; payload: CalendarEvent }
    | { type: 'LOCAL_UPDATE_CALENDAR_EVENT'; payload: CalendarEvent }
    | { type: 'LOCAL_DELETE_CALENDAR_EVENT'; payload: { eventId: string } }
    // Tasks
    | { type: 'LOCAL_ADD_TASK'; payload: Task }
    | { type: 'LOCAL_UPDATE_TASK'; payload: { taskId: string; updatedData: Partial<Task> } }
    | { type: 'LOCAL_DELETE_TASK'; payload: { taskId: string } }
    // Management Areas
    | { type: 'LOCAL_ADD_AREA'; payload: ManagementArea }
    | { type: 'LOCAL_UPDATE_AREA'; payload: ManagementArea }
    | { type: 'LOCAL_DELETE_AREA'; payload: { areaId: string } }
    // Batches
    | { type: 'LOCAL_ADD_BATCH'; payload: ManagementBatch }
    | { type: 'LOCAL_UPDATE_BATCH'; payload: { batchId: string; updatedData: Partial<ManagementBatch> } }
    | { type: 'LOCAL_DELETE_BATCH'; payload: { batchId: string } };

const initialState: FirestoreState = {
    animals: [],
    calendarEvents: [],
    tasks: [],
    managementAreas: [],
    batches: [],
    loading: { animals: true, calendar: true, tasks: true, areas: true, batches: true },
    error: null,
    lastSync: null
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

        // ============================================
        // BATCHES - ATUALIZAÇÃO OTIMISTA
        // ============================================
        case 'LOCAL_ADD_BATCH':
            return {
                ...state,
                batches: [...state.batches, action.payload]
            };
        case 'LOCAL_UPDATE_BATCH':
            return {
                ...state,
                batches: state.batches.map(batch =>
                    batch.id === action.payload.batchId
                        ? { ...batch, ...action.payload.updatedData }
                        : batch
                ),
            };
        case 'LOCAL_DELETE_BATCH':
            return {
                ...state,
                batches: state.batches.filter(batch => batch.id !== action.payload.batchId)
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
    const lastSyncTimeRef = useRef<number>(0);
    
    // 🔧 OTIMIZAÇÃO: Ref para acessar estado atual sem causar re-renders nos callbacks
    // Isso evita que callbacks sejam recriados quando o estado muda
    const stateRef = useRef(state);
    useEffect(() => {
        stateRef.current = state;
    }, [state]);

    // ============================================
    // FUNÇÃO: Carregar dados com cache
    // ============================================
    const loadWithCache = useCallback(async <T extends { id: string }>(
        collectionName: string,
        firestorePath: string,
        loadingKey: keyof FirestoreState['loading'],
        processEntity?: (entity: any) => T,
        limit?: number
    ): Promise<T[]> => {
        if (!userId || !db) return [];

        const cacheKey = `${userId}_${collectionName}`;

        // Função para buscar do Firestore
        const fetchFromFirestore = async (): Promise<T[]> => {
            console.log(`🔥 [FIRESTORE] Buscando ${collectionName}...`);
            let query: any = db.collection(firestorePath).where("userId", "==", userId);

            if (limit) {
                query = query.limit(limit);
            }

            const snapshot = await query.get();

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
                    loadWithCache<Animal>('animals', 'animals', 'animals', processAnimalEntity, QUERY_LIMITS.INITIAL_LOAD),
                    loadWithCache<CalendarEvent>('calendarEvents', 'calendar', 'calendar', undefined, QUERY_LIMITS.INITIAL_LOAD),
                    loadWithCache<Task>('tasks', 'tasks', 'tasks', undefined, QUERY_LIMITS.INITIAL_LOAD),
                    loadWithCache<ManagementArea>('managementAreas', 'areas', 'areas'),
                    loadWithCache<ManagementBatch>('batches', 'batches', 'batches'),
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
        const now = Date.now();
        // 5s throttle para evitar chamadas excessivas
        if (!userId || syncInProgressRef.current || (now - lastSyncTimeRef.current < 5000)) {
            if (now - lastSyncTimeRef.current < 5000) console.log("⏳ Sync ignorado (throttled)");
            return;
        }

        lastSyncTimeRef.current = now;

        await localCache.clear();

        Object.keys(initialState.loading).forEach(key => {
            dispatch({ type: 'SET_LOADING_STATUS', payload: { collection: key as any, status: true } });
        });

        await Promise.all([
            loadWithCache<Animal>('animals', 'animals', 'animals', processAnimalEntity),
            loadWithCache<CalendarEvent>('calendarEvents', 'calendar', 'calendar'),
            loadWithCache<Task>('tasks', 'tasks', 'tasks'),
            loadWithCache<ManagementArea>('managementAreas', 'areas', 'areas'),
            loadWithCache<ManagementBatch>('batches', 'batches', 'batches'),
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
                ? [{ id: `initial-${newAnimalRef.id}`, date: animalData.dataNascimento || new Date(), weightKg: animalData.pesoKg, type: WeighingType.None }]
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

                // 🔧 OTIMIZAÇÃO: Usa stateRef para evitar dependência de state.animals
                const currentAnimals = stateRef.current.animals;
                const motherLocal = currentAnimals.find(a =>
                    a.brinco.toLowerCase().trim() === motherBrinco &&
                    a.sexo === Sexo.Femea
                );

                if (motherLocal) {
                    const motherRef = db.collection('animals').doc(motherLocal.id);
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

                    // Atualização otimista da mãe também!
                    const updatedMotherProgenie = [...(motherLocal.historicoProgenie || []), newOffspringRecord];
                    dispatch({
                        type: 'LOCAL_UPDATE_ANIMAL',
                        payload: {
                            animalId: motherLocal.id,
                            updatedData: { historicoProgenie: updatedMotherProgenie }
                        }
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

            // Atualiza cache usando stateRef
            await updateLocalCache('animals', [...stateRef.current.animals, newAnimal]);

        } catch (error) {
            console.error("Erro ao adicionar animal:", error);
            // Em caso de erro, força sync para reverter
            await forceSync();
            throw error;
        }
    }, [userId, updateLocalCache, forceSync]);

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
                // 🔧 OTIMIZAÇÃO: Usa stateRef para evitar dependência de state.animals
                const currentAnimals = stateRef.current.animals;
                const animal = currentAnimals.find((a: Animal) => a.id === animalId);
                if (animal?.maeNome) {
                    // Busca a mãe pelo brinco
                    const maeBrinco = animal.maeNome.toLowerCase().trim();
                    const mae = currentAnimals.find((a: Animal) =>
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
                            const maeProgenie: any[] = mae.historicoProgenie || [];
                            const existingRecord = maeProgenie.find((r: any) => r.offspringBrinco.toLowerCase() === animal.brinco.toLowerCase());

                            let updatedProgenie: typeof maeProgenie;

                            if (existingRecord) {
                                // Atualiza registro existente
                                updatedProgenie = maeProgenie.map((r: { offspringBrinco: string; birthWeightKg?: number; weaningWeightKg?: number; yearlingWeightKg?: number; }) => {
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

            // 🔧 OTIMIZAÇÃO: Usa stateRef para cache
            const updatedAnimals = stateRef.current.animals.map((a: Animal) =>
                a.id === animalId ? { ...a, ...updatedData } : a
            );
            await updateLocalCache('animals', updatedAnimals);
        } catch (error) {
            console.error("Erro ao atualizar animal:", error);
            await forceSync();
            throw error;
        }
    }, [userId, updateLocalCache, forceSync]);

    const deleteAnimal = useCallback(async (animalId: string): Promise<void> => {
        if (!userId || !db) throw new Error("Não autenticado");

        // Atualização otimista
        dispatch({ type: 'LOCAL_DELETE_ANIMAL', payload: { animalId } });

        try {
            await db.collection('animals').doc(animalId).delete();

            // 🔧 OTIMIZAÇÃO: Usa stateRef para cache
            const updatedAnimals = stateRef.current.animals.filter((a: Animal) => a.id !== animalId);
            await updateLocalCache('animals', updatedAnimals);
        } catch (error) {
            console.error("Erro ao deletar animal:", error);
            await forceSync();
            throw error;
        }
    }, [userId, updateLocalCache, forceSync]);



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

                // 🔧 OTIMIZAÇÃO: Usa stateRef para cache
                const updatedEvents = stateRef.current.calendarEvents.map((e: CalendarEvent) => e.id === id ? updatedEvent : e);
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

                // 🔧 OTIMIZAÇÃO: Usa stateRef para cache
                await updateLocalCache('calendarEvents', [...stateRef.current.calendarEvents, newEvent]);
            }
        } catch (error) {
            console.error("Erro ao salvar evento:", error);
            await forceSync();
            throw error;
        }
    }, [userId, updateLocalCache, forceSync]);

    const deleteCalendarEvent = useCallback(async (eventId: string) => {
        if (!userId || !db) return;

        // Atualização otimista IMEDIATA
        dispatch({ type: 'LOCAL_DELETE_CALENDAR_EVENT', payload: { eventId } });

        try {
            await db.collection('calendar').doc(eventId).delete();

            // 🔧 OTIMIZAÇÃO: Usa stateRef para cache
            const updatedEvents = stateRef.current.calendarEvents.filter((e: CalendarEvent) => e.id !== eventId);
            await updateLocalCache('calendarEvents', updatedEvents);
        } catch (error) {
            console.error("Erro ao deletar evento:", error);
            await forceSync();
            throw error;
        }
    }, [userId, updateLocalCache, forceSync]);

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

            // 🔧 OTIMIZAÇÃO: Usa stateRef para cache
            await updateLocalCache('tasks', [...stateRef.current.tasks, newTask]);
        } catch (error) {
            console.error("Erro ao adicionar tarefa:", error);
            await forceSync();
            throw error;
        }
    }, [userId, updateLocalCache, forceSync]);

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

            // 🔧 OTIMIZAÇÃO: Usa stateRef para cache
            const updatedTasks = stateRef.current.tasks.map((t: Task) =>
                t.id === task.id ? { ...t, isCompleted: newCompletedStatus } : t
            );
            await updateLocalCache('tasks', updatedTasks);
        } catch (error) {
            console.error("Erro ao atualizar tarefa:", error);
            await forceSync();
            throw error;
        }
    }, [userId, updateLocalCache, forceSync]);

    const deleteTask = useCallback(async (taskId: string) => {
        if (!userId || !db) return;

        // Atualização otimista IMEDIATA
        dispatch({ type: 'LOCAL_DELETE_TASK', payload: { taskId } });

        try {
            await db.collection('tasks').doc(taskId).delete();

            // 🔧 OTIMIZAÇÃO: Usa stateRef para cache
            const updatedTasks = stateRef.current.tasks.filter((t: Task) => t.id !== taskId);
            await updateLocalCache('tasks', updatedTasks);
        } catch (error) {
            console.error("Erro ao deletar tarefa:", error);
            await forceSync();
            throw error;
        }
    }, [userId, updateLocalCache, forceSync]);

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

                // 🔧 OTIMIZAÇÃO: Usa stateRef para cache
                const updatedAreas = stateRef.current.managementAreas.map((a: ManagementArea) => a.id === id ? updatedArea : a);
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

                // 🔧 OTIMIZAÇÃO: Usa stateRef para cache
                await updateLocalCache('managementAreas', [...stateRef.current.managementAreas, newArea]);
            }
        } catch (error) {
            console.error("Erro ao salvar área:", error);
            await forceSync();
            throw error;
        }
    }, [userId, updateLocalCache, forceSync]);

    const deleteManagementArea = useCallback(async (areaId: string) => {
        if (!userId || !db) return;

        // 🔧 OTIMIZAÇÃO: Usa stateRef para evitar dependência
        const currentAnimals = stateRef.current.animals;
        const currentAreas = stateRef.current.managementAreas;

        // Atualização otimista IMEDIATA
        dispatch({ type: 'LOCAL_DELETE_AREA', payload: { areaId } });

        // Também atualiza os animais que estavam nessa área
        const animalsInArea = currentAnimals.filter((a: Animal) => a.managementAreaId === areaId);
        animalsInArea.forEach((animal: Animal) => {
            dispatch({
                type: 'LOCAL_UPDATE_ANIMAL',
                payload: { animalId: animal.id, updatedData: { managementAreaId: undefined } }
            });
        });

        try {
            const batch = db.batch();

            // Remove área dos animais (OTIMIZADO: Usa estado local para achar IDs em vez de query)
            animalsInArea.forEach((animal: Animal) => {
                const ref = db.collection('animals').doc(animal.id);
                batch.update(ref, { managementAreaId: FieldValue.delete() });
            });

            // Deleta a área
            batch.delete(db.collection('areas').doc(areaId));

            await batch.commit();

            // 🔧 OTIMIZAÇÃO: Usa stateRef para caches
            const updatedAreas = currentAreas.filter((a: ManagementArea) => a.id !== areaId);
            await updateLocalCache('managementAreas', updatedAreas);

            const updatedAnimals = currentAnimals.map((a: Animal) =>
                a.managementAreaId === areaId ? { ...a, managementAreaId: undefined } : a
            );
            await updateLocalCache('animals', updatedAnimals);
        } catch (error) {
            console.error("Erro ao deletar área:", error);
            await forceSync();
            throw error;
        }
    }, [userId, updateLocalCache, forceSync]);

    const assignAnimalsToArea = useCallback(async (areaId: string, animalIds: string[]) => {
        if (!userId || !db) return;

        // Atualização otimista
        animalIds.forEach(animalId => {
            dispatch({
                type: 'LOCAL_UPDATE_ANIMAL',
                payload: { animalId, updatedData: { managementAreaId: areaId } }
            });
        });

        try {
            const batch = db.batch();

            animalIds.forEach(animalId => {
                const animalRef = db.collection('animals').doc(animalId);
                batch.update(animalRef, { managementAreaId: areaId });
            });

            await batch.commit();

            // 🔧 OTIMIZAÇÃO: Usa stateRef para cache
            const updatedAnimals = stateRef.current.animals.map((a: Animal) =>
                animalIds.includes(a.id) ? { ...a, managementAreaId: areaId } : a
            );
            await updateLocalCache('animals', updatedAnimals);
        } catch (error) {
            console.error("Erro ao atribuir animais à área:", error);
            await forceSync();
            throw error;
        }
    }, [userId, updateLocalCache, forceSync]);

    // ============================================
    // LOTES (BATCHES) - NOVO E INTEGRADO
    // ============================================
    const createBatch = useCallback(async (batchData: Omit<ManagementBatch, 'id'>) => {
        if (!userId || !db) return;

        const cleanedBatch = removeUndefined({ ...batchData, userId });
        const dataWithTimestamp = convertDatesToTimestamps(cleanedBatch);

        try {
            const newDocRef = await db.collection('batches').add(dataWithTimestamp);
            const newBatch: ManagementBatch = {
                id: newDocRef.id,
                ...batchData
            } as ManagementBatch;

            // Atualização otimista
            dispatch({ type: 'LOCAL_ADD_BATCH', payload: newBatch });

            // 🔧 OTIMIZAÇÃO: Usa stateRef para cache
            await updateLocalCache('batches', [...stateRef.current.batches, newBatch]);

            return newBatch;
        } catch (error) {
            console.error("Erro ao criar lote:", error);
            await forceSync();
            throw error;
        }
    }, [userId, updateLocalCache, forceSync]);

    const updateBatch = useCallback(async (batchId: string, updatedData: Partial<ManagementBatch>) => {
        if (!userId || !db) return;

        // Atualização otimista
        dispatch({ type: 'LOCAL_UPDATE_BATCH', payload: { batchId, updatedData } });

        try {
            const batchRef = db.collection('batches').doc(batchId);
            const cleanedData = removeUndefined(updatedData);
            const dataWithTimestamp = convertDatesToTimestamps(cleanedData);

            await batchRef.update(dataWithTimestamp);

            // 🔧 OTIMIZAÇÃO: Usa stateRef para cache
            const updatedBatches = stateRef.current.batches.map((b: ManagementBatch) =>
                b.id === batchId ? { ...b, ...updatedData } : b
            );
            await updateLocalCache('batches', updatedBatches);
        } catch (error) {
            console.error("Erro ao atualizar lote:", error);
            await forceSync();
            throw error;
        }
    }, [userId, updateLocalCache, forceSync]);

    const deleteBatch = useCallback(async (batchId: string) => {
        if (!userId || !db) return;

        // Atualização otimista
        dispatch({ type: 'LOCAL_DELETE_BATCH', payload: { batchId } });

        try {
            await db.collection('batches').doc(batchId).delete();

            // 🔧 OTIMIZAÇÃO: Usa stateRef para cache
            const updatedBatches = stateRef.current.batches.filter((b: ManagementBatch) => b.id !== batchId);
            await updateLocalCache('batches', updatedBatches);
        } catch (error) {
            console.error("Erro ao deletar lote:", error);
            await forceSync();
            throw error;
        }
    }, [userId, updateLocalCache, forceSync]);

    const completeBatch = useCallback(async (batchId: string) => {
        if (!userId || !db) return;

        const completedData = {
            status: 'completed' as const,
            completedAt: new Date(),
        };

        await updateBatch(batchId, completedData);
    }, [userId, db, updateBatch]);

    return {
        state,
        db,
        forceSync,
        // Animals
        addAnimal,
        updateAnimal,
        deleteAnimal,
        // Calendar
        addOrUpdateCalendarEvent,
        deleteCalendarEvent,
        // Tasks
        addTask,
        toggleTaskCompletion,
        deleteTask,
        // Areas
        addOrUpdateManagementArea,
        deleteManagementArea,
        assignAnimalsToArea,
        // Batches
        createBatch,
        updateBatch,
        deleteBatch,
        completeBatch,
    };
};
