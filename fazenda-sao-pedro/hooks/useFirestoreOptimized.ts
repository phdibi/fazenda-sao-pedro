import { useState, useEffect, useCallback, useReducer, useRef } from 'react';
import { firebaseServices } from '../services/firebase';
import { localCache } from '../services/localCache';
import { trackReads, trackWrites, trackDeletes, isQuotaCritical, canPerformOperation } from '../services/quotaMonitor';
import { Animal, FirestoreCollectionName, ManagementBatch, UserRole, WeighingType, AnimalStatus, Sexo, CalendarEvent, AppUser, ManagementArea, MedicationAdministration, PregnancyRecord, PregnancyType, AbortionRecord, Task, LoadingKey, LocalStateCollectionName, BreedingSeason, CoverageRecord } from '../types';
import { QUERY_LIMITS, ARCHIVED_COLLECTION_NAME, AUTO_SYNC_INTERVAL_MS } from '../constants/app';
import { convertTimestampsToDates, convertDatesToTimestamps } from '../utils/dateHelpers';
import { removeUndefined } from '../utils/objectHelpers';

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

    const updateAnimal = useCallback(async (animalId: string, updatedData: Partial<Omit<Animal, 'id'>>) => {
        if (!userId || !db) return;

        // 🔧 OTIMIZAÇÃO: Verificar quota antes de escrever
        if (!canPerformOperation('write', 2)) {
            throw new Error('Limite de escritas atingido. Tente novamente amanhã.');
        }

        // Atualização otimista
        dispatch({ type: 'LOCAL_UPDATE_ANIMAL', payload: { animalId, updatedData } });

        let writeCount = 1; // Contador para rastrear escritas

        try {
            const batch = db.batch();
            const animalRef = db.collection('animals').doc(animalId);
            const sanitizedData = removeUndefined(updatedData);
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
            pregnancyResult: 'pending',
        };

        const updatedCoverageRecords = [...(season.coverageRecords || []), newCoverage];

        await updateBreedingSeason(seasonId, {
            coverageRecords: updatedCoverageRecords,
        });

        // 🔧 INTEGRAÇÃO: Adiciona registro no historicoPrenhez do animal
        const animal = stateRef.current.animals.find((a: Animal) => a.id === coverage.cowId);
        if (animal) {
            // Mapeia tipo de cobertura para PregnancyType
            const pregnancyTypeMap: Record<string, PregnancyType> = {
                'natural': PregnancyType.Monta,
                'ia': PregnancyType.InseminacaoArtificial,
                'iatf': PregnancyType.InseminacaoArtificial,
                'fiv': PregnancyType.FIV,
            };

            // Para FIV, o código do sêmen é o nome do pai
            const sireName = coverage.bullBrinco || coverage.semenCode || 'Desconhecido';

            const pregnancyRecord: PregnancyRecord = {
                id: newCoverage.id, // Usa mesmo ID para correlação
                date: coverageDate,
                type: pregnancyTypeMap[coverage.type] || PregnancyType.Monta,
                sireName,
            };

            const updatedHistoricoPrenhez = [...(animal.historicoPrenhez || []), pregnancyRecord];

            // Atualiza o animal com o novo registro
            const animalRef = db.collection('animals').doc(coverage.cowId);
            const dataWithTimestamp = convertDatesToTimestamps({ historicoPrenhez: updatedHistoricoPrenhez });
            await animalRef.update({ ...dataWithTimestamp, updatedAt: new Date() });

            // Atualização otimista local
            dispatch({ type: 'LOCAL_UPDATE_ANIMAL', payload: {
                animalId: coverage.cowId,
                updatedData: { historicoPrenhez: updatedHistoricoPrenhez }
            }});

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
                    dispatch({ type: 'LOCAL_UPDATE_ANIMAL', payload: {
                        animalId: coverage.donorCowId,
                        updatedData: { historicoProgenie: updatedHistoricoProgenie }
                    }});
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

        // 🔧 INTEGRAÇÃO: Se resultado negativo, pode indicar perda/aborto precoce
        // Adiciona ao histórico de abortos do animal
        if (result === 'negative') {
            const animal = stateRef.current.animals.find((a: Animal) => a.id === coverage.cowId);
            if (animal) {
                const abortionRecord = {
                    id: `abort_${coverageId}`,
                    date: checkDate,
                };

                const updatedHistoricoAborto = [...(animal.historicoAborto || []), abortionRecord];

                // Atualiza o animal com o registro de aborto/vazia
                const animalRef = db.collection('animals').doc(coverage.cowId);
                const dataWithTimestamp = convertDatesToTimestamps({ historicoAborto: updatedHistoricoAborto });
                await animalRef.update({ ...dataWithTimestamp, updatedAt: new Date() });

                // Atualização otimista local
                dispatch({ type: 'LOCAL_UPDATE_ANIMAL', payload: {
                    animalId: coverage.cowId,
                    updatedData: { historicoAborto: updatedHistoricoAborto }
                }});

                // Atualiza cache local
                const updatedAnimals = stateRef.current.animals.map((a: Animal) =>
                    a.id === coverage.cowId
                        ? { ...a, historicoAborto: updatedHistoricoAborto }
                        : a
                );
                await updateLocalCache('animals', updatedAnimals);
            }
        }
    }, [userId, db, updateBreedingSeason, updateLocalCache]);

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
    };
};
