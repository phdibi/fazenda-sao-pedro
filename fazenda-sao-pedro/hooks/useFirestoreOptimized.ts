import { useState, useEffect, useCallback, useReducer, useRef } from 'react';
import { firebaseServices } from '../services/firebase';
import { localCache } from '../services/localCache';
import { trackReads, trackWrites, trackDeletes, isQuotaCritical, canPerformOperation } from '../services/quotaMonitor';
import { Animal, FirestoreCollectionName, ManagementBatch, BatchPurpose, UserRole, WeighingType, AnimalStatus, Sexo, CalendarEvent, AppUser, ManagementArea, MedicationAdministration, WeightEntry, PregnancyRecord, PregnancyType, AbortionRecord, Task, LoadingKey, LocalStateCollectionName, BreedingSeason, CoverageRecord, CoverageType, BullSwitchConfig } from '../types';
import { PREGNANCY_TYPE_MAP, getCoverageSireName } from '../services/breedingSeasonService';
import { QUERY_LIMITS, ARCHIVED_COLLECTION_NAME, AUTO_SYNC_INTERVAL_MS } from '../constants/app';
import { convertTimestampsToDates, convertDatesToTimestamps } from '../utils/dateHelpers';
import { removeUndefined } from '../utils/objectHelpers';
import { migrateHealthHistory, needsMigration } from '../utils/medicationMigration';

// ============================================
// 🔧 CONSTANTES DE TIPO DE COBERTURA
// ============================================
const CoverageTypes = {
    FIV: 'fiv' as CoverageType,
    MontaNatural: 'natural' as CoverageType,
    IA: 'ia' as CoverageType,
    IATF: 'iatf' as CoverageType,
};

// ============================================
// 🔧 OTIMIZAÇÃO: Configuração de Listeners
// ============================================
const REALTIME_CONFIG = {
    enabled: true, // Habilita listeners em tempo real
    collections: ['animals', 'calendar', 'tasks'] as const, // Coleções com listener
};

// ============================================
// STATE MANAGEMENT
// ============================================

interface FirestoreState {
    animals: Animal[];
    calendarEvents: CalendarEvent[];
    tasks: Task[];
    managementAreas: ManagementArea[];
    batches: ManagementBatch[];
    breedingSeasons: BreedingSeason[];
    loading: {
        animals: boolean;
        calendar: boolean;
        tasks: boolean;
        areas: boolean;
        batches: boolean;
        breedingSeasons: boolean;
    };
    error: string | null;
    lastSync: number | null;
    // 🔧 OTIMIZAÇÃO: Controle de listeners em tempo real
    listenersActive: boolean;
    // 🔧 OTIMIZAÇÃO: Paginação com cursor
    pagination: {
        animals: {
            hasMore: boolean;
            lastDoc: any | null;
            isLoadingMore: boolean;
        };
    };
}

type FirestoreAction =
    | { type: 'SET_DATA'; payload: { collection: keyof Omit<FirestoreState, 'loading' | 'error' | 'lastSync' | 'listenersActive' | 'pagination'>; data: any[] } }
    | { type: 'SET_LOADING_STATUS'; payload: { collection: keyof FirestoreState['loading']; status: boolean } }
    | { type: 'SET_ERROR'; payload: string }
    | { type: 'SET_LAST_SYNC'; payload: number }
    | { type: 'SET_LISTENERS_ACTIVE'; payload: boolean }
    // 🔧 OTIMIZAÇÃO: Paginação
    | { type: 'SET_PAGINATION'; payload: { collection: 'animals'; hasMore: boolean; lastDoc: any | null } }
    | { type: 'SET_LOADING_MORE'; payload: { collection: 'animals'; isLoading: boolean } }
    | { type: 'APPEND_DATA'; payload: { collection: 'animals'; data: Animal[] } }
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
    | { type: 'LOCAL_DELETE_BATCH'; payload: { batchId: string } }
    // Breeding Seasons
    | { type: 'LOCAL_ADD_BREEDING_SEASON'; payload: BreedingSeason }
    | { type: 'LOCAL_UPDATE_BREEDING_SEASON'; payload: { seasonId: string; updatedData: Partial<BreedingSeason> } }
    | { type: 'LOCAL_DELETE_BREEDING_SEASON'; payload: { seasonId: string } };

const initialState: FirestoreState = {
    animals: [],
    calendarEvents: [],
    tasks: [],
    managementAreas: [],
    batches: [],
    breedingSeasons: [],
    loading: { animals: true, calendar: true, tasks: true, areas: true, batches: true, breedingSeasons: true },
    error: null,
    lastSync: null,
    listenersActive: false,
    // 🔧 OTIMIZAÇÃO: Estado inicial de paginação
    pagination: {
        animals: {
            hasMore: false,
            lastDoc: null,
            isLoadingMore: false,
        },
    },
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
        case 'SET_LISTENERS_ACTIVE':
            return { ...state, listenersActive: action.payload };

        // ============================================
        // 🔧 OTIMIZAÇÃO: PAGINAÇÃO
        // ============================================
        case 'SET_PAGINATION':
            return {
                ...state,
                pagination: {
                    ...state.pagination,
                    [action.payload.collection]: {
                        ...state.pagination[action.payload.collection],
                        hasMore: action.payload.hasMore,
                        lastDoc: action.payload.lastDoc,
                    },
                },
            };
        case 'SET_LOADING_MORE':
            return {
                ...state,
                pagination: {
                    ...state.pagination,
                    [action.payload.collection]: {
                        ...state.pagination[action.payload.collection],
                        isLoadingMore: action.payload.isLoading,
                    },
                },
            };
        case 'APPEND_DATA':
            return {
                ...state,
                animals: [...state.animals, ...action.payload.data],
            };

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
            // 🔧 FIX: Evita duplicação verificando se já existe
            if (state.tasks.some(t => t.id === action.payload.id)) {
                return state;
            }
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

        // ============================================
        // BREEDING SEASONS - ATUALIZAÇÃO OTIMISTA
        // ============================================
        case 'LOCAL_ADD_BREEDING_SEASON':
            return {
                ...state,
                breedingSeasons: [...state.breedingSeasons, action.payload]
            };
        case 'LOCAL_UPDATE_BREEDING_SEASON':
            return {
                ...state,
                breedingSeasons: state.breedingSeasons.map(season =>
                    season.id === action.payload.seasonId
                        ? { ...season, ...action.payload.updatedData }
                        : season
                ),
            };
        case 'LOCAL_DELETE_BREEDING_SEASON':
            return {
                ...state,
                breedingSeasons: state.breedingSeasons.filter(season => season.id !== action.payload.seasonId)
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

    // Getters dinâmicos para Firebase services
    const db = firebaseServices.db;
    const FieldValue = firebaseServices.FieldValue;

    // 🔧 OTIMIZAÇÃO: Ref para acessar estado atual sem causar re-renders nos callbacks
    // Isso evita que callbacks sejam recriados quando o estado muda
    const stateRef = useRef(state);
    useEffect(() => {
        stateRef.current = state;
    }, [state]);

    // 🔧 OTIMIZAÇÃO: Refs para listeners em tempo real
    const listenersRef = useRef<{ [key: string]: () => void }>({});
    const initialLoadDoneRef = useRef(false);

    // ============================================
    // FUNÇÃO: Carregar dados com cache
    // ============================================
    // 🔧 OTIMIZAÇÃO: Ref para armazenar lastDoc do cursor de paginação
    const lastDocRef = useRef<any>(null);

    const loadWithCache = useCallback(async <T extends { id: string }>(
        collectionName: string,
        firestorePath: string,
        loadingKey: keyof FirestoreState['loading'],
        processEntity?: (entity: any) => T,
        limit?: number
    ): Promise<T[]> => {
        if (!userId || !db) return [];

        const cacheKey = `${userId}_${collectionName}`;

        // 🔧 OTIMIZAÇÃO: Função para buscar do Firestore com suporte a paginação
        const fetchFromFirestore = async (): Promise<{ data: T[]; lastDoc: any | null; hasMore: boolean }> => {
            // 🔧 OTIMIZAÇÃO: Verificar quota antes de buscar
            if (isQuotaCritical()) {
                console.warn('⛔ [QUOTA] Quota crítica! Tentando usar cache local...');
                const cachedData = await localCache.get<T>(cacheKey);
                if (cachedData) {
                    return { data: cachedData.data, lastDoc: null, hasMore: false };
                }
                throw new Error('Quota crítica e sem cache disponível. Tente novamente amanhã.');
            }

            console.log(`🔥 [FIRESTORE] Buscando ${collectionName}...`);
            let query: any = db.collection(firestorePath)
                .where("userId", "==", userId);

            // 🔧 OTIMIZAÇÃO: Apenas animals usa paginação com cursor (tem orderBy)
            const isPaginated = collectionName === 'animals' && limit;
            if (isPaginated) {
                query = query.orderBy('brinco'); // Ordena por brinco para paginação consistente
            }

            if (limit) {
                query = query.limit(isPaginated ? limit + 1 : limit); // +1 só se paginado
            }

            const snapshot = await query.get();

            // 🔧 OTIMIZAÇÃO: Rastrear leituras do Firestore
            trackReads(snapshot.docs.length);

            // Verifica se tem mais páginas (só para coleções paginadas)
            const hasMore = isPaginated ? snapshot.docs.length > limit : false;
            const docsToProcess = hasMore ? snapshot.docs.slice(0, limit) : snapshot.docs;
            const lastDoc = isPaginated && docsToProcess.length > 0 ? docsToProcess[docsToProcess.length - 1] : null;

            const data = docsToProcess.map((doc: any) => {
                const docData = convertTimestampsToDates(doc.data());
                let entity = { id: doc.id, ...docData } as T;
                if (processEntity) entity = processEntity(entity);
                return entity;
            });

            return { data, lastDoc, hasMore };
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
                fetchFromFirestore().then(async ({ data, lastDoc, hasMore }) => {
                    await localCache.set(cacheKey, data);
                    dispatch({ type: 'SET_DATA', payload: { collection: collectionName as any, data } });

                    // 🔧 OTIMIZAÇÃO: Atualiza estado de paginação para animals
                    if (collectionName === 'animals') {
                        lastDocRef.current = lastDoc;
                        dispatch({ type: 'SET_PAGINATION', payload: { collection: 'animals', hasMore, lastDoc } });
                    }

                    console.log(`🔄 [REVALIDATED] ${collectionName}`);
                }).catch(err => console.error(`Erro ao revalidar ${collectionName}:`, err));
            }
            return cached.data;
        }

        // 2. Sem cache - busca do Firestore
        try {
            const { data, lastDoc, hasMore } = await fetchFromFirestore();
            await localCache.set(cacheKey, data);

            dispatch({ type: 'SET_DATA', payload: { collection: collectionName as any, data } });
            dispatch({ type: 'SET_LOADING_STATUS', payload: { collection: loadingKey, status: false } });

            // 🔧 OTIMIZAÇÃO: Atualiza estado de paginação para animals
            if (collectionName === 'animals') {
                lastDocRef.current = lastDoc;
                dispatch({ type: 'SET_PAGINATION', payload: { collection: 'animals', hasMore, lastDoc } });
                console.log(`📄 [PAGINATION] Animals: hasMore=${hasMore}, loaded=${data.length}`);
            }

            return data;
        } catch (error) {
            console.error(`Erro ao buscar ${collectionName}:`, error);
            dispatch({ type: 'SET_ERROR', payload: `Falha ao buscar ${collectionName}` });
            dispatch({ type: 'SET_LOADING_STATUS', payload: { collection: loadingKey, status: false } });
            return [];
        }
    }, [userId]);

    // ============================================
    // FUNÇÃO: Atualizar cache local
    // ============================================
    // IMPORTANTE: Esta função deve estar definida ANTES de loadMoreAnimals
    // para evitar erro "Cannot access 'updateLocalCache' before initialization"
    const updateLocalCache = useCallback(async (collectionName: string, data: any[]) => {
        if (!userId) return;
        const cacheKey = `${userId}_${collectionName}`;
        await localCache.set(cacheKey, data);
    }, [userId]);

    // ============================================
    // 🔧 OTIMIZAÇÃO 5: CARREGAR MAIS ANIMAIS (PAGINAÇÃO)
    // ============================================
    const loadMoreAnimals = useCallback(async () => {
        if (!userId || !db) return;

        const { hasMore, isLoadingMore } = stateRef.current.pagination.animals;
        const lastDoc = lastDocRef.current;

        if (!hasMore || isLoadingMore || !lastDoc) {
            console.log('📄 [PAGINATION] Não há mais animais para carregar ou já está carregando');
            return;
        }

        dispatch({ type: 'SET_LOADING_MORE', payload: { collection: 'animals', isLoading: true } });

        try {
            console.log(`📄 [PAGINATION] Carregando mais animais...`);

            const query = db.collection('animals')
                .where("userId", "==", userId)
                .orderBy('brinco')
                .startAfter(lastDoc)
                .limit(QUERY_LIMITS.PAGINATION_SIZE + 1); // +1 para verificar se tem mais

            const snapshot = await query.get();

            // Verifica se tem mais páginas
            const hasMorePages = snapshot.docs.length > QUERY_LIMITS.PAGINATION_SIZE;
            const docsToProcess = hasMorePages
                ? snapshot.docs.slice(0, QUERY_LIMITS.PAGINATION_SIZE)
                : snapshot.docs;
            const newLastDoc = docsToProcess.length > 0
                ? docsToProcess[docsToProcess.length - 1]
                : null;

            const newAnimals: Animal[] = docsToProcess.map((doc: any) => {
                const docData = convertTimestampsToDates(doc.data());
                return processAnimalEntity({ id: doc.id, ...docData });
            });

            // Atualiza estado
            dispatch({ type: 'APPEND_DATA', payload: { collection: 'animals', data: newAnimals } });
            lastDocRef.current = newLastDoc;
            dispatch({ type: 'SET_PAGINATION', payload: { collection: 'animals', hasMore: hasMorePages, lastDoc: newLastDoc } });

            // Atualiza cache com todos os animais
            const allAnimals = [...stateRef.current.animals, ...newAnimals];
            await updateLocalCache('animals', allAnimals);

            console.log(`✅ [PAGINATION] Carregados ${newAnimals.length} animais. Total: ${allAnimals.length}. Tem mais: ${hasMorePages}`);

        } catch (error) {
            console.error('❌ [PAGINATION] Erro ao carregar mais animais:', error);
            dispatch({ type: 'SET_ERROR', payload: 'Erro ao carregar mais animais' });
        } finally {
            dispatch({ type: 'SET_LOADING_MORE', payload: { collection: 'animals', isLoading: false } });
        }
    }, [userId, updateLocalCache]);

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

        // 🔧 Migracao automatica de registros sanitarios
        // Agrupa medicamentos do mesmo dia/motivo em um unico tratamento
        let historicoSanitario = entity.historicoSanitario || [];
        if (needsMigration(historicoSanitario)) {
            historicoSanitario = migrateHealthHistory(historicoSanitario);
            console.log(`🔄 [MIGRATION] Historico sanitario migrado para ${entity.brinco || entity.id}`);
        }

        return {
            ...entity,
            fotos: finalFotos,
            historicoSanitario,
            historicoPesagens: entity.historicoPesagens || [],
            historicoPrenhez: entity.historicoPrenhez || [],
            historicoAborto: entity.historicoAborto || [],
            historicoProgenie: entity.historicoProgenie || [],
        };
    };


    // ============================================
    // 🔧 OTIMIZAÇÃO 1: LISTENERS EM TEMPO REAL
    // ============================================
    // Substitui polling por listeners que só recebem mudanças
    // Economia estimada: ~90% menos leituras do Firestore
    const setupRealtimeListeners = useCallback(() => {
        if (!userId || !db || !REALTIME_CONFIG.enabled) return;

        console.log('🔴 [REALTIME] Configurando listeners em tempo real...');

        // Listener para Animals
        const animalsUnsubscribe = db.collection('animals')
            .where('userId', '==', userId)
            .onSnapshot(
                (snapshot: any) => {
                    // Ignora o snapshot inicial se já temos dados carregados
                    if (!initialLoadDoneRef.current) return;

                    snapshot.docChanges().forEach((change: any) => {
                        const docData = convertTimestampsToDates(change.doc.data());
                        const animal = processAnimalEntity({ id: change.doc.id, ...docData });

                        if (change.type === 'added') {
                            // Verifica se já existe (evita duplicação)
                            const exists = stateRef.current.animals.some(a => a.id === animal.id);
                            if (!exists) {
                                console.log(`🟢 [REALTIME] Animal adicionado: ${animal.brinco}`);
                                dispatch({ type: 'LOCAL_ADD_ANIMAL', payload: animal });
                            }
                        }
                        if (change.type === 'modified') {
                            console.log(`🟡 [REALTIME] Animal modificado: ${animal.brinco}`);
                            dispatch({ type: 'LOCAL_UPDATE_ANIMAL', payload: { animalId: animal.id, updatedData: animal } });
                        }
                        if (change.type === 'removed') {
                            console.log(`🔴 [REALTIME] Animal removido: ${animal.brinco}`);
                            dispatch({ type: 'LOCAL_DELETE_ANIMAL', payload: { animalId: animal.id } });
                        }
                    });

                    // Atualiza cache após mudanças
                    updateLocalCache('animals', stateRef.current.animals);
                },
                (error: any) => {
                    console.error('❌ [REALTIME] Erro no listener de animals:', error);
                }
            );
        listenersRef.current.animals = animalsUnsubscribe;

        // Listener para Calendar Events
        const calendarUnsubscribe = db.collection('calendar')
            .where('userId', '==', userId)
            .onSnapshot(
                (snapshot: any) => {
                    if (!initialLoadDoneRef.current) return;

                    snapshot.docChanges().forEach((change: any) => {
                        const docData = convertTimestampsToDates(change.doc.data());
                        const event: CalendarEvent = { id: change.doc.id, ...docData } as CalendarEvent;

                        if (change.type === 'added') {
                            const exists = stateRef.current.calendarEvents.some(e => e.id === event.id);
                            if (!exists) {
                                console.log(`🟢 [REALTIME] Evento adicionado: ${event.title}`);
                                dispatch({ type: 'LOCAL_ADD_CALENDAR_EVENT', payload: event });
                            }
                        }
                        if (change.type === 'modified') {
                            console.log(`🟡 [REALTIME] Evento modificado: ${event.title}`);
                            dispatch({ type: 'LOCAL_UPDATE_CALENDAR_EVENT', payload: event });
                        }
                        if (change.type === 'removed') {
                            console.log(`🔴 [REALTIME] Evento removido: ${event.id}`);
                            dispatch({ type: 'LOCAL_DELETE_CALENDAR_EVENT', payload: { eventId: event.id } });
                        }
                    });

                    updateLocalCache('calendarEvents', stateRef.current.calendarEvents);
                },
                (error: any) => {
                    console.error('❌ [REALTIME] Erro no listener de calendar:', error);
                }
            );
        listenersRef.current.calendar = calendarUnsubscribe;

        // Listener para Tasks
        const tasksUnsubscribe = db.collection('tasks')
            .where('userId', '==', userId)
            .onSnapshot(
                (snapshot: any) => {
                    if (!initialLoadDoneRef.current) return;

                    snapshot.docChanges().forEach((change: any) => {
                        const docData = convertTimestampsToDates(change.doc.data());
                        const task: Task = { id: change.doc.id, ...docData } as Task;

                        if (change.type === 'added') {
                            const exists = stateRef.current.tasks.some(t => t.id === task.id);
                            if (!exists) {
                                console.log(`🟢 [REALTIME] Tarefa adicionada: ${task.description}`);
                                dispatch({ type: 'LOCAL_ADD_TASK', payload: task });
                            }
                        }
                        if (change.type === 'modified') {
                            console.log(`🟡 [REALTIME] Tarefa modificada: ${task.description}`);
                            dispatch({ type: 'LOCAL_UPDATE_TASK', payload: { taskId: task.id, updatedData: task } });
                        }
                        if (change.type === 'removed') {
                            console.log(`🔴 [REALTIME] Tarefa removida: ${task.id}`);
                            dispatch({ type: 'LOCAL_DELETE_TASK', payload: { taskId: task.id } });
                        }
                    });

                    updateLocalCache('tasks', stateRef.current.tasks);
                },
                (error: any) => {
                    console.error('❌ [REALTIME] Erro no listener de tasks:', error);
                }
            );
        listenersRef.current.tasks = tasksUnsubscribe;

        dispatch({ type: 'SET_LISTENERS_ACTIVE', payload: true });
        console.log('✅ [REALTIME] Listeners configurados com sucesso');
    }, [userId, updateLocalCache]);

    // ============================================
    // 🔧 OTIMIZAÇÃO 3: SYNC DELTA (Apenas mudanças)
    // ============================================
    // Busca apenas documentos modificados desde o último sync
    // Requer campo 'updatedAt' nos documentos
    const syncDelta = useCallback(async () => {
        // Se já está sincronizando, não faz nada
        if (syncInProgressRef.current) {
            console.log('⏳ [DELTA] Sync já em progresso, ignorando...');
            return true; // Retorna true para evitar fallback
        }

        if (!userId || !db) return;

        const lastSync = stateRef.current.lastSync;
        if (!lastSync) {
            // Se não tem lastSync, retorna false para indicar que precisa de sync completo
            console.log('⚠️ [DELTA] Sem lastSync, necessário sync completo...');
            return false;
        }

        console.log(`🔄 [DELTA] Buscando mudanças desde ${new Date(lastSync).toLocaleString()}...`);
        syncInProgressRef.current = true;

        try {
            const lastSyncDate = new Date(lastSync);
            let changesFound = 0;

            // Sync delta para Animals (se tiver campo updatedAt)
            try {
                const animalsSnapshot = await db.collection('animals')
                    .where('userId', '==', userId)
                    .where('updatedAt', '>', lastSyncDate)
                    .get();

                if (!animalsSnapshot.empty) {
                    animalsSnapshot.docs.forEach((doc: any) => {
                        const docData = convertTimestampsToDates(doc.data());
                        const animal = processAnimalEntity({ id: doc.id, ...docData });

                        const exists = stateRef.current.animals.some(a => a.id === animal.id);
                        if (exists) {
                            dispatch({ type: 'LOCAL_UPDATE_ANIMAL', payload: { animalId: animal.id, updatedData: animal } });
                        } else {
                            dispatch({ type: 'LOCAL_ADD_ANIMAL', payload: animal });
                        }
                        changesFound++;
                    });
                    console.log(`📦 [DELTA] ${animalsSnapshot.size} animais atualizados`);
                }
            } catch (e) {
                // Campo updatedAt pode não existir - ignora silenciosamente
                console.log('ℹ️ [DELTA] Campo updatedAt não configurado para animals');
            }

            // Sync delta para Calendar
            try {
                const calendarSnapshot = await db.collection('calendar')
                    .where('userId', '==', userId)
                    .where('updatedAt', '>', lastSyncDate)
                    .get();

                if (!calendarSnapshot.empty) {
                    calendarSnapshot.docs.forEach((doc: any) => {
                        const docData = convertTimestampsToDates(doc.data());
                        const event: CalendarEvent = { id: doc.id, ...docData } as CalendarEvent;

                        const exists = stateRef.current.calendarEvents.some(e => e.id === event.id);
                        if (exists) {
                            dispatch({ type: 'LOCAL_UPDATE_CALENDAR_EVENT', payload: event });
                        } else {
                            dispatch({ type: 'LOCAL_ADD_CALENDAR_EVENT', payload: event });
                        }
                        changesFound++;
                    });
                    console.log(`📦 [DELTA] ${calendarSnapshot.size} eventos atualizados`);
                }
            } catch (e) {
                console.log('ℹ️ [DELTA] Campo updatedAt não configurado para calendar');
            }

            // Sync delta para Tasks
            try {
                const tasksSnapshot = await db.collection('tasks')
                    .where('userId', '==', userId)
                    .where('updatedAt', '>', lastSyncDate)
                    .get();

                if (!tasksSnapshot.empty) {
                    tasksSnapshot.docs.forEach((doc: any) => {
                        const docData = convertTimestampsToDates(doc.data());
                        const task: Task = { id: doc.id, ...docData } as Task;

                        const exists = stateRef.current.tasks.some(t => t.id === task.id);
                        if (exists) {
                            dispatch({ type: 'LOCAL_UPDATE_TASK', payload: { taskId: task.id, updatedData: task } });
                        } else {
                            dispatch({ type: 'LOCAL_ADD_TASK', payload: task });
                        }
                        changesFound++;
                    });
                    console.log(`📦 [DELTA] ${tasksSnapshot.size} tarefas atualizadas`);
                }
            } catch (e) {
                console.log('ℹ️ [DELTA] Campo updatedAt não configurado para tasks');
            }

            dispatch({ type: 'SET_LAST_SYNC', payload: Date.now() });

            if (changesFound > 0) {
                // Atualiza caches
                await Promise.all([
                    updateLocalCache('animals', stateRef.current.animals),
                    updateLocalCache('calendarEvents', stateRef.current.calendarEvents),
                    updateLocalCache('tasks', stateRef.current.tasks),
                ]);
                console.log(`✅ [DELTA] Sync concluído: ${changesFound} mudanças aplicadas`);
            } else {
                console.log('✅ [DELTA] Nenhuma mudança encontrada');
            }

        } catch (error) {
            console.error('❌ [DELTA] Erro no sync delta:', error);
        } finally {
            syncInProgressRef.current = false;
        }
    }, [userId, updateLocalCache]);

    // ============================================
    // 🔧 OTIMIZAÇÃO 4: Limpeza automática de cache no startup
    // ============================================
    useEffect(() => {
        const cleanupCache = async () => {
            try {
                const deletedCount = await localCache.cleanOldEntries(3 * 24 * 60 * 60 * 1000); // 3 dias
                if (deletedCount > 0) {
                    console.log(`🧹 [CACHE] Limpeza automática: ${deletedCount} entradas antigas removidas`);
                }
            } catch (error) {
                console.warn('⚠️ [CACHE] Erro na limpeza automática:', error);
            }
        };

        cleanupCache();
    }, []); // Executa apenas uma vez no mount

    // ============================================
    // EFEITO: Carregamento inicial + Setup Listeners
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
                    loadWithCache<BreedingSeason>('breedingSeasons', 'breeding_seasons', 'breedingSeasons'),
                ]);

                dispatch({ type: 'SET_LAST_SYNC', payload: Date.now() });

                // 🔧 OTIMIZAÇÃO: Marca que carga inicial terminou e configura listeners
                initialLoadDoneRef.current = true;

                // Configura listeners em tempo real após carga inicial
                if (REALTIME_CONFIG.enabled) {
                    setupRealtimeListeners();
                }
            } finally {
                syncInProgressRef.current = false;
            }
        };

        loadAllData();

        // 🔧 CLEANUP: Remove listeners ao desmontar ou trocar usuário
        return () => {
            console.log('🔄 [REALTIME] Removendo listeners...');
            Object.values(listenersRef.current).forEach(unsubscribe => {
                if (typeof unsubscribe === 'function') {
                    unsubscribe();
                }
            });
            listenersRef.current = {};
            initialLoadDoneRef.current = false;
            dispatch({ type: 'SET_LISTENERS_ACTIVE', payload: false });
        };
    }, [userId, loadWithCache, setupRealtimeListeners]);

    // ============================================
    // 🔧 OTIMIZAÇÃO: Pausar listeners quando aba não está visível
    // ============================================
    // Economia estimada: ~40% menos leituras do Firestore
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (!userId || !db) return;

            if (document.hidden) {
                // Pausa listeners quando aba não está visível
                console.log('👁️ [VISIBILITY] Aba oculta - pausando listeners...');
                Object.values(listenersRef.current).forEach(unsubscribe => {
                    if (typeof unsubscribe === 'function') {
                        unsubscribe();
                    }
                });
                listenersRef.current = {};
                dispatch({ type: 'SET_LISTENERS_ACTIVE', payload: false });
            } else {
                // Reativa quando aba volta a ficar visível
                console.log('👁️ [VISIBILITY] Aba visível - reativando...');
                syncDelta().then(() => {
                    if (REALTIME_CONFIG.enabled && !stateRef.current.listenersActive) {
                        setupRealtimeListeners();
                    }
                });
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [userId, syncDelta, setupRealtimeListeners]);

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
            loadWithCache<BreedingSeason>('breedingSeasons', 'breeding_seasons', 'breedingSeasons'),
        ]);

        dispatch({ type: 'SET_LAST_SYNC', payload: Date.now() });
    }, [userId, loadWithCache]);

    // ============================================
    // ANIMALS
    // ============================================
    const addAnimal = useCallback(async (animalData: Omit<Animal, 'id' | 'fotos' | 'historicoSanitario' | 'historicoPesagens'>) => {
        if (!userId || !db) return;

        // 🔧 OTIMIZAÇÃO: Verificar quota antes de escrever (2 porque pode atualizar mãe)
        if (!canPerformOperation('write', 2)) {
            throw new Error('Limite de escritas atingido. Tente novamente amanhã.');
        }

        try {
            const batch = db.batch();
            const newAnimalRef = db.collection('animals').doc();

            // Se tem data de nascimento E peso, considera peso de nascimento (Birth)
            // Senão, se só tem peso sem data de nascimento, é um peso inicial sem tipo definido
            const initialWeightHistory = animalData.pesoKg > 0
                ? [{
                    id: `initial-${newAnimalRef.id}`,
                    date: animalData.dataNascimento || new Date(),
                    weightKg: animalData.pesoKg,
                    type: animalData.dataNascimento ? WeighingType.Birth : WeighingType.None
                }]
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

            // 🔧 OTIMIZAÇÃO: Adiciona updatedAt para suportar sync delta
            batch.set(newAnimalRef, { ...dataWithTimestamp, userId, updatedAt: new Date() });

            // 🔧 FIV: Se for animal de FIV, registra progênie na mãe biológica (doadora)
            // Para animais normais, registra na mãe indicada no campo maeNome
            const biologicalMotherBrinco = animalData.isFIV && animalData.maeBiologicaNome
                ? animalData.maeBiologicaNome.toLowerCase().trim()
                : animalData.maeNome?.toLowerCase().trim();

            if (biologicalMotherBrinco) {
                // 🔧 OTIMIZAÇÃO: Usa stateRef para evitar dependência de state.animals
                const currentAnimals = stateRef.current.animals;
                const motherLocal = currentAnimals.find(a =>
                    a.brinco.toLowerCase().trim() === biologicalMotherBrinco &&
                    a.sexo === Sexo.Femea
                );

                if (motherLocal) {
                    const motherRef = db.collection('animals').doc(motherLocal.id);

                    // 🔧 FIV: Verifica se já existe um registro de embrião pendente para atualizar
                    let existingEmbryo = null;
                    if (animalData.isFIV) {
                        const receptoraBrinco = animalData.maeReceptoraNome || animalData.maeNome;
                        if (receptoraBrinco) {
                            existingEmbryo = motherLocal.historicoProgenie?.find(p =>
                                p.offspringBrinco.includes('Embriao') &&
                                p.offspringBrinco.includes(receptoraBrinco)
                            );
                        }
                    }

                    if (existingEmbryo) {
                        // 🔧 FIV: Atualiza o registro de embrião existente com o brinco real do bezerro
                        const updatedProgenie = motherLocal.historicoProgenie?.map(p => {
                            if (p.id === existingEmbryo!.id) {
                                return {
                                    ...p,
                                    offspringBrinco: animalData.brinco,
                                    birthWeightKg: animalData.pesoKg > 0 ? animalData.pesoKg : p.birthWeightKg,
                                };
                            }
                            return p;
                        }) || [];

                        // Atualiza no Firestore (substitui todo o array)
                        batch.update(motherRef, {
                            historicoProgenie: updatedProgenie,
                            updatedAt: new Date()
                        });

                        // Atualização otimista
                        dispatch({
                            type: 'LOCAL_UPDATE_ANIMAL',
                            payload: {
                                animalId: motherLocal.id,
                                updatedData: { historicoProgenie: updatedProgenie }
                            }
                        });
                    } else {
                        // Não é FIV ou não tem embrião pendente - cria novo registro
                        const newOffspringRecord: any = {
                            id: `prog_${newAnimalRef.id}`,
                            offspringBrinco: animalData.brinco,
                        };

                        if (animalData.pesoKg > 0) {
                            newOffspringRecord.birthWeightKg = animalData.pesoKg;
                        }

                        // 🔧 OTIMIZAÇÃO: Adiciona updatedAt para suportar sync delta
                        batch.update(motherRef, {
                            historicoProgenie: FieldValue.arrayUnion(newOffspringRecord),
                            updatedAt: new Date()
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
            }

            // Atualização otimista ANTES do commit
            const newAnimal: Animal = {
                id: newAnimalRef.id,
                ...fullAnimalData
            };
            dispatch({ type: 'LOCAL_ADD_ANIMAL', payload: newAnimal });

            await batch.commit();

            // 🔧 OTIMIZAÇÃO: Rastrear escritas (1 animal + possível atualização da mãe)
            trackWrites(animalData.maeNome ? 2 : 1);

            // Atualiza cache usando stateRef
            await updateLocalCache('animals', [...stateRef.current.animals, newAnimal]);

        } catch (error) {
            console.error("Erro ao adicionar animal:", error);
            // Em caso de erro, força sync para reverter
            await forceSync();
            throw error;
        }
    }, [userId, updateLocalCache, forceSync]);

    // ============================================
    // 🔧 SYNC REVERSO: Paternidade Animal → Estação de Monta
    // ============================================
    /**
     * Sincroniza alteração de paternidade de um bezerro para a estação de monta.
     *
     * Casos tratados:
     * 1. Correção de pai após nascimento (touro diferente do registrado)
     * 2. Prenhez era do repasse, não da IATF
     * 3. Confirmação de paternidade quando havia 2 touros
     *
     * @param calfId - ID do bezerro
     * @param newPaiId - Novo ID do pai (touro)
     * @param newPaiNome - Novo brinco/nome do pai
     * @param calfBirthDate - Data de nascimento do bezerro
     * @param motherId - ID da mãe do bezerro (para não-FIV) ou da receptora (para FIV)
     * @param isFIVCalf - Se o bezerro é de FIV
     * @param donorId - ID da doadora (mãe biológica) para bezerros FIV
     */
    const syncPaternityToBreedingSeason = useCallback(async (
        calfId: string,
        newPaiId: string | undefined,
        newPaiNome: string | undefined,
        calfBirthDate: Date | undefined,
        motherId: string | undefined,
        isFIVCalf?: boolean,
        donorId?: string
    ): Promise<void> => {
        if (!userId || !db) return;
        if (!newPaiNome && !newPaiId) return; // Sem pai para sincronizar
        if (!motherId) return; // Sem mãe/receptora, não consegue encontrar cobertura
        if (!calfBirthDate) return; // Sem data de nascimento, não consegue correlacionar

        const breedingSeasons = stateRef.current.breedingSeasons;
        if (!breedingSeasons || breedingSeasons.length === 0) return;

        // Encontra o touro pelo brinco/nome ou ID
        const animals = stateRef.current.animals;
        let newSire: Animal | undefined;

        if (newPaiId) {
            newSire = animals.find((a: Animal) => a.id === newPaiId && a.sexo === Sexo.Macho);
        }
        if (!newSire && newPaiNome) {
            const paiNomeLower = newPaiNome.toLowerCase().trim();
            newSire = animals.find((a: Animal) =>
                a.brinco.toLowerCase().trim() === paiNomeLower && a.sexo === Sexo.Macho
            );
        }

        // Determina o ID e brinco do pai para usar na cobertura
        const confirmedSireId = newSire?.id || newPaiId || '';
        const confirmedSireBrinco = newSire?.brinco || newPaiNome || '';

        if (!confirmedSireId && !confirmedSireBrinco) return;

        // Calcula a data aproximada da cobertura (283 dias antes do nascimento)
        const birthTime = new Date(calfBirthDate).getTime();
        const estimatedCoverageTime = birthTime - (283 * 24 * 60 * 60 * 1000);
        const toleranceMs = 45 * 24 * 60 * 60 * 1000; // ±45 dias de tolerância

        // Procura em todas as estações de monta por coberturas da mãe
        // Ordena por data (mais recente primeiro) para priorizar estações mais recentes
        const sortedSeasons = [...breedingSeasons].sort((a, b) =>
            new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
        );

        for (const season of sortedSeasons) {
            if (!season.coverageRecords || season.coverageRecords.length === 0) continue;

            // Verifica se a data estimada da cobertura está dentro do período da estação (com margem)
            const seasonStart = new Date(season.startDate).getTime();
            const seasonEnd = new Date(season.endDate).getTime();
            const marginMs = 60 * 24 * 60 * 60 * 1000; // 60 dias de margem para coberturas próximas ao fim da estação

            if (estimatedCoverageTime < seasonStart - marginMs || estimatedCoverageTime > seasonEnd + marginMs) {
                continue; // Pula estações fora do período
            }

            // 🔧 FIV: Busca coberturas considerando se o bezerro é de FIV ou não
            // Para FIV: cowId = receptora (quem gestou), donorCowId = doadora (mãe biológica)
            // Para não-FIV: cowId = mãe direta
            const coverageIndex = season.coverageRecords.findIndex((c: CoverageRecord) => {
                // A vaca da cobertura deve ser a "mãe" (receptora para FIV, mãe direta para outros)
                if (c.cowId !== motherId) return false;

                // 🔧 FIV: Se o bezerro é de FIV, a cobertura também deve ser FIV
                // E se tiver doadora especificada, deve bater
                if (isFIVCalf) {
                    if (c.type !== CoverageTypes.FIV) return false;
                    // Se tiver doadora especificada no bezerro, verifica se bate com a cobertura
                    if (donorId && c.donorCowId && c.donorCowId !== donorId) return false;
                } else {
                    // Para não-FIV, a cobertura NÃO deve ser FIV (para evitar confusão)
                    if (c.type === CoverageTypes.FIV) return false;
                }

                const coverageTime = new Date(c.date).getTime();
                const timeDiff = Math.abs(coverageTime - estimatedCoverageTime);

                return timeDiff <= toleranceMs;
            });

            if (coverageIndex === -1) continue;

            const coverage = season.coverageRecords[coverageIndex];

            // Determina se deve atualizar a cobertura principal ou o repasse
            // Se a prenhez foi do repasse (DG principal negativo + repasse positivo), atualiza repasse
            const isRepassePregnancy = coverage.pregnancyResult === 'negative' &&
                                       coverage.repasse?.enabled &&
                                       coverage.repasse?.diagnosisResult === 'positive';

            let updatedCoverage: CoverageRecord;
            let updatedHistoricoPrenhez: PregnancyRecord[] | undefined;

            if (isRepassePregnancy) {
                // Atualiza o repasse
                updatedCoverage = {
                    ...coverage,
                    repasse: {
                        ...coverage.repasse!,
                        confirmedSireId: confirmedSireId,
                        confirmedSireBrinco: confirmedSireBrinco,
                    }
                };

                // Atualiza historicoPrenhez da mãe (registro de repasse)
                const mother = animals.find((a: Animal) => a.id === motherId);
                if (mother?.historicoPrenhez) {
                    const repasseRecordId = `repasse_${coverage.id}`;
                    updatedHistoricoPrenhez = mother.historicoPrenhez.map((r: PregnancyRecord) =>
                        r.id === repasseRecordId
                            ? { ...r, sireName: confirmedSireBrinco }
                            : r
                    );
                }
            } else {
                // Atualiza a cobertura principal
                updatedCoverage = {
                    ...coverage,
                    confirmedSireId: confirmedSireId,
                    confirmedSireBrinco: confirmedSireBrinco,
                };

                // Atualiza historicoPrenhez da mãe (registro principal)
                const mother = animals.find((a: Animal) => a.id === motherId);
                if (mother?.historicoPrenhez) {
                    updatedHistoricoPrenhez = mother.historicoPrenhez.map((r: PregnancyRecord) =>
                        r.id === coverage.id
                            ? { ...r, sireName: confirmedSireBrinco }
                            : r
                    );
                }
            }

            // Atualiza a estação de monta
            const updatedCoverageRecords = season.coverageRecords.map((c: CoverageRecord, idx: number) =>
                idx === coverageIndex ? updatedCoverage : c
            );

            try {
                // Atualiza a estação de monta no Firestore
                const seasonRef = db.collection('breedingSeasons').doc(season.id);
                await seasonRef.update({
                    coverageRecords: convertDatesToTimestamps(updatedCoverageRecords),
                    updatedAt: new Date()
                });

                // Atualização otimista local da estação
                const updatedSeason = { ...season, coverageRecords: updatedCoverageRecords };
                dispatch({
                    type: 'LOCAL_UPDATE_BREEDING_SEASON',
                    payload: { seasonId: season.id, updatedData: { coverageRecords: updatedCoverageRecords } }
                });

                // Atualiza o cache local das estações
                const updatedSeasons = stateRef.current.breedingSeasons.map((s: BreedingSeason) =>
                    s.id === season.id ? updatedSeason : s
                );
                await updateLocalCache('breedingSeasons', updatedSeasons);

                // Atualiza o historicoPrenhez da mãe se necessário
                if (updatedHistoricoPrenhez) {
                    const motherRef = db.collection('animals').doc(motherId);
                    await motherRef.update({
                        historicoPrenhez: convertDatesToTimestamps(updatedHistoricoPrenhez),
                        updatedAt: new Date()
                    });

                    dispatch({
                        type: 'LOCAL_UPDATE_ANIMAL',
                        payload: { animalId: motherId, updatedData: { historicoPrenhez: updatedHistoricoPrenhez } }
                    });

                    const updatedAnimals = stateRef.current.animals.map((a: Animal) =>
                        a.id === motherId ? { ...a, historicoPrenhez: updatedHistoricoPrenhez } : a
                    );
                    await updateLocalCache('animals', updatedAnimals);
                }

                console.log(`✅ [SYNC_PATERNITY] Paternidade sincronizada: Bezerro ${calfId} → Pai ${confirmedSireBrinco} na estação ${season.name}`);

                // Encontrou e atualizou, pode parar
                return;
            } catch (error) {
                console.error('❌ [SYNC_PATERNITY] Erro ao sincronizar paternidade:', error);
                // Não propaga erro para não bloquear a atualização do animal
            }
        }

        console.log(`ℹ️ [SYNC_PATERNITY] Nenhuma cobertura encontrada para sincronizar (Mãe: ${motherId}, Nascimento: ${calfBirthDate})`);
    }, [userId, db, updateLocalCache]);

    const updateAnimal = useCallback(async (animalId: string, updatedData: Partial<Omit<Animal, 'id'>>) => {
        if (!userId || !db) return;

        // 🔧 OTIMIZAÇÃO: Verificar quota antes de escrever
        if (!canPerformOperation('write', 2)) {
            throw new Error('Limite de escritas atingido. Tente novamente amanhã.');
        }

        // 🔧 FIX: Remove undefined values AND invalid dates BEFORE optimistic update
        // This prevents dataNascimento: undefined/Invalid from overwriting existing birth date
        const sanitizedData = removeUndefined(updatedData);

        // 🔧 FIX EXTRA: Preservar dataNascimento do animal original se a nova for inválida
        const currentAnimal = stateRef.current.animals.find((a: Animal) => a.id === animalId);
        if (currentAnimal) {
            const isValidDate = (d: any): boolean => {
                if (!d) return false;
                const date = d instanceof Date ? d : new Date(d);
                return !isNaN(date.getTime());
            };

            // Se o dado sanitizado não tem dataNascimento válida mas o animal original tem, preserva
            if (!isValidDate(sanitizedData.dataNascimento) && isValidDate(currentAnimal.dataNascimento)) {
                console.warn('⚠️ [UPDATE_ANIMAL] Preservando dataNascimento original - nova data é inválida');
                delete sanitizedData.dataNascimento; // Remove para não sobrescrever
            }
        }

        // Atualização otimista (usando dados já sanitizados)
        dispatch({ type: 'LOCAL_UPDATE_ANIMAL', payload: { animalId, updatedData: sanitizedData } });

        let writeCount = 1; // Contador para rastrear escritas

        try {
            const batch = db.batch();
            const animalRef = db.collection('animals').doc(animalId);
            const dataWithTimestamp = convertDatesToTimestamps(sanitizedData);

            // 🔧 OTIMIZAÇÃO: Adiciona updatedAt para suportar sync delta
            batch.update(animalRef, { ...dataWithTimestamp, updatedAt: new Date() });


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
                            // 🔧 OTIMIZAÇÃO: Adiciona updatedAt para suportar sync delta
                            batch.update(maeRef, { historicoProgenie: cleanedProgenie, updatedAt: new Date() });
                            writeCount++; // Incrementa contador de escritas

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

            // 🔧 OTIMIZAÇÃO: Rastrear escritas
            trackWrites(writeCount);

            // 🔧 FIX: Use sanitizedData instead of updatedData to prevent undefined values
            // from overwriting existing properties (like dataNascimento)
            const updatedAnimals = stateRef.current.animals.map((a: Animal) =>
                a.id === animalId ? { ...a, ...sanitizedData } : a
            );
            await updateLocalCache('animals', updatedAnimals);

            // ============================================
            // 🔧 SYNC REVERSO: Paternidade → Estação de Monta
            // ============================================
            // Se paiNome ou paiId foi alterado, sincroniza com a estação de monta
            const paternityChanged = updatedData.paiNome !== undefined || updatedData.paiId !== undefined;
            if (paternityChanged && currentAnimal) {
                // Determina os valores atualizados
                const newPaiId = updatedData.paiId ?? currentAnimal.paiId;
                const newPaiNome = updatedData.paiNome ?? currentAnimal.paiNome;
                const birthDate = updatedData.dataNascimento ?? currentAnimal.dataNascimento;

                // 🔧 FIV: Verifica se o bezerro é de FIV para determinar qual "mãe" usar na busca
                // Considera FIV se: isFIV=true OU tem maeReceptoraId/maeReceptoraNome preenchido
                const hasReceptora = !!(updatedData.maeReceptoraId ?? currentAnimal.maeReceptoraId) ||
                                     !!(updatedData.maeReceptoraNome ?? currentAnimal.maeReceptoraNome);
                const isFIVCalf = (updatedData.isFIV ?? currentAnimal.isFIV) || hasReceptora;

                let resolvedMotherId: string | undefined;
                let resolvedDonorId: string | undefined;

                if (isFIVCalf) {
                    // Para bezerros FIV: a "mãe" na cobertura é a RECEPTORA
                    const receptoraId = updatedData.maeReceptoraId ?? currentAnimal.maeReceptoraId;
                    if (!receptoraId) {
                        // Busca receptora pelo brinco
                        const receptoraNome = updatedData.maeReceptoraNome ?? currentAnimal.maeReceptoraNome;
                        if (receptoraNome) {
                            const receptoraNomeLower = receptoraNome.toLowerCase().trim();
                            const receptora = stateRef.current.animals.find((a: Animal) =>
                                a.brinco.toLowerCase().trim() === receptoraNomeLower && a.sexo === Sexo.Femea
                            );
                            resolvedMotherId = receptora?.id;
                        }
                    } else {
                        resolvedMotherId = receptoraId;
                    }

                    // Também resolve a doadora (mãe biológica) para validação adicional
                    const donorId = updatedData.maeBiologicaId ?? currentAnimal.maeBiologicaId;
                    if (!donorId) {
                        const donorNome = updatedData.maeBiologicaNome ?? currentAnimal.maeBiologicaNome;
                        if (donorNome) {
                            const donorNomeLower = donorNome.toLowerCase().trim();
                            const donor = stateRef.current.animals.find((a: Animal) =>
                                a.brinco.toLowerCase().trim() === donorNomeLower && a.sexo === Sexo.Femea
                            );
                            resolvedDonorId = donor?.id;
                        }
                    } else {
                        resolvedDonorId = donorId;
                    }
                } else {
                    // Para bezerros não-FIV: usa maeId normalmente
                    const motherId = updatedData.maeId ?? currentAnimal.maeId;
                    if (!motherId) {
                        const maeNome = updatedData.maeNome ?? currentAnimal.maeNome;
                        if (maeNome) {
                            const maeNomeLower = maeNome.toLowerCase().trim();
                            const mae = stateRef.current.animals.find((a: Animal) =>
                                a.brinco.toLowerCase().trim() === maeNomeLower && a.sexo === Sexo.Femea
                            );
                            resolvedMotherId = mae?.id;
                        }
                    } else {
                        resolvedMotherId = motherId;
                    }
                }

                // Chama a sincronização (não bloqueia, executa em background)
                syncPaternityToBreedingSeason(
                    animalId,
                    newPaiId,
                    newPaiNome,
                    birthDate,
                    resolvedMotherId,
                    isFIVCalf,
                    resolvedDonorId
                ).catch(err => {
                    console.warn('⚠️ [UPDATE_ANIMAL] Falha na sincronização de paternidade:', err);
                });
            }
        } catch (error) {
            console.error("Erro ao atualizar animal:", error);
            await forceSync();
            throw error;
        }
    }, [userId, updateLocalCache, forceSync, syncPaternityToBreedingSeason]);

    const deleteAnimal = useCallback(async (animalId: string): Promise<void> => {
        if (!userId || !db) throw new Error("Não autenticado");

        // 🔧 OTIMIZAÇÃO: Verificar quota antes de deletar
        if (!canPerformOperation('delete', 1)) {
            throw new Error('Limite de exclusões atingido. Tente novamente amanhã.');
        }

        // Atualização otimista
        dispatch({ type: 'LOCAL_DELETE_ANIMAL', payload: { animalId } });

        try {
            await db.collection('animals').doc(animalId).delete();

            // 🔧 OTIMIZAÇÃO: Rastrear exclusão
            trackDeletes(1);

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

                // 🔧 OTIMIZAÇÃO: Adiciona updatedAt para suportar sync delta
                await db.collection('calendar').doc(id).update({ ...dataWithTimestamp, updatedAt: new Date() });

                // 🔧 OTIMIZAÇÃO: Usa stateRef para cache
                const updatedEvents = stateRef.current.calendarEvents.map((e: CalendarEvent) => e.id === id ? updatedEvent : e);
                await updateLocalCache('calendarEvents', updatedEvents);
            } else {
                // CRIAÇÃO - 🔧 OTIMIZAÇÃO: Adiciona updatedAt para suportar sync delta
                const newDocRef = await db.collection('calendar').add({ ...dataWithTimestamp, userId, updatedAt: new Date() });
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
            // 🔧 OTIMIZAÇÃO: Adiciona updatedAt para suportar sync delta
            const newDocRef = await db.collection('tasks').add({ ...dataWithTimestamp, updatedAt: new Date() });
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
            // 🔧 OTIMIZAÇÃO: Adiciona updatedAt para suportar sync delta
            await db.collection('tasks').doc(task.id).update({ isCompleted: newCompletedStatus, updatedAt: new Date() });

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

                // 🔧 OTIMIZAÇÃO: Adiciona updatedAt para suportar sync delta
                await db.collection('areas').doc(id).update({ ...cleanedAreaData, updatedAt: new Date() });

                // 🔧 OTIMIZAÇÃO: Usa stateRef para cache
                const updatedAreas = stateRef.current.managementAreas.map((a: ManagementArea) => a.id === id ? updatedArea : a);
                await updateLocalCache('managementAreas', updatedAreas);
            } else {
                // CRIAÇÃO - 🔧 OTIMIZAÇÃO: Adiciona updatedAt para suportar sync delta
                const newDocRef = await db.collection('areas').add({ ...cleanedAreaData, userId, updatedAt: new Date() });
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
                // 🔧 OTIMIZAÇÃO: Adiciona updatedAt para suportar sync delta
                batch.update(ref, { managementAreaId: FieldValue.delete(), updatedAt: new Date() });
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
                // 🔧 OTIMIZAÇÃO: Adiciona updatedAt para suportar sync delta
                batch.update(animalRef, { managementAreaId: areaId, updatedAt: new Date() });
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
            // 🔧 OTIMIZAÇÃO: Adiciona updatedAt para suportar sync delta
            const newDocRef = await db.collection('batches').add({ ...dataWithTimestamp, updatedAt: new Date() });
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

            // 🔧 OTIMIZAÇÃO: Adiciona updatedAt para suportar sync delta
            await batchRef.update({ ...dataWithTimestamp, updatedAt: new Date() });

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

        // Busca o lote antes de deletar para limpar dados sincronizados
        const batch = stateRef.current.batches.find((b: ManagementBatch) => b.id === batchId);

        // Atualização otimista
        dispatch({ type: 'LOCAL_DELETE_BATCH', payload: { batchId } });

        try {
            const now = new Date();

            // Verifica se o lote concluído tem dados sincronizados que precisam ser revertidos
            const isCompleted = batch && batch.status === 'completed';
            const isMedBatch = isCompleted && (
                batch.purpose === BatchPurpose.Medicamentos ||
                batch.purpose === BatchPurpose.Vacinacao ||
                batch.purpose === BatchPurpose.Vermifugacao
            );
            const isPesagemBatch = isCompleted && (
                batch.purpose === BatchPurpose.Pesagem ||
                batch.purpose === BatchPurpose.Desmame
            );
            const isVendaBatch = isCompleted && batch.purpose === BatchPurpose.Venda;

            const needsReversal = (isMedBatch || isPesagemBatch || isVendaBatch) && batch;

            if (needsReversal) {
                const batchPrefix = `batch_${batchId}_`;

                // Lookup O(1) para animais
                const animalsMap = new Map<string, Animal>();
                for (const a of stateRef.current.animals) {
                    animalsMap.set(a.id, a);
                }

                // WriteBatch com chunking (Firestore max 500 ops por batch)
                const MAX_OPS = 499;
                const writeBatches: ReturnType<typeof db.batch>[] = [db.batch()];
                let batchIdx = 0;
                let batchOps = 0;
                let totalOps = 0;

                const getWB = () => {
                    if (batchOps >= MAX_OPS) {
                        writeBatches.push(db.batch());
                        batchIdx++;
                        batchOps = 0;
                    }
                    batchOps++;
                    totalOps++;
                    return writeBatches[batchIdx];
                };

                for (const animalId of batch.animalIds) {
                    const animal = animalsMap.get(animalId);
                    if (!animal) continue;
                    const animalRef = db.collection('animals').doc(animalId);

                    // ── REVERSÃO: Medicamentos → remove do historicoSanitario ──
                    if (isMedBatch && animal.historicoSanitario?.length) {
                        const filteredHistorico = animal.historicoSanitario.filter(
                            (record: MedicationAdministration) => !record.id?.startsWith(batchPrefix)
                        );

                        if (filteredHistorico.length < animal.historicoSanitario.length) {
                            const wb = getWB();
                            wb.update(animalRef, {
                                historicoSanitario: convertDatesToTimestamps(filteredHistorico),
                                updatedAt: now,
                            });
                            dispatch({
                                type: 'LOCAL_UPDATE_ANIMAL',
                                payload: { animalId, updatedData: { historicoSanitario: filteredHistorico } }
                            });
                        }
                    }

                    // ── REVERSÃO: Pesagem/Desmame → remove do historicoPesagens + recalcula pesoKg ──
                    if (isPesagemBatch && animal.historicoPesagens?.length) {
                        const filteredPesagens = animal.historicoPesagens.filter(
                            (entry: WeightEntry) => !entry.id?.startsWith(batchPrefix)
                        );

                        if (filteredPesagens.length < animal.historicoPesagens.length) {
                            // Recalcula pesoKg: último peso restante no histórico, ou 0 se vazio
                            const sortedRemaining = [...filteredPesagens].sort(
                                (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
                            );
                            const latestWeight = sortedRemaining.length > 0 ? sortedRemaining[0].weightKg : 0;

                            const wb = getWB();
                            wb.update(animalRef, {
                                historicoPesagens: convertDatesToTimestamps(filteredPesagens),
                                pesoKg: latestWeight,
                                updatedAt: now,
                            });
                            dispatch({
                                type: 'LOCAL_UPDATE_ANIMAL',
                                payload: { animalId, updatedData: { historicoPesagens: filteredPesagens, pesoKg: latestWeight } }
                            });
                        }
                    }

                    // ── REVERSÃO: Venda → volta status para Ativo ──
                    if (isVendaBatch) {
                        const wb = getWB();
                        wb.update(animalRef, {
                            status: AnimalStatus.Ativo,
                            updatedAt: now,
                        });
                        dispatch({
                            type: 'LOCAL_UPDATE_ANIMAL',
                            payload: { animalId, updatedData: { status: AnimalStatus.Ativo } }
                        });
                    }
                }

                // Deleta o lote
                const wb = getWB();
                wb.delete(db.collection('batches').doc(batchId));

                trackWrites(totalOps);
                for (const wbChunk of writeBatches) {
                    await wbChunk.commit();
                }
            } else {
                // Lote sem dados sincronizados - só deleta o documento
                await db.collection('batches').doc(batchId).delete();
                trackWrites(1);
            }

            // 🔧 OTIMIZAÇÃO: Usa stateRef para cache
            const updatedBatches = stateRef.current.batches.filter((b: ManagementBatch) => b.id !== batchId);
            await updateLocalCache('batches', updatedBatches);
        } catch (error) {
            console.error("Erro ao deletar lote:", error);
            await forceSync();
            throw error;
        }
    }, [userId, updateLocalCache, forceSync]);

    const completeBatch = useCallback(async (batchId: string, completionData?: Partial<ManagementBatch>) => {
        if (!userId || !db) return;

        // Busca o lote no estado local
        const batch = stateRef.current.batches.find((b: ManagementBatch) => b.id === batchId);
        if (!batch) return;

        // 🔧 OTIMIZAÇÃO: Verifica quota antes de iniciar
        // 1 escrita para o lote + 1 escrita por animal (registro único com todos os medicamentos)
        const estimatedWrites = 1 + batch.animalIds.length;
        if (!canPerformOperation('write', estimatedWrites)) {
            throw new Error(`Quota insuficiente: esta operação requer ${estimatedWrites} escritas. Tente novamente amanhã.`);
        }

        // Mescla dados de conclusão (medicação, pesos, etc.)
        const mergedBatch = { ...batch, ...completionData };

        // Lookup O(1) para animais em vez de .find() repetido no loop
        const animalsMap = new Map<string, Animal>();
        for (const a of stateRef.current.animals) {
            animalsMap.set(a.id, a);
        }

        // Firestore WriteBatch suporta no máximo 500 operações
        const MAX_BATCH_OPS = 499; // 1 reservada para o lote
        const writeBatches: ReturnType<typeof db.batch>[] = [db.batch()];
        let currentBatchIdx = 0;
        let currentBatchOps = 0;
        let totalWriteCount = 0;
        const now = new Date();

        const getWriteBatch = () => {
            if (currentBatchOps >= MAX_BATCH_OPS) {
                writeBatches.push(db.batch());
                currentBatchIdx++;
                currentBatchOps = 0;
            }
            currentBatchOps++;
            totalWriteCount++;
            return writeBatches[currentBatchIdx];
        };

        // 1. Atualiza o status do lote para 'completed'
        // Persiste medicationData e weighingType/medicationSubType no lote para
        // que a visualização de lotes concluídos funcione após recarregar a página.
        // animalWeights NÃO é persistido (grande demais, já propagado nos animais).
        const batchRef = db.collection('batches').doc(batchId);
        const completedFields: Record<string, any> = {
            status: 'completed' as const,
            completedAt: now,
        };
        // Preserva weighingType, medicationSubType, medicationData e medicationDataList no lote
        if (completionData?.weighingType) {
            completedFields.weighingType = completionData.weighingType;
        }
        if (completionData?.medicationSubType) {
            completedFields.medicationSubType = completionData.medicationSubType;
        }
        if (completionData?.medicationData) {
            completedFields.medicationData = completionData.medicationData;
        }
        if (completionData?.medicationDataList) {
            completedFields.medicationDataList = completionData.medicationDataList;
        }
        const wb0 = getWriteBatch();
        wb0.update(batchRef, { ...convertDatesToTimestamps(completedFields), updatedAt: now });

        // Atualização otimista local mantém todos os dados para exibição imediata
        const localCompletedFields = {
            status: 'completed' as const,
            completedAt: now,
            ...(completionData ? removeUndefined(completionData) : {}),
        };
        dispatch({ type: 'LOCAL_UPDATE_BATCH', payload: { batchId, updatedData: localCompletedFields } });

        // 2. Sincroniza dados nos animais baseado no propósito do lote
        switch (mergedBatch.purpose) {
            case BatchPurpose.Venda: {
                for (const animalId of mergedBatch.animalIds) {
                    if (!animalsMap.has(animalId)) continue;

                    const wb = getWriteBatch();
                    const animalRef = db.collection('animals').doc(animalId);
                    wb.update(animalRef, { status: AnimalStatus.Vendido, updatedAt: now });

                    dispatch({
                        type: 'LOCAL_UPDATE_ANIMAL',
                        payload: { animalId, updatedData: { status: AnimalStatus.Vendido } }
                    });
                }
                break;
            }

            case BatchPurpose.Medicamentos:
            case BatchPurpose.Vacinacao:
            case BatchPurpose.Vermifugacao: {
                // Suporte a múltiplos medicamentos (medicationDataList) com fallback para legado (medicationData)
                const medList = mergedBatch.medicationDataList;
                const legacyMed = mergedBatch.medicationData;
                if (!medList?.length && !legacyMed) break;

                const defaultMotivo = mergedBatch.purpose === BatchPurpose.Medicamentos
                    ? (mergedBatch.medicationSubType || 'Medicamento')
                    : mergedBatch.purpose === BatchPurpose.Vacinacao ? 'Vacinação' : 'Vermifugação';

                // Resolve a lista de medicamentos
                const medications = medList && medList.length > 0
                    ? medList
                    : [{ ...legacyMed!, subType: undefined as any, responsavel: legacyMed!.responsavel }];

                // Monta array de MedicationItem[] para todos os medicamentos
                const medItems = medications.map(med => ({
                    medicamento: med.medicamento,
                    dose: med.dose,
                    unidade: med.unidade,
                }));

                // Motivo: concatena sub-tipos únicos ou usa o padrão
                const subTypes = medications
                    .map(m => m.subType)
                    .filter((s): s is string => !!s);
                const uniqueSubTypes = [...new Set(subTypes)];
                const motivo = uniqueSubTypes.length > 0
                    ? uniqueSubTypes.join(' / ')
                    : defaultMotivo;

                const responsavel = medications[0]?.responsavel || 'Equipe Campo';

                for (const animalId of mergedBatch.animalIds) {
                    const animal = animalsMap.get(animalId);
                    if (!animal) continue;

                    // Um único MedicationAdministration com todos os medicamentos
                    // Evita múltiplos arrayUnion no mesmo campo do mesmo doc no WriteBatch
                    const newMedRecord: MedicationAdministration = {
                        id: `batch_${batchId}_${animalId}`,
                        medicamentos: medItems,
                        dataAplicacao: now,
                        motivo,
                        responsavel,
                        // Campos legados: primeiro medicamento para compatibilidade
                        medicamento: medItems[0].medicamento,
                        dose: medItems[0].dose,
                        unidade: medItems[0].unidade,
                    };

                    const wb = getWriteBatch();
                    const animalRef = db.collection('animals').doc(animalId);
                    wb.update(animalRef, {
                        historicoSanitario: FieldValue.arrayUnion(convertDatesToTimestamps(newMedRecord)),
                        updatedAt: now
                    });

                    // Optimistic update local
                    const updatedHistorico = [...(animal.historicoSanitario || []), newMedRecord];
                    dispatch({
                        type: 'LOCAL_UPDATE_ANIMAL',
                        payload: { animalId, updatedData: { historicoSanitario: updatedHistorico } }
                    });
                }
                break;
            }

            case BatchPurpose.Pesagem: {
                if (!mergedBatch.animalWeights) break;

                const weighingTypeValue = mergedBatch.weighingType || WeighingType.None;

                for (const animalId of mergedBatch.animalIds) {
                    const weight = mergedBatch.animalWeights[animalId];
                    if (!weight || weight <= 0) continue;

                    const animal = animalsMap.get(animalId);
                    if (!animal) continue;

                    const newWeightEntry = {
                        id: `batch_${batchId}_${animalId}`,
                        date: now,
                        weightKg: weight,
                        type: weighingTypeValue,
                    };

                    // 🔧 OTIMIZAÇÃO: arrayUnion envia apenas o novo registro
                    const wb = getWriteBatch();
                    const animalRef = db.collection('animals').doc(animalId);
                    wb.update(animalRef, {
                        historicoPesagens: FieldValue.arrayUnion(convertDatesToTimestamps(newWeightEntry)),
                        pesoKg: weight,
                        updatedAt: now
                    });

                    const updatedPesagens = [...(animal.historicoPesagens || []), newWeightEntry];
                    dispatch({
                        type: 'LOCAL_UPDATE_ANIMAL',
                        payload: {
                            animalId,
                            updatedData: { historicoPesagens: updatedPesagens, pesoKg: weight }
                        }
                    });
                }
                break;
            }

            case BatchPurpose.Desmame: {
                if (!mergedBatch.animalWeights) break;

                for (const animalId of mergedBatch.animalIds) {
                    const weight = mergedBatch.animalWeights[animalId];
                    if (!weight || weight <= 0) continue;

                    const animal = animalsMap.get(animalId);
                    if (!animal) continue;

                    const newWeightEntry = {
                        id: `batch_${batchId}_${animalId}`,
                        date: now,
                        weightKg: weight,
                        type: WeighingType.Weaning,
                    };

                    // 🔧 OTIMIZAÇÃO: arrayUnion envia apenas o novo registro
                    const wb = getWriteBatch();
                    const animalRef = db.collection('animals').doc(animalId);
                    wb.update(animalRef, {
                        historicoPesagens: FieldValue.arrayUnion(convertDatesToTimestamps(newWeightEntry)),
                        pesoKg: weight,
                        updatedAt: now
                    });

                    const updatedPesagens = [...(animal.historicoPesagens || []), newWeightEntry];
                    dispatch({
                        type: 'LOCAL_UPDATE_ANIMAL',
                        payload: {
                            animalId,
                            updatedData: { historicoPesagens: updatedPesagens, pesoKg: weight }
                        }
                    });
                }
                break;
            }

            // Confinamento, Exposição, Apartação, Outros: sem mudanças nos animais
            default:
                break;
        }

        // 3. Commit de todas as escritas (múltiplos batches se > 500 ops)
        try {
            for (const wb of writeBatches) {
                await wb.commit();
            }
            trackWrites(totalWriteCount);

            // Atualiza caches locais
            await updateLocalCache('batches', stateRef.current.batches);
            await updateLocalCache('animals', stateRef.current.animals);
        } catch (error) {
            console.error("Erro ao completar lote com sincronização:", error);
            await forceSync();
            throw error;
        }
    }, [userId, db, updateLocalCache, forceSync]);

    // ============================================
    // 🔧 ESTAÇÃO DE MONTA (BREEDING SEASONS)
    // ============================================
    const createBreedingSeason = useCallback(async (seasonData: Omit<BreedingSeason, 'id'>) => {
        if (!userId || !db) return;

        const cleanedSeason = removeUndefined({ ...seasonData, userId });
        const dataWithTimestamp = convertDatesToTimestamps(cleanedSeason);

        try {
            const newDocRef = await db.collection('breeding_seasons').add({ ...dataWithTimestamp, updatedAt: new Date() });
            const newSeason: BreedingSeason = {
                id: newDocRef.id,
                ...seasonData
            } as BreedingSeason;

            // Atualização otimista
            dispatch({ type: 'LOCAL_ADD_BREEDING_SEASON', payload: newSeason });

            await updateLocalCache('breedingSeasons', [...stateRef.current.breedingSeasons, newSeason]);

            return newSeason;
        } catch (error) {
            console.error("Erro ao criar estação de monta:", error);
            await forceSync();
            throw error;
        }
    }, [userId, updateLocalCache, forceSync]);

    const updateBreedingSeason = useCallback(async (seasonId: string, updatedData: Partial<BreedingSeason>) => {
        if (!userId || !db) return;

        // Atualização otimista
        dispatch({ type: 'LOCAL_UPDATE_BREEDING_SEASON', payload: { seasonId, updatedData } });

        try {
            const seasonRef = db.collection('breeding_seasons').doc(seasonId);
            const cleanedData = removeUndefined(updatedData);
            const dataWithTimestamp = convertDatesToTimestamps(cleanedData);

            await seasonRef.update({ ...dataWithTimestamp, updatedAt: new Date() });

            const updatedSeasons = stateRef.current.breedingSeasons.map((s: BreedingSeason) =>
                s.id === seasonId ? { ...s, ...updatedData } : s
            );
            await updateLocalCache('breedingSeasons', updatedSeasons);
        } catch (error) {
            console.error("Erro ao atualizar estação de monta:", error);
            await forceSync();
            throw error;
        }
    }, [userId, updateLocalCache, forceSync]);

    const deleteBreedingSeason = useCallback(async (seasonId: string) => {
        if (!userId || !db) return;

        // Atualização otimista
        dispatch({ type: 'LOCAL_DELETE_BREEDING_SEASON', payload: { seasonId } });

        try {
            await db.collection('breeding_seasons').doc(seasonId).delete();

            const updatedSeasons = stateRef.current.breedingSeasons.filter((s: BreedingSeason) => s.id !== seasonId);
            await updateLocalCache('breedingSeasons', updatedSeasons);
        } catch (error) {
            console.error("Erro ao deletar estação de monta:", error);
            await forceSync();
            throw error;
        }
    }, [userId, updateLocalCache, forceSync]);

    // Adiciona cobertura a uma estação de monta
    // 🔧 INTEGRAÇÃO: Sincroniza automaticamente com historicoPrenhez do animal
    const addCoverageToSeason = useCallback(async (
        seasonId: string,
        coverage: Omit<CoverageRecord, 'id' | 'expectedCalvingDate'>
    ) => {
        if (!userId || !db) return;

        const season = stateRef.current.breedingSeasons.find((s: BreedingSeason) => s.id === seasonId);
        if (!season) {
            throw new Error('Estação de monta não encontrada');
        }

        // Calcula data prevista de parto (283 dias)
        const coverageDate = new Date(coverage.date);
        const expectedCalvingDate = new Date(coverageDate);
        expectedCalvingDate.setDate(expectedCalvingDate.getDate() + 283);

        const newCoverage: CoverageRecord = {
            ...coverage,
            id: `cov_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            expectedCalvingDate,
            pregnancyResult: coverage.pregnancyResult || 'pending',
        };

        const updatedCoverageRecords = [...(season.coverageRecords || []), newCoverage];

        // Auto-adiciona a vaca às expostas se não estiver
        const exposedCowIds = season.exposedCowIds || [];
        const needsExposedUpdate = !exposedCowIds.includes(coverage.cowId);
        const updatedExposedCowIds = needsExposedUpdate
            ? [...exposedCowIds, coverage.cowId]
            : exposedCowIds;

        await updateBreedingSeason(seasonId, {
            coverageRecords: updatedCoverageRecords,
            ...(needsExposedUpdate ? { exposedCowIds: updatedExposedCowIds } : {}),
        });

        // 🔧 INTEGRAÇÃO: Adiciona registro no historicoPrenhez do animal
        const animal = stateRef.current.animals.find((a: Animal) => a.id === coverage.cowId);
        if (animal) {
            const sireName = getCoverageSireName(coverage);

            const pregnancyRecord: PregnancyRecord = {
                id: newCoverage.id, // Usa mesmo ID para correlação
                date: coverageDate,
                type: PREGNANCY_TYPE_MAP[coverage.type] || PregnancyType.Monta,
                sireName,
                result: newCoverage.pregnancyResult || 'pending',
            };

            let updatedHistoricoPrenhez = [...(animal.historicoPrenhez || []), pregnancyRecord];

            // 🔧 SYNC REPASSE: Se repasse já vem habilitado na criação, cria registro no historicoPrenhez
            if (newCoverage.repasse?.enabled) {
                const repasseBulls = newCoverage.repasse.bulls || [];
                let repasseSireName = 'Touro de repasse';
                if (repasseBulls.length === 1) {
                    repasseSireName = repasseBulls[0].bullBrinco;
                } else if (repasseBulls.length > 1) {
                    repasseSireName = repasseBulls.map((b: { bullBrinco: string }) => b.bullBrinco).join(' / ') + ' (pendente)';
                } else if (newCoverage.repasse.bullBrinco) {
                    repasseSireName = newCoverage.repasse.bullBrinco;
                }
                const repasseDate = newCoverage.repasse.startDate
                    ? new Date(newCoverage.repasse.startDate)
                    : coverageDate;
                updatedHistoricoPrenhez = [...updatedHistoricoPrenhez, {
                    id: `repasse_${newCoverage.id}`,
                    date: repasseDate,
                    type: PregnancyType.Monta,
                    sireName: repasseSireName,
                    result: newCoverage.repasse.diagnosisResult || 'pending',
                }];
            }

            // Atualiza o animal com o novo registro
            const animalRef = db.collection('animals').doc(coverage.cowId);
            const dataWithTimestamp = convertDatesToTimestamps({ historicoPrenhez: updatedHistoricoPrenhez });
            await animalRef.update({ ...dataWithTimestamp, updatedAt: new Date() });

            // Atualização otimista local
            dispatch({
                type: 'LOCAL_UPDATE_ANIMAL', payload: {
                    animalId: coverage.cowId,
                    updatedData: { historicoPrenhez: updatedHistoricoPrenhez }
                }
            });

            // Atualiza cache local
            const updatedAnimals = stateRef.current.animals.map((a: Animal) =>
                a.id === coverage.cowId
                    ? { ...a, historicoPrenhez: updatedHistoricoPrenhez }
                    : a
            );
            await updateLocalCache('animals', updatedAnimals);

            // 🔧 FIV: Se for FIV e tiver doadora no plantel, atualiza o histórico de progênie da doadora
            if (coverage.type === 'fiv' && coverage.donorCowId) {
                const donorAnimal = stateRef.current.animals.find((a: Animal) => a.id === coverage.donorCowId);
                if (donorAnimal) {
                    // Registra na progênie da doadora que ela tem um embrião em gestação
                    const offspringRecord = {
                        id: `fiv_${newCoverage.id}`,
                        offspringBrinco: `Embriao (receptora: ${coverage.cowBrinco})`,
                        // Pesos serão preenchidos quando o bezerro nascer
                    };

                    const updatedHistoricoProgenie = [...(donorAnimal.historicoProgenie || []), offspringRecord];

                    const donorRef = db.collection('animals').doc(coverage.donorCowId);
                    const donorDataWithTimestamp = convertDatesToTimestamps({ historicoProgenie: updatedHistoricoProgenie });
                    await donorRef.update({ ...donorDataWithTimestamp, updatedAt: new Date() });

                    // Atualização otimista local para doadora
                    dispatch({
                        type: 'LOCAL_UPDATE_ANIMAL', payload: {
                            animalId: coverage.donorCowId,
                            updatedData: { historicoProgenie: updatedHistoricoProgenie }
                        }
                    });
                }
            }
        }

        return newCoverage;
    }, [userId, db, updateBreedingSeason, updateLocalCache]);

    // Atualiza resultado de diagnóstico de prenhez
    // 🔧 INTEGRAÇÃO: Se resultado for negativo, registra como "perda" no histórico do animal
    const updatePregnancyDiagnosis = useCallback(async (
        seasonId: string,
        coverageId: string,
        result: 'positive' | 'negative',
        checkDate: Date
    ) => {
        if (!userId || !db) return;

        const season = stateRef.current.breedingSeasons.find((s: BreedingSeason) => s.id === seasonId);
        if (!season) {
            throw new Error('Estação de monta não encontrada');
        }

        // Encontra a cobertura para obter o cowId
        const coverage = season.coverageRecords.find((c: CoverageRecord) => c.id === coverageId);
        if (!coverage) {
            throw new Error('Cobertura não encontrada');
        }

        const updatedCoverageRecords = season.coverageRecords.map((c: CoverageRecord) =>
            c.id === coverageId
                ? { ...c, pregnancyResult: result, pregnancyCheckDate: checkDate }
                : c
        );

        await updateBreedingSeason(seasonId, {
            coverageRecords: updatedCoverageRecords,
        });

        // 🔧 SYNC: Atualiza result no historicoPrenhez do animal
        const animal = stateRef.current.animals.find((a: Animal) => a.id === coverage.cowId);
        if (animal) {
            const animalUpdates: Record<string, unknown> = {};

            // Atualiza o resultado no registro de prenhez
            const updatedHistoricoPrenhez = (animal.historicoPrenhez || []).map((r: PregnancyRecord) =>
                r.id === coverageId ? { ...r, result } : r
            );
            animalUpdates.historicoPrenhez = updatedHistoricoPrenhez;

            // 🔧 INTEGRAÇÃO: Se DG negativo E o resultado anterior era 'positive', é perda gestacional
            // Nota: DG negativo de primeiro diagnóstico (pending -> negative) = vazia, NÃO é aborto
            const previousResult = coverage.pregnancyResult;
            if (result === 'negative' && previousResult === 'positive') {
                const abortionRecord = {
                    id: `abort_${coverageId}`,
                    date: checkDate,
                };
                animalUpdates.historicoAborto = [...(animal.historicoAborto || []), abortionRecord];
            }

            const animalRef = db.collection('animals').doc(coverage.cowId);
            const dataWithTimestamp = convertDatesToTimestamps(animalUpdates);
            await animalRef.update({ ...dataWithTimestamp, updatedAt: new Date() });

            dispatch({
                type: 'LOCAL_UPDATE_ANIMAL', payload: {
                    animalId: coverage.cowId,
                    updatedData: animalUpdates
                }
            });

            const updatedAnimals = stateRef.current.animals.map((a: Animal) =>
                a.id === coverage.cowId
                    ? { ...a, ...animalUpdates }
                    : a
            );
            await updateLocalCache('animals', updatedAnimals);
        }
    }, [userId, db, updateBreedingSeason, updateLocalCache]);

    // Atualiza uma cobertura existente na estação de monta
    // 🔧 INTEGRAÇÃO: Sincroniza alterações com historicoPrenhez, historicoAborto e historicoProgenie
    const updateCoverageInSeason = useCallback(async (
        seasonId: string,
        coverageId: string,
        updatedCoverageData: Partial<CoverageRecord>
    ) => {
        if (!userId || !db) return;

        const season = stateRef.current.breedingSeasons.find((s: BreedingSeason) => s.id === seasonId);
        if (!season) throw new Error('Estação de monta não encontrada');

        const oldCoverage = season.coverageRecords.find((c: CoverageRecord) => c.id === coverageId);
        if (!oldCoverage) throw new Error('Cobertura não encontrada');

        // Recalcula expectedCalvingDate se a data mudou
        let computedFields: Partial<CoverageRecord> = {};
        if (updatedCoverageData.date) {
            const newDate = new Date(updatedCoverageData.date);
            const expCalving = new Date(newDate);
            expCalving.setDate(expCalving.getDate() + 283);
            computedFields.expectedCalvingDate = expCalving;
        }

        const updatedCoverage = { ...oldCoverage, ...updatedCoverageData, ...computedFields };

        const updatedCoverageRecords = season.coverageRecords.map((c: CoverageRecord) =>
            c.id === coverageId ? updatedCoverage : c
        );

        await updateBreedingSeason(seasonId, { coverageRecords: updatedCoverageRecords });

        // 🔧 SYNC: Atualiza historicoPrenhez do animal
        const animal = stateRef.current.animals.find((a: Animal) => a.id === oldCoverage.cowId);
        if (animal) {
            const sireName = getCoverageSireName(updatedCoverage);
            const coverageDate = new Date(updatedCoverage.date);

            // Atualiza registro da cobertura principal
            const mainResult = updatedCoverage.pregnancyResult || 'pending';
            let updatedHistoricoPrenhez = (animal.historicoPrenhez || []).map((r: PregnancyRecord) =>
                r.id === coverageId
                    ? { ...r, date: coverageDate, type: PREGNANCY_TYPE_MAP[updatedCoverage.type] || PregnancyType.Monta, sireName, result: mainResult }
                    : r
            );

            // Se não encontrou o registro (pode ser caso antigo), adiciona
            if (!updatedHistoricoPrenhez.find((r: PregnancyRecord) => r.id === coverageId)) {
                updatedHistoricoPrenhez = [...updatedHistoricoPrenhez, {
                    id: coverageId,
                    date: coverageDate,
                    type: PREGNANCY_TYPE_MAP[updatedCoverage.type] || PregnancyType.Monta,
                    sireName,
                    result: mainResult,
                }];
            }

            // 🔧 SYNC REPASSE: Gerencia registro de repasse no historicoPrenhez
            const repasseRecordId = `repasse_${coverageId}`;
            const oldRepasseEnabled = oldCoverage.repasse?.enabled;
            const newRepasseEnabled = updatedCoverage.repasse?.enabled;

            if (newRepasseEnabled) {
                // Monta o nome do reprodutor do repasse
                const repasseBulls = updatedCoverage.repasse?.bulls || [];
                const confirmedSire = updatedCoverage.repasse?.confirmedSireBrinco;
                let repasseSireName = 'Touro de repasse';
                if (confirmedSire) {
                    repasseSireName = confirmedSire;
                } else if (repasseBulls.length === 1) {
                    repasseSireName = repasseBulls[0].bullBrinco;
                } else if (repasseBulls.length > 1) {
                    repasseSireName = repasseBulls.map((b: { bullBrinco: string }) => b.bullBrinco).join(' / ') + ' (pendente)';
                } else if (updatedCoverage.repasse?.bullBrinco) {
                    repasseSireName = updatedCoverage.repasse.bullBrinco;
                }

                const repasseDate = updatedCoverage.repasse?.startDate
                    ? new Date(updatedCoverage.repasse.startDate)
                    : coverageDate;

                const repasseResult = updatedCoverage.repasse?.diagnosisResult || 'pending';
                const existingRepasseIdx = updatedHistoricoPrenhez.findIndex((r: PregnancyRecord) => r.id === repasseRecordId);
                if (existingRepasseIdx >= 0) {
                    updatedHistoricoPrenhez[existingRepasseIdx] = {
                        ...updatedHistoricoPrenhez[existingRepasseIdx],
                        date: repasseDate,
                        type: PregnancyType.Monta,
                        sireName: repasseSireName,
                        result: repasseResult,
                    };
                } else {
                    updatedHistoricoPrenhez = [...updatedHistoricoPrenhez, {
                        id: repasseRecordId,
                        date: repasseDate,
                        type: PregnancyType.Monta,
                        sireName: repasseSireName,
                        result: repasseResult,
                    }];
                }
            } else if (oldRepasseEnabled && !newRepasseEnabled) {
                // Repasse foi desabilitado: remove registro de repasse
                updatedHistoricoPrenhez = updatedHistoricoPrenhez.filter(
                    (r: PregnancyRecord) => r.id !== repasseRecordId
                );
            }

            const animalRef = db.collection('animals').doc(oldCoverage.cowId);
            let animalUpdates: Record<string, unknown> = { historicoPrenhez: updatedHistoricoPrenhez };

            // 🔧 SYNC: Diagnóstico da cobertura principal: só registra aborto se era positive e virou negative (perda gestacional)
            // Nota: pending -> negative = vazia, NÃO é aborto
            const oldResult = oldCoverage.pregnancyResult;
            const newResult = updatedCoverageData.pregnancyResult;
            let currentAborto = [...(animal.historicoAborto || [])];

            if (newResult === 'negative' && oldResult === 'positive') {
                const abortionRecord = { id: `abort_${coverageId}`, date: updatedCoverageData.pregnancyCheckDate || new Date() };
                currentAborto = [...currentAborto, abortionRecord];
            }
            // 🔧 SYNC: Diagnóstico mudou DE negativo para outro -> remove do historicoAborto
            if (oldResult === 'negative' && newResult && newResult !== 'negative') {
                currentAborto = currentAborto.filter(
                    (r: AbortionRecord) => r.id !== `abort_${coverageId}`
                );
            }

            // 🔧 SYNC: Diagnóstico do repasse mudou (só aborto se positive -> negative)
            const oldRepasseResult = oldCoverage.repasse?.diagnosisResult;
            const newRepasse = updatedCoverageData.repasse;
            const newRepasseResult = newRepasse?.diagnosisResult;
            if (newRepasseResult === 'negative' && oldRepasseResult === 'positive') {
                const abortionRecord = { id: `abort_repasse_${coverageId}`, date: newRepasse?.diagnosisDate || new Date() };
                currentAborto = [...currentAborto, abortionRecord];
            }
            if (oldRepasseResult === 'negative' && newRepasseResult && newRepasseResult !== 'negative') {
                currentAborto = currentAborto.filter(
                    (r: AbortionRecord) => r.id !== `abort_repasse_${coverageId}`
                );
            }

            // Só inclui historicoAborto nos updates se houve alteração
            if (currentAborto.length !== (animal.historicoAborto || []).length ||
                JSON.stringify(currentAborto) !== JSON.stringify(animal.historicoAborto || [])) {
                animalUpdates.historicoAborto = currentAborto;
            }

            const dataWithTimestamp = convertDatesToTimestamps(animalUpdates);
            await animalRef.update({ ...dataWithTimestamp, updatedAt: new Date() });

            dispatch({ type: 'LOCAL_UPDATE_ANIMAL', payload: { animalId: oldCoverage.cowId, updatedData: animalUpdates } });

            const updatedAnimals = stateRef.current.animals.map((a: Animal) =>
                a.id === oldCoverage.cowId ? { ...a, ...animalUpdates } : a
            );
            await updateLocalCache('animals', updatedAnimals);

            // 🔧 FIV: Se doadora mudou, atualiza progênie
            if (updatedCoverageData.donorCowId !== undefined && oldCoverage.donorCowId !== updatedCoverageData.donorCowId) {
                // Remove da doadora antiga
                if (oldCoverage.donorCowId) {
                    const oldDonor = stateRef.current.animals.find((a: Animal) => a.id === oldCoverage.donorCowId);
                    if (oldDonor) {
                        const cleanedProgenie = (oldDonor.historicoProgenie || []).filter(
                            (r: { id: string }) => r.id !== `fiv_${coverageId}`
                        );
                        const oldDonorRef = db.collection('animals').doc(oldCoverage.donorCowId);
                        await oldDonorRef.update({ ...convertDatesToTimestamps({ historicoProgenie: cleanedProgenie }), updatedAt: new Date() });
                        dispatch({ type: 'LOCAL_UPDATE_ANIMAL', payload: { animalId: oldCoverage.donorCowId, updatedData: { historicoProgenie: cleanedProgenie } } });
                    }
                }
                // Adiciona à nova doadora
                if (updatedCoverageData.donorCowId) {
                    const newDonor = stateRef.current.animals.find((a: Animal) => a.id === updatedCoverageData.donorCowId);
                    if (newDonor) {
                        const offspringRecord = { id: `fiv_${coverageId}`, offspringBrinco: `Embriao (receptora: ${updatedCoverage.cowBrinco})` };
                        const newProgenie = [...(newDonor.historicoProgenie || []), offspringRecord];
                        const newDonorRef = db.collection('animals').doc(updatedCoverageData.donorCowId);
                        await newDonorRef.update({ ...convertDatesToTimestamps({ historicoProgenie: newProgenie }), updatedAt: new Date() });
                        dispatch({ type: 'LOCAL_UPDATE_ANIMAL', payload: { animalId: updatedCoverageData.donorCowId, updatedData: { historicoProgenie: newProgenie } } });
                    }
                }
            }
        }
    }, [userId, db, updateBreedingSeason, updateLocalCache]);

    // Remove uma cobertura da estação e limpa registros sincronizados
    const deleteCoverageFromSeason = useCallback(async (
        seasonId: string,
        coverageId: string
    ) => {
        if (!userId || !db) return;

        const season = stateRef.current.breedingSeasons.find((s: BreedingSeason) => s.id === seasonId);
        if (!season) throw new Error('Estação de monta não encontrada');

        const coverage = season.coverageRecords.find((c: CoverageRecord) => c.id === coverageId);
        if (!coverage) throw new Error('Cobertura não encontrada');

        // Remove a cobertura da estação
        const updatedCoverageRecords = season.coverageRecords.filter((c: CoverageRecord) => c.id !== coverageId);
        await updateBreedingSeason(seasonId, { coverageRecords: updatedCoverageRecords });

        // 🔧 SYNC: Limpa registros do animal
        const animal = stateRef.current.animals.find((a: Animal) => a.id === coverage.cowId);
        if (animal) {
            const animalUpdates: Record<string, unknown> = {};

            // Remove do historicoPrenhez (cobertura principal + repasse)
            animalUpdates.historicoPrenhez = (animal.historicoPrenhez || []).filter(
                (r: PregnancyRecord) => r.id !== coverageId && r.id !== `repasse_${coverageId}`
            );

            // Remove do historicoAborto: limpa qualquer registro de aborto vinculado a esta cobertura
            // (independente do resultado atual, pois pode ter sido editado antes da exclusão)
            const cleanedAborto = (animal.historicoAborto || []).filter(
                (r: AbortionRecord) => r.id !== `abort_${coverageId}` && r.id !== `abort_repasse_${coverageId}`
            );
            if (cleanedAborto.length !== (animal.historicoAborto || []).length) {
                animalUpdates.historicoAborto = cleanedAborto;
            }

            const animalRef = db.collection('animals').doc(coverage.cowId);
            const dataWithTimestamp = convertDatesToTimestamps(animalUpdates);
            await animalRef.update({ ...dataWithTimestamp, updatedAt: new Date() });

            dispatch({ type: 'LOCAL_UPDATE_ANIMAL', payload: { animalId: coverage.cowId, updatedData: animalUpdates } });

            const updatedAnimals = stateRef.current.animals.map((a: Animal) =>
                a.id === coverage.cowId ? { ...a, ...animalUpdates } : a
            );
            await updateLocalCache('animals', updatedAnimals);
        }

        // 🔧 FIV: Limpa progênie da doadora
        if (coverage.type === 'fiv' && coverage.donorCowId) {
            const donor = stateRef.current.animals.find((a: Animal) => a.id === coverage.donorCowId);
            if (donor) {
                const cleanedProgenie = (donor.historicoProgenie || []).filter(
                    (r: { id: string }) => r.id !== `fiv_${coverageId}`
                );
                const donorRef = db.collection('animals').doc(coverage.donorCowId);
                await donorRef.update({ ...convertDatesToTimestamps({ historicoProgenie: cleanedProgenie }), updatedAt: new Date() });
                dispatch({ type: 'LOCAL_UPDATE_ANIMAL', payload: { animalId: coverage.donorCowId, updatedData: { historicoProgenie: cleanedProgenie } } });
            }
        }
    }, [userId, db, updateBreedingSeason, updateLocalCache]);

    // Confirma a paternidade (quando 2 touros foram usados)
    // Suporta tanto repasse quanto monta natural direta com 2 touros
    // Atualiza o confirmedSireId e sincroniza o historicoPrenhez do animal
    const confirmPaternity = useCallback(async (
        seasonId: string,
        coverageId: string,
        confirmedBullId: string,
        confirmedBullBrinco: string
    ) => {
        if (!userId || !db) return;

        const season = stateRef.current.breedingSeasons.find((s: BreedingSeason) => s.id === seasonId);
        if (!season) throw new Error('Estação de monta não encontrada');

        const coverage = season.coverageRecords.find((c: CoverageRecord) => c.id === coverageId);
        if (!coverage) throw new Error('Cobertura não encontrada');

        // Detecta se é confirmação da cobertura principal (natural com 2 touros) ou do repasse
        const isMainCoveragePaternity = coverage.type === 'natural'
            && coverage.bulls && coverage.bulls.length > 1
            && !coverage.confirmedSireId;

        const isRepassePaternity = coverage.repasse?.enabled
            && coverage.repasse.bulls && coverage.repasse.bulls.length > 1
            && !coverage.repasse.confirmedSireId;

        if (!isMainCoveragePaternity && !isRepassePaternity) {
            throw new Error('Nenhuma paternidade pendente encontrada');
        }

        let updatedCoverageData: Partial<CoverageRecord> = {};

        if (isMainCoveragePaternity) {
            // Confirma paternidade da cobertura principal (monta natural direta)
            updatedCoverageData = {
                confirmedSireId: confirmedBullId,
                confirmedSireBrinco: confirmedBullBrinco,
            };
        } else {
            // Confirma paternidade do repasse
            updatedCoverageData = {
                repasse: {
                    ...coverage.repasse!,
                    confirmedSireId: confirmedBullId,
                    confirmedSireBrinco: confirmedBullBrinco,
                },
            };
        }

        const updatedCoverageRecords = season.coverageRecords.map((c: CoverageRecord) =>
            c.id === coverageId ? { ...c, ...updatedCoverageData } : c
        );

        await updateBreedingSeason(seasonId, { coverageRecords: updatedCoverageRecords });

        // SYNC: Atualiza sireName no historicoPrenhez do animal
        const animal = stateRef.current.animals.find((a: Animal) => a.id === coverage.cowId);
        if (animal) {
            const targetRecordId = isMainCoveragePaternity ? coverageId : `repasse_${coverageId}`;
            const updatedHistoricoPrenhez = (animal.historicoPrenhez || []).map((r: PregnancyRecord) => {
                if (r.id === targetRecordId) {
                    return { ...r, sireName: confirmedBullBrinco };
                }
                return r;
            });

            const animalRef = db.collection('animals').doc(coverage.cowId);
            const dataWithTimestamp = convertDatesToTimestamps({ historicoPrenhez: updatedHistoricoPrenhez });
            await animalRef.update({ ...dataWithTimestamp, updatedAt: new Date() });

            dispatch({ type: 'LOCAL_UPDATE_ANIMAL', payload: { animalId: coverage.cowId, updatedData: { historicoPrenhez: updatedHistoricoPrenhez } } });

            const updatedAnimals = stateRef.current.animals.map((a: Animal) =>
                a.id === coverage.cowId ? { ...a, historicoPrenhez: updatedHistoricoPrenhez } : a
            );
            await updateLocalCache('animals', updatedAnimals);
        }
    }, [userId, db, updateBreedingSeason, updateLocalCache]);

    // ============================================
    // 🔧 VERIFICAÇÃO DE PARTOS E REGISTRO DE ABORTOS
    // ============================================

    /**
     * Registra um aborto para uma cobertura específica.
     * Atualiza a cobertura na estação de monta e o historicoAborto do animal.
     */
    const registerAbortion = useCallback(async (
        seasonId: string,
        coverageId: string,
        isRepasse: boolean,
        abortionDate?: Date,
        notes?: string
    ) => {
        if (!userId || !db) return;

        const season = stateRef.current.breedingSeasons.find((s: BreedingSeason) => s.id === seasonId);
        if (!season) throw new Error('Estação de monta não encontrada');

        const coverage = season.coverageRecords.find((c: CoverageRecord) => c.id === coverageId);
        if (!coverage) throw new Error('Cobertura não encontrada');

        const effectiveAbortionDate = abortionDate || new Date();

        // Atualiza a cobertura
        let updatedCoverage: CoverageRecord;
        if (isRepasse && coverage.repasse) {
            updatedCoverage = {
                ...coverage,
                repasse: {
                    ...coverage.repasse,
                    calvingResult: 'aborto',
                    calvingNotes: notes,
                },
            };
        } else {
            updatedCoverage = {
                ...coverage,
                calvingResult: 'aborto',
                calvingNotes: notes,
            };
        }

        const updatedCoverageRecords = season.coverageRecords.map((c: CoverageRecord) =>
            c.id === coverageId ? updatedCoverage : c
        );

        await updateBreedingSeason(seasonId, { coverageRecords: updatedCoverageRecords });

        // Atualiza o historicoAborto do animal
        const animal = stateRef.current.animals.find((a: Animal) => a.id === coverage.cowId);
        if (animal) {
            const newAbortionRecord: AbortionRecord = {
                id: `abort_${coverageId}${isRepasse ? '_repasse' : ''}`,
                date: effectiveAbortionDate,
            };

            const existingAbortions = animal.historicoAborto || [];
            // Verifica se já existe um registro para esta cobertura
            const alreadyExists = existingAbortions.some((a: AbortionRecord) => a.id === newAbortionRecord.id);

            if (!alreadyExists) {
                const updatedHistoricoAborto = [...existingAbortions, newAbortionRecord];

                const animalRef = db.collection('animals').doc(coverage.cowId);
                await animalRef.update({
                    historicoAborto: convertDatesToTimestamps(updatedHistoricoAborto),
                    updatedAt: new Date()
                });

                dispatch({
                    type: 'LOCAL_UPDATE_ANIMAL',
                    payload: { animalId: coverage.cowId, updatedData: { historicoAborto: updatedHistoricoAborto } }
                });

                const updatedAnimals = stateRef.current.animals.map((a: Animal) =>
                    a.id === coverage.cowId ? { ...a, historicoAborto: updatedHistoricoAborto } : a
                );
                await updateLocalCache('animals', updatedAnimals);
            }
        }

        console.log(`✅ [ABORTION] Aborto registrado: Vaca ${coverage.cowBrinco}, Cobertura ${coverageId}${isRepasse ? ' (repasse)' : ''}`);
    }, [userId, db, updateBreedingSeason, updateLocalCache]);

    /**
     * Registra que um parto foi realizado para uma cobertura específica.
     * Vincula o terneiro à cobertura.
     */
    const registerCalving = useCallback(async (
        seasonId: string,
        coverageId: string,
        isRepasse: boolean,
        calfId: string,
        calfBrinco: string,
        actualCalvingDate?: Date
    ) => {
        if (!userId || !db) return;

        const season = stateRef.current.breedingSeasons.find((s: BreedingSeason) => s.id === seasonId);
        if (!season) throw new Error('Estação de monta não encontrada');

        const coverage = season.coverageRecords.find((c: CoverageRecord) => c.id === coverageId);
        if (!coverage) throw new Error('Cobertura não encontrada');

        // Atualiza a cobertura
        let updatedCoverage: CoverageRecord;
        if (isRepasse && coverage.repasse) {
            updatedCoverage = {
                ...coverage,
                repasse: {
                    ...coverage.repasse,
                    calvingResult: 'realizado',
                    calfId,
                    calfBrinco,
                    actualCalvingDate: actualCalvingDate || new Date(),
                },
            };
        } else {
            updatedCoverage = {
                ...coverage,
                calvingResult: 'realizado',
                calfId,
                calfBrinco,
                actualCalvingDate: actualCalvingDate || new Date(),
            };
        }

        const updatedCoverageRecords = season.coverageRecords.map((c: CoverageRecord) =>
            c.id === coverageId ? updatedCoverage : c
        );

        await updateBreedingSeason(seasonId, { coverageRecords: updatedCoverageRecords });

        console.log(`✅ [CALVING] Parto registrado: Vaca ${coverage.cowBrinco}, Terneiro ${calfBrinco}`);
    }, [userId, db, updateBreedingSeason]);

    /**
     * Verifica todas as coberturas com DG positivo e registra abortos automaticamente
     * para aquelas que não tiveram terneiros nascidos após a data prevista + tolerância.
     *
     * 🔧 NOVO: Também detecta vacas expostas SEM cobertura registrada que tiveram bezerros,
     * criando registros de cobertura retroativos e atualizando métricas da estação.
     *
     * 🔧 NOVO: Se fornecida bullSwitchDate, confirma automaticamente a paternidade em
     * coberturas com 2 touros baseado na data estimada de cobertura vs data de troca.
     *
     * @param seasonId - ID da estação de monta
     * @param toleranceDays - Dias de tolerância após data prevista de parto
     * @param bullSwitchDate - Data de troca de touros (para confirmação automática de paternidade)
     * @returns Estatísticas da verificação
     */
    const verifyAndRegisterAbortions = useCallback(async (
        seasonId: string,
        toleranceDays: number = 30,
        bullSwitchConfigs?: BullSwitchConfig[]
    ): Promise<{ registered: number; linked: number; pending: number; discovered: number; paternityConfirmed: number }> => {
        if (!userId || !db) return { registered: 0, linked: 0, pending: 0, discovered: 0, paternityConfirmed: 0 };

        const season = stateRef.current.breedingSeasons.find((s: BreedingSeason) => s.id === seasonId);
        if (!season) throw new Error('Estação de monta não encontrada');

        const animals = stateRef.current.animals;
        const today = new Date();
        let registeredCount = 0;
        let linkedCount = 0;
        let pendingCount = 0;
        let discoveredCount = 0; // Partos descobertos de vacas expostas sem cobertura
        let paternityConfirmedCount = 0; // Paternidades confirmadas automaticamente

        const updatedCoverageRecords = [...season.coverageRecords];
        const animalUpdates: Map<string, { historicoAborto?: AbortionRecord[] }> = new Map();
        // 🔧 SYNC: Rastreia bezerros que precisam ter paternidade atualizada
        const calfPaternityUpdates: Map<string, { paiId: string; paiNome: string }> = new Map();

        // 🔧 Cria Map de configurações de troca de touros por cobertura para acesso rápido
        // Chave: coverageId para cobertura principal, coverageId_repasse para repasse
        const switchConfigMap = new Map<string, BullSwitchConfig>();
        if (bullSwitchConfigs) {
            for (const config of bullSwitchConfigs) {
                const key = config.isRepasse ? `${config.coverageId}_repasse` : config.coverageId;
                switchConfigMap.set(key, config);
            }
        }

        // Rastreia terneiros já vinculados para evitar duplicatas
        const alreadyLinkedCalfIds = new Set<string>();

        // Primeiro, coleta IDs de terneiros já vinculados em coberturas existentes (desta e outras estações)
        for (const s of stateRef.current.breedingSeasons) {
            for (const c of (s.coverageRecords || [])) {
                if (c.calfId) alreadyLinkedCalfIds.add(c.calfId);
                if (c.repasse?.calfId) alreadyLinkedCalfIds.add(c.repasse.calfId);
            }
        }

        for (let i = 0; i < updatedCoverageRecords.length; i++) {
            const coverage = updatedCoverageRecords[i];

            // Verifica cobertura principal com DG positivo
            if (coverage.pregnancyResult === 'positive' && coverage.expectedCalvingDate && !coverage.calvingResult) {
                const expectedDate = new Date(coverage.expectedCalvingDate);
                const deadlineDate = new Date(expectedDate);
                deadlineDate.setDate(deadlineDate.getDate() + toleranceDays);

                // Busca terneiro (excluindo os já vinculados)
                // 🔧 FIV: Passa o tipo de cobertura e ID da doadora para diferenciar filhos diretos de embriões
                const calf = findCalfForCoverageInternal(
                    animals,
                    coverage.cowId,
                    expectedDate,
                    toleranceDays,
                    alreadyLinkedCalfIds,
                    coverage.type,
                    coverage.donorCowId // ID da doadora para FIV
                );

                if (calf) {
                    // 🔧 PATERNIDADE: Se tem 2 touros e configuração de troca, confirma automaticamente
                    let confirmedSireId = coverage.confirmedSireId;
                    let confirmedSireBrinco = coverage.confirmedSireBrinco;

                    // Verifica se precisa confirmar paternidade (2 touros sem confirmação)
                    const hasTwoBulls = coverage.bulls && coverage.bulls.length === 2;
                    // Busca configuração específica para esta cobertura
                    const switchConfig = switchConfigMap.get(coverage.id);
                    const hasConfig = switchConfig && (switchConfig.switchDate || switchConfig.selectedBullIndex !== undefined);
                    const needsPaternityConfirmation = hasTwoBulls && !confirmedSireId && hasConfig;

                    if (needsPaternityConfirmation && coverage.bulls && switchConfig) {
                        let selectedBull;

                        // Se tem índice de touro selecionado diretamente, usa ele
                        if (switchConfig.selectedBullIndex !== undefined) {
                            selectedBull = coverage.bulls[switchConfig.selectedBullIndex];
                            console.log(`🧬 [PATERNITY] Paternidade confirmada por seleção direta: Vaca ${coverage.cowBrinco} → Pai ${selectedBull.bullBrinco} (touro ${switchConfig.selectedBullIndex + 1})`);
                        } else if (switchConfig.switchDate) {
                            // Calcula baseado na data de troca
                            const bullSwitchTime = new Date(switchConfig.switchDate).getTime();
                            const calfBirthTime = calf.dataNascimento ? new Date(calf.dataNascimento).getTime() : expectedDate.getTime();
                            const estimatedCoverageTime = calfBirthTime - (283 * 24 * 60 * 60 * 1000);

                            // Se a cobertura foi ANTES da data de troca, o pai é o primeiro touro
                            // Se foi DEPOIS, o pai é o segundo touro
                            selectedBull = estimatedCoverageTime < bullSwitchTime
                                ? coverage.bulls[0]
                                : coverage.bulls[1];

                            console.log(`🧬 [PATERNITY] Paternidade confirmada por data de troca: Vaca ${coverage.cowBrinco} → Pai ${selectedBull.bullBrinco} (cobertura ${estimatedCoverageTime < bullSwitchTime ? 'antes' : 'depois'} da troca)`);
                        }

                        if (selectedBull) {
                            confirmedSireId = selectedBull.bullId;
                            confirmedSireBrinco = selectedBull.bullBrinco;
                            paternityConfirmedCount++;

                            // 🔧 SYNC: Registra atualização de paternidade para o bezerro
                            if (confirmedSireId && confirmedSireBrinco) {
                                calfPaternityUpdates.set(calf.id, {
                                    paiId: confirmedSireId,
                                    paiNome: confirmedSireBrinco
                                });
                            }
                        }
                    }

                    // Vincula o terneiro à cobertura
                    updatedCoverageRecords[i] = {
                        ...coverage,
                        calvingResult: 'realizado',
                        calfId: calf.id,
                        calfBrinco: calf.brinco,
                        actualCalvingDate: calf.dataNascimento || new Date(),
                        // Adiciona confirmação de paternidade se calculada
                        ...(confirmedSireId ? { confirmedSireId, confirmedSireBrinco } : {}),
                    };
                    // Marca o terneiro como vinculado para evitar duplicatas
                    alreadyLinkedCalfIds.add(calf.id);
                    linkedCount++;
                } else if (today > deadlineDate) {
                    // Registra aborto
                    updatedCoverageRecords[i] = {
                        ...coverage,
                        calvingResult: 'aborto',
                        calvingNotes: 'Registrado automaticamente - sem terneiro cadastrado após período previsto',
                    };

                    // Prepara atualização do historicoAborto
                    const animal = animals.find((a: Animal) => a.id === coverage.cowId);
                    if (animal) {
                        const existing = animalUpdates.get(animal.id) || { historicoAborto: [...(animal.historicoAborto || [])] };
                        const abortionId = `abort_${coverage.id}`;
                        if (!existing.historicoAborto!.some((a: AbortionRecord) => a.id === abortionId)) {
                            existing.historicoAborto!.push({ id: abortionId, date: expectedDate });
                            animalUpdates.set(animal.id, existing);
                        }
                    }
                    registeredCount++;
                } else {
                    pendingCount++;
                }
            }

            // Verifica repasse com DG positivo (só processa se cobertura principal foi negativa)
            if (coverage.repasse?.enabled && coverage.repasse.diagnosisResult === 'positive' && coverage.pregnancyResult === 'negative' && !coverage.repasse.calvingResult) {
                const repasseStartDate = coverage.repasse.startDate || coverage.date;
                const expectedDate = new Date(repasseStartDate);
                expectedDate.setDate(expectedDate.getDate() + 283);
                const deadlineDate = new Date(expectedDate);
                deadlineDate.setDate(deadlineDate.getDate() + toleranceDays);

                // Busca terneiro (excluindo os já vinculados)
                // 🔧 Repasse é sempre monta natural - busca filho direto (não FIV)
                const calf = findCalfForCoverageInternal(
                    animals,
                    coverage.cowId,
                    expectedDate,
                    toleranceDays,
                    alreadyLinkedCalfIds,
                    CoverageTypes.MontaNatural // Repasse é sempre monta natural
                );

                if (calf) {
                    // 🔧 PATERNIDADE: Se repasse tem 2 touros e configuração de troca, confirma automaticamente
                    let confirmedSireId = coverage.repasse?.confirmedSireId;
                    let confirmedSireBrinco = coverage.repasse?.confirmedSireBrinco;

                    // Verifica se precisa confirmar paternidade no repasse (2 touros sem confirmação)
                    const repasseBulls = coverage.repasse?.bulls;
                    const hasTwoBulls = repasseBulls && repasseBulls.length === 2;
                    // Busca configuração específica para o repasse (chave com _repasse)
                    const repasseSwitchConfig = switchConfigMap.get(`${coverage.id}_repasse`);
                    const hasConfig = repasseSwitchConfig && (repasseSwitchConfig.switchDate || repasseSwitchConfig.selectedBullIndex !== undefined);
                    const needsPaternityConfirmation = hasTwoBulls && !confirmedSireId && hasConfig;

                    if (needsPaternityConfirmation && repasseBulls && repasseSwitchConfig) {
                        let selectedBull;

                        // Se tem índice de touro selecionado diretamente, usa ele
                        if (repasseSwitchConfig.selectedBullIndex !== undefined) {
                            selectedBull = repasseBulls[repasseSwitchConfig.selectedBullIndex];
                            console.log(`🧬 [PATERNITY] Paternidade do repasse confirmada por seleção direta: Vaca ${coverage.cowBrinco} → Pai ${selectedBull.bullBrinco} (touro ${repasseSwitchConfig.selectedBullIndex + 1})`);
                        } else if (repasseSwitchConfig.switchDate) {
                            // Calcula baseado na data de troca
                            const bullSwitchTime = new Date(repasseSwitchConfig.switchDate).getTime();
                            const calfBirthTime = calf.dataNascimento ? new Date(calf.dataNascimento).getTime() : expectedDate.getTime();
                            const estimatedCoverageTime = calfBirthTime - (283 * 24 * 60 * 60 * 1000);

                            // Se a cobertura foi ANTES da data de troca, o pai é o primeiro touro
                            // Se foi DEPOIS, o pai é o segundo touro
                            selectedBull = estimatedCoverageTime < bullSwitchTime
                                ? repasseBulls[0]
                                : repasseBulls[1];

                            console.log(`🧬 [PATERNITY] Paternidade do repasse confirmada por data de troca: Vaca ${coverage.cowBrinco} → Pai ${selectedBull.bullBrinco}`);
                        }

                        if (selectedBull) {
                            confirmedSireId = selectedBull.bullId;
                            confirmedSireBrinco = selectedBull.bullBrinco;
                            paternityConfirmedCount++;

                            // 🔧 SYNC: Registra atualização de paternidade para o bezerro do repasse
                            if (confirmedSireId && confirmedSireBrinco) {
                                calfPaternityUpdates.set(calf.id, {
                                    paiId: confirmedSireId,
                                    paiNome: confirmedSireBrinco
                                });
                            }
                        }
                    }

                    // Vincula o terneiro ao repasse
                    updatedCoverageRecords[i] = {
                        ...updatedCoverageRecords[i],
                        repasse: {
                            ...updatedCoverageRecords[i].repasse!,
                            calvingResult: 'realizado',
                            calfId: calf.id,
                            calfBrinco: calf.brinco,
                            actualCalvingDate: calf.dataNascimento || new Date(),
                            // Adiciona confirmação de paternidade se calculada
                            ...(confirmedSireId ? { confirmedSireId, confirmedSireBrinco } : {}),
                        },
                    };
                    // Marca o terneiro como vinculado para evitar duplicatas
                    alreadyLinkedCalfIds.add(calf.id);
                    linkedCount++;
                } else if (today > deadlineDate) {
                    // Registra aborto no repasse
                    updatedCoverageRecords[i] = {
                        ...updatedCoverageRecords[i],
                        repasse: {
                            ...updatedCoverageRecords[i].repasse!,
                            calvingResult: 'aborto',
                            calvingNotes: 'Registrado automaticamente - sem terneiro cadastrado após período previsto',
                        },
                    };

                    // Prepara atualização do historicoAborto
                    const animal = animals.find((a: Animal) => a.id === coverage.cowId);
                    if (animal) {
                        const existing = animalUpdates.get(animal.id) || { historicoAborto: [...(animal.historicoAborto || [])] };
                        const abortionId = `abort_${coverage.id}_repasse`;
                        if (!existing.historicoAborto!.some((a: AbortionRecord) => a.id === abortionId)) {
                            existing.historicoAborto!.push({ id: abortionId, date: expectedDate });
                            animalUpdates.set(animal.id, existing);
                        }
                    }
                    registeredCount++;
                } else {
                    pendingCount++;
                }
            }

            // ============================================
            // 🔧 NOVO: Verifica coberturas com DG NEGATIVO (sem repasse OU repasse também negativo)
            // Para detectar falsos negativos ou prenhezes não detectadas
            // ============================================
            // Cenários cobertos:
            // 1. DG negativo + sem repasse
            // 2. DG negativo + repasse habilitado mas repasse também negativo
            // 3. DG negativo + repasse habilitado mas repasse pendente
            const hasNoRepasse = !coverage.repasse?.enabled;
            const hasRepasseButNotPregnant = coverage.repasse?.enabled &&
                coverage.repasse.diagnosisResult !== 'positive' &&
                !coverage.repasse.calvingResult;
            const shouldCheckForSurpriseBirth = coverage.pregnancyResult === 'negative' &&
                !coverage.calvingResult &&
                (hasNoRepasse || hasRepasseButNotPregnant);

            if (shouldCheckForSurpriseBirth) {
                // Calcula data esperada de parto baseada na data da cobertura
                const coverageDate = new Date(coverage.date);
                const expectedDate = new Date(coverageDate);
                expectedDate.setDate(expectedDate.getDate() + 283); // 283 dias de gestação

                // Busca terneiro (excluindo os já vinculados)
                const calf = findCalfForCoverageInternal(
                    animals,
                    coverage.cowId,
                    expectedDate,
                    toleranceDays,
                    alreadyLinkedCalfIds,
                    coverage.type,
                    coverage.donorCowId
                );

                if (calf) {
                    // 🎉 Encontrou bezerro! A vaca estava prenha apesar do DG negativo
                    // Corrige o diagnóstico e vincula o bezerro

                    // Determina se a prenhez veio da cobertura principal ou do repasse
                    const pregnancyFromRepasse = coverage.repasse?.enabled === true;

                    // 🔧 PATERNIDADE: Se tem 2 touros e configuração de troca, confirma automaticamente
                    // Usa touros do repasse se a prenhez veio do repasse, senão usa da cobertura principal
                    let confirmedSireId: string | undefined;
                    let confirmedSireBrinco: string | undefined;

                    if (pregnancyFromRepasse) {
                        // Prenhez do repasse - usa touros do repasse
                        confirmedSireId = coverage.repasse?.confirmedSireId;
                        confirmedSireBrinco = coverage.repasse?.confirmedSireBrinco;

                        const repasseBulls = coverage.repasse?.bulls;
                        const hasTwoBulls = repasseBulls && repasseBulls.length === 2;
                        const switchConfig = switchConfigMap.get(`${coverage.id}_repasse`);
                        const hasConfig = switchConfig && (switchConfig.switchDate || switchConfig.selectedBullIndex !== undefined);
                        const needsPaternityConfirmation = hasTwoBulls && !confirmedSireId && hasConfig;

                        if (needsPaternityConfirmation && repasseBulls && switchConfig) {
                            let selectedBull;

                            if (switchConfig.selectedBullIndex !== undefined) {
                                selectedBull = repasseBulls[switchConfig.selectedBullIndex];
                            } else if (switchConfig.switchDate) {
                                const bullSwitchTime = new Date(switchConfig.switchDate).getTime();
                                const calfBirthTime = calf.dataNascimento ? new Date(calf.dataNascimento).getTime() : expectedDate.getTime();
                                const estimatedCoverageTime = calfBirthTime - (283 * 24 * 60 * 60 * 1000);

                                selectedBull = estimatedCoverageTime < bullSwitchTime
                                    ? repasseBulls[0]
                                    : repasseBulls[1];
                            }

                            if (selectedBull) {
                                confirmedSireId = selectedBull.bullId;
                                confirmedSireBrinco = selectedBull.bullBrinco;
                                paternityConfirmedCount++;

                                calfPaternityUpdates.set(calf.id, {
                                    paiId: confirmedSireId,
                                    paiNome: confirmedSireBrinco
                                });
                            }
                        }
                    } else {
                        // Prenhez da cobertura principal - usa touros da cobertura
                        confirmedSireId = coverage.confirmedSireId;
                        confirmedSireBrinco = coverage.confirmedSireBrinco;

                        const hasTwoBulls = coverage.bulls && coverage.bulls.length === 2;
                        const switchConfig = switchConfigMap.get(coverage.id);
                        const hasConfig = switchConfig && (switchConfig.switchDate || switchConfig.selectedBullIndex !== undefined);
                        const needsPaternityConfirmation = hasTwoBulls && !confirmedSireId && hasConfig;

                        if (needsPaternityConfirmation && coverage.bulls && switchConfig) {
                            let selectedBull;

                            if (switchConfig.selectedBullIndex !== undefined) {
                                selectedBull = coverage.bulls[switchConfig.selectedBullIndex];
                            } else if (switchConfig.switchDate) {
                                const bullSwitchTime = new Date(switchConfig.switchDate).getTime();
                                const calfBirthTime = calf.dataNascimento ? new Date(calf.dataNascimento).getTime() : expectedDate.getTime();
                                const estimatedCoverageTime = calfBirthTime - (283 * 24 * 60 * 60 * 1000);

                                selectedBull = estimatedCoverageTime < bullSwitchTime
                                    ? coverage.bulls[0]
                                    : coverage.bulls[1];
                            }

                            if (selectedBull) {
                                confirmedSireId = selectedBull.bullId;
                                confirmedSireBrinco = selectedBull.bullBrinco;
                                paternityConfirmedCount++;

                                calfPaternityUpdates.set(calf.id, {
                                    paiId: confirmedSireId,
                                    paiNome: confirmedSireBrinco
                                });
                            }
                        }
                    }

                    // Atualiza a cobertura de acordo com a origem da prenhez
                    if (pregnancyFromRepasse) {
                        // Atualiza o REPASSE: corrige DG do repasse para positivo e vincula bezerro
                        updatedCoverageRecords[i] = {
                            ...coverage,
                            repasse: {
                                ...coverage.repasse!,
                                diagnosisResult: 'positive', // Corrige o diagnóstico do repasse
                                calvingResult: 'realizado',
                                calfId: calf.id,
                                calfBrinco: calf.brinco,
                                actualCalvingDate: calf.dataNascimento || new Date(),
                                calvingNotes: 'Prenhez descoberta retroativamente - DG do repasse era negativo',
                                ...(confirmedSireId ? { confirmedSireId, confirmedSireBrinco } : {}),
                            },
                        };
                        console.log(`🔍 [DISCOVER] Prenhez descoberta em repasse com DG negativo: ${coverage.cowBrinco} → Bezerro ${calf.brinco}`);
                    } else {
                        // Atualiza a COBERTURA PRINCIPAL: corrige DG para positivo e vincula bezerro
                        updatedCoverageRecords[i] = {
                            ...coverage,
                            pregnancyResult: 'positive', // Corrige o diagnóstico
                            expectedCalvingDate: expectedDate, // Adiciona data esperada
                            calvingResult: 'realizado',
                            calfId: calf.id,
                            calfBrinco: calf.brinco,
                            actualCalvingDate: calf.dataNascimento || new Date(),
                            calvingNotes: 'Prenhez descoberta retroativamente - DG original era negativo',
                            ...(confirmedSireId ? { confirmedSireId, confirmedSireBrinco } : {}),
                        };
                        console.log(`🔍 [DISCOVER] Prenhez descoberta em vaca com DG negativo: ${coverage.cowBrinco} → Bezerro ${calf.brinco}`);
                    }

                    alreadyLinkedCalfIds.add(calf.id);
                    linkedCount++;
                    discoveredCount++; // Conta como descoberto pois foi uma surpresa
                }
                // Se não encontrou bezerro, não faz nada - DG negativo sem repasse = vaca vazia mesmo
            }
        }

        // ============================================
        // 🔧 NOVO: Detecta vacas EXPOSTAS SEM COBERTURA que tiveram bezerros
        // ============================================
        // Calcula a janela de datas esperadas para partos desta estação
        // Partos esperados: data da estação + 283 dias (gestação) ± tolerância
        const seasonStartTime = new Date(season.startDate).getTime();
        const seasonEndTime = new Date(season.endDate).getTime();
        const gestationDays = 283;
        const gestationMs = gestationDays * 24 * 60 * 60 * 1000;
        const toleranceMs = toleranceDays * 24 * 60 * 60 * 1000;

        // Janela de nascimentos esperados para esta estação
        const expectedBirthWindowStart = new Date(seasonStartTime + gestationMs - toleranceMs);
        const expectedBirthWindowEnd = new Date(seasonEndTime + gestationMs + toleranceMs);

        // IDs das vacas que já têm cobertura registrada nesta estação
        const cowsWithCoverage = new Set(updatedCoverageRecords.map(c => c.cowId));

        // Vacas expostas que NÃO têm cobertura registrada
        const exposedCowsWithoutCoverage = (season.exposedCowIds || []).filter(
            cowId => !cowsWithCoverage.has(cowId)
        );

        // Para cada vaca exposta sem cobertura, busca se teve bezerro na janela esperada
        for (const cowId of exposedCowsWithoutCoverage) {
            const cow = animals.find((a: Animal) => a.id === cowId);
            if (!cow) continue;

            const cowBrinco = cow.brinco.toLowerCase().trim();

            // Busca bezerros desta vaca nascidos na janela esperada
            // Considera tanto filhos diretos quanto de FIV (onde ela é receptora)
            const calves = animals.filter((animal: Animal) => {
                // Já vinculado a outra cobertura?
                if (alreadyLinkedCalfIds.has(animal.id)) return false;

                // Verifica se é filho desta vaca (direta ou como receptora)
                const isMaeById = animal.maeId === cowId;
                const isMaeByBrinco = animal.maeNome?.toLowerCase().trim() === cowBrinco;
                const isReceptoraById = animal.maeReceptoraId === cowId;
                const isReceptoraByBrinco = animal.maeReceptoraNome?.toLowerCase().trim() === cowBrinco;

                const isChild = isMaeById || isMaeByBrinco || isReceptoraById || isReceptoraByBrinco;
                if (!isChild) return false;

                // Verifica se nasceu na janela esperada
                if (!animal.dataNascimento) return false;
                const birthTime = new Date(animal.dataNascimento).getTime();
                return birthTime >= expectedBirthWindowStart.getTime() && birthTime <= expectedBirthWindowEnd.getTime();
            });

            // Se encontrou bezerros, cria registros de cobertura retroativos
            for (const calf of calves) {
                const birthDate = new Date(calf.dataNascimento!);
                // Estima a data de cobertura (283 dias antes do nascimento)
                const estimatedCoverageDate = new Date(birthDate);
                estimatedCoverageDate.setDate(estimatedCoverageDate.getDate() - gestationDays);

                // Determina o tipo de cobertura baseado no bezerro
                // É FIV se: isFIV=true OU se a vaca é receptora (maeReceptoraId = cowId)
                const isReceptoraMatch = calf.maeReceptoraId === cowId ||
                                         calf.maeReceptoraNome?.toLowerCase().trim() === cowBrinco;
                const isFIVCalf = calf.isFIV === true || isReceptoraMatch;
                const coverageType = isFIVCalf ? CoverageTypes.FIV : CoverageTypes.MontaNatural;

                // Tenta identificar o pai pelo registro do bezerro
                const sireId = calf.paiId;
                const sireBrinco = calf.paiNome;

                // Cria novo registro de cobertura retroativo
                const newCoverageId = `discovered_${cowId}_${calf.id}`;
                const newCoverage: CoverageRecord = {
                    id: newCoverageId,
                    cowId: cowId,
                    cowBrinco: cow.brinco,
                    date: estimatedCoverageDate,
                    type: coverageType,
                    // Para FIV, a doadora é a mãe biológica
                    ...(isFIVCalf && calf.maeBiologicaId ? {
                        donorCowId: calf.maeBiologicaId,
                        donorCowBrinco: calf.maeBiologicaNome
                    } : {}),
                    // Para monta natural, registra o touro se conhecido
                    ...(coverageType === CoverageTypes.MontaNatural && sireId ? {
                        bullId: sireId,
                        bullBrinco: sireBrinco
                    } : {}),
                    // Se tiver sêmen conhecido (IATF sem cobertura registrada)
                    ...(sireBrinco && coverageType !== CoverageTypes.MontaNatural ? {
                        semenCode: sireBrinco
                    } : {}),
                    // Marca como prenhez confirmada (retroativo)
                    pregnancyResult: 'positive',
                    expectedCalvingDate: birthDate,
                    // Marca parto como realizado
                    calvingResult: 'realizado',
                    calfId: calf.id,
                    calfBrinco: calf.brinco,
                    actualCalvingDate: birthDate,
                    calvingNotes: 'Cobertura descoberta retroativamente - vaca exposta sem registro prévio',
                    // Confirma o pai se conhecido
                    ...(sireId ? {
                        confirmedSireId: sireId,
                        confirmedSireBrinco: sireBrinco
                    } : {}),
                };

                updatedCoverageRecords.push(newCoverage);
                alreadyLinkedCalfIds.add(calf.id);
                discoveredCount++;

                console.log(`🔍 [DISCOVER] Parto descoberto: Vaca ${cow.brinco} → Bezerro ${calf.brinco} (sem cobertura prévia)`);
            }
        }

        // Atualiza a estação de monta com todos os registros (existentes + descobertos)
        await updateBreedingSeason(seasonId, { coverageRecords: updatedCoverageRecords });

        // Atualiza os animais com abortos
        const batch = db.batch();
        for (const [animalId, updates] of animalUpdates) {
            const animalRef = db.collection('animals').doc(animalId);
            batch.update(animalRef, {
                ...convertDatesToTimestamps(updates),
                updatedAt: new Date()
            });

            dispatch({
                type: 'LOCAL_UPDATE_ANIMAL',
                payload: { animalId, updatedData: updates }
            });
        }

        if (animalUpdates.size > 0) {
            await batch.commit();

            // Atualiza cache local
            const updatedAnimals = stateRef.current.animals.map((a: Animal) => {
                const updates = animalUpdates.get(a.id);
                return updates ? { ...a, ...updates } : a;
            });
            await updateLocalCache('animals', updatedAnimals);
        }

        // ============================================
        // 🔧 SYNC: Atualiza paternidade nos bezerros
        // ============================================
        if (calfPaternityUpdates.size > 0) {
            const paternityBatch = db.batch();

            for (const [calfId, paternityData] of calfPaternityUpdates) {
                const calfRef = db.collection('animals').doc(calfId);
                paternityBatch.update(calfRef, {
                    paiId: paternityData.paiId,
                    paiNome: paternityData.paiNome,
                    updatedAt: new Date()
                });

                dispatch({
                    type: 'LOCAL_UPDATE_ANIMAL',
                    payload: {
                        animalId: calfId,
                        updatedData: {
                            paiId: paternityData.paiId,
                            paiNome: paternityData.paiNome
                        }
                    }
                });

                console.log(`🧬 [CALF_PATERNITY] Bezerro ${calfId} atualizado: Pai ${paternityData.paiNome}`);
            }

            await paternityBatch.commit();

            // Atualiza cache local com as paternidades
            const animalsWithPaternity = stateRef.current.animals.map((a: Animal) => {
                const paternityUpdate = calfPaternityUpdates.get(a.id);
                if (paternityUpdate) {
                    return {
                        ...a,
                        paiId: paternityUpdate.paiId,
                        paiNome: paternityUpdate.paiNome
                    };
                }
                return a;
            });
            await updateLocalCache('animals', animalsWithPaternity);

            console.log(`🧬 [CALF_PATERNITY] ${calfPaternityUpdates.size} bezerro(s) atualizado(s) com paternidade confirmada`);
        }

        // ============================================
        // 🔧 RECALCULA MÉTRICAS DA ESTAÇÃO
        // ============================================
        const updatedSeason = stateRef.current.breedingSeasons.find((s: BreedingSeason) => s.id === seasonId);
        if (updatedSeason) {
            const allCoverages = updatedCoverageRecords;
            const totalExposed = (updatedSeason.exposedCowIds || []).length;
            const totalCovered = allCoverages.length;

            // Conta prenhes (DG positivo na cobertura principal OU no repasse)
            const totalPregnant = allCoverages.filter(c =>
                c.pregnancyResult === 'positive' ||
                (c.repasse?.enabled && c.repasse.diagnosisResult === 'positive')
            ).length;

            // Conta partos realizados
            const totalCalvings = allCoverages.filter(c =>
                c.calvingResult === 'realizado' ||
                (c.repasse?.calvingResult === 'realizado')
            ).length;

            const metrics = {
                totalExposed,
                totalCovered,
                totalPregnant,
                pregnancyRate: totalExposed > 0 ? (totalPregnant / totalExposed) * 100 : 0,
                serviceRate: totalExposed > 0 ? (totalCovered / totalExposed) * 100 : 0,
                conceptionRate: totalCovered > 0 ? (totalPregnant / totalCovered) * 100 : 0,
            };

            // Atualiza métricas na estação
            await updateBreedingSeason(seasonId, { metrics });

            console.log(`📊 [METRICS] Métricas atualizadas: ${totalCovered} cobertas, ${totalPregnant} prenhes, ${totalCalvings} partos`);
        }

        console.log(`✅ [VERIFY_CALVINGS] Verificação concluída: ${linkedCount} partos vinculados, ${registeredCount} abortos registrados, ${pendingCount} pendentes, ${discoveredCount} descobertos, ${paternityConfirmedCount} paternidades confirmadas`);

        return { registered: registeredCount, linked: linkedCount, pending: pendingCount, discovered: discoveredCount, paternityConfirmed: paternityConfirmedCount };
    }, [userId, db, updateBreedingSeason, updateLocalCache]);

    // Função auxiliar interna para buscar terneiro
    // Verifica também se o terneiro já não está vinculado a outra cobertura
    // 🔧 FIV: Considera a distinção entre filhos diretos e filhos de FIV (receptora vs doadora)
    const findCalfForCoverageInternal = (
        animals: Animal[],
        motherId: string,
        expectedCalvingDate: Date,
        toleranceDays: number,
        alreadyLinkedCalfIds?: Set<string>,
        coverageType?: CoverageType,
        donorCowId?: string // ID da doadora para coberturas FIV
    ): Animal | undefined => {
        const minDate = new Date(expectedCalvingDate);
        minDate.setDate(minDate.getDate() - toleranceDays);
        const maxDate = new Date(expectedCalvingDate);
        maxDate.setDate(maxDate.getDate() + toleranceDays);

        const mother = animals.find((a: Animal) => a.id === motherId);
        if (!mother) return undefined;

        const motherBrinco = mother.brinco.toLowerCase().trim();
        const isFIVCoverage = coverageType === CoverageTypes.FIV;

        // Para FIV, também precisamos do brinco da doadora se houver
        let donorBrinco: string | undefined;
        if (isFIVCoverage && donorCowId) {
            const donor = animals.find((a: Animal) => a.id === donorCowId);
            donorBrinco = donor?.brinco.toLowerCase().trim();
        }

        // Busca terneiros que:
        // 1. São filhos desta mãe (considerando FIV vs não-FIV)
        // 2. Nasceram dentro da janela de tempo
        // 3. Ainda não foram vinculados a outra cobertura nesta verificação
        const potentialCalves = animals.filter((animal: Animal) => {
            // Verifica se já foi vinculado nesta mesma execução
            if (alreadyLinkedCalfIds && alreadyLinkedCalfIds.has(animal.id)) return false;

            let isChildOfThisCow = false;

            if (isFIVCoverage) {
                // 🔧 FIV: A vaca da cobertura (motherId) é a RECEPTORA
                // O bezerro terá maeReceptoraId = motherId (quem gestou)
                // E opcionalmente maeBiologicaId = donorCowId (doadora genética)
                const isReceptoraById = animal.maeReceptoraId === motherId;
                const isReceptoraByBrinco = animal.maeReceptoraNome?.toLowerCase().trim() === motherBrinco;

                // Verifica se a doadora bate (se especificada na cobertura E no bezerro)
                let donorMatches = true;
                if (donorCowId && (animal.maeBiologicaId || animal.maeBiologicaNome)) {
                    const isDonorById = animal.maeBiologicaId === donorCowId;
                    const isDonorByBrinco = donorBrinco && animal.maeBiologicaNome?.toLowerCase().trim() === donorBrinco;
                    donorMatches = isDonorById || isDonorByBrinco || false;
                }

                // Bezerro é de FIV se: tem isFIV=true OU tem maeReceptoraId preenchido
                const isFIVCalf = animal.isFIV === true || !!animal.maeReceptoraId || !!animal.maeReceptoraNome;

                isChildOfThisCow = (isReceptoraById || isReceptoraByBrinco) && donorMatches && isFIVCalf;
            } else {
                // 🔧 Não-FIV (IATF, Monta Natural): A vaca é a mãe direta
                // O bezerro terá maeId = motherId
                // E NÃO deve ser um bezerro de FIV (para evitar confusão)
                const isMaeById = animal.maeId === motherId;
                const isMaeByBrinco = animal.maeNome?.toLowerCase().trim() === motherBrinco;
                // Bezerro NÃO é de FIV se: não tem isFIV=true E não tem maeReceptoraId
                const isNotFIVCalf = animal.isFIV !== true && !animal.maeReceptoraId && !animal.maeReceptoraNome;

                isChildOfThisCow = (isMaeById || isMaeByBrinco) && isNotFIVCalf;
            }

            if (!isChildOfThisCow) return false;

            if (!animal.dataNascimento) return false;
            const birthDate = new Date(animal.dataNascimento);
            return birthDate >= minDate && birthDate <= maxDate;
        });

        // Se houver múltiplos candidatos, retorna o que tem data de nascimento mais próxima da esperada
        if (potentialCalves.length > 1) {
            const expectedTime = expectedCalvingDate.getTime();
            return potentialCalves.reduce((closest, current) => {
                const closestDiff = Math.abs(new Date(closest.dataNascimento!).getTime() - expectedTime);
                const currentDiff = Math.abs(new Date(current.dataNascimento!).getTime() - expectedTime);
                return currentDiff < closestDiff ? current : closest;
            });
        }

        return potentialCalves[0];
    };

    return {
        state,
        db,
        forceSync,
        // 🔧 OTIMIZAÇÃO: Sync delta para economia de leituras
        syncDelta,
        // 🔧 OTIMIZAÇÃO: Paginação com cursor
        loadMoreAnimals,
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
        // Breeding Seasons (Estação de Monta)
        createBreedingSeason,
        updateBreedingSeason,
        deleteBreedingSeason,
        addCoverageToSeason,
        updatePregnancyDiagnosis,
        updateCoverageInSeason,
        deleteCoverageFromSeason,
        confirmPaternity,
        // Verificação de Partos e Abortos
        registerAbortion,
        registerCalving,
        verifyAndRegisterAbortions,
    };
};
