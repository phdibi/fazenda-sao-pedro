import { useState, useEffect, useCallback, useReducer } from 'react';
// FIX: Import the 'firebase' object from our centralized service to make its types available.
import { db, Timestamp, FieldValue, storage } from '../services/firebase';
import { Animal, CalendarEvent, Task, ManagementArea, Sexo, OffspringWeightRecord, WeighingType, AppUser } from '../types';
// FIX: Removed unused import of non-existent member 'compressImageDataUrl'.

// --- State, Action, and Reducer for robust state management ---

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
}

type FirestoreAction =
  | { type: 'SET_DATA'; payload: { collection: keyof Omit<FirestoreState, 'loading' | 'error'>; data: any[] } }
  | { type: 'SET_LOADING_STATUS'; payload: { collection: keyof FirestoreState['loading']; status: boolean } }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'LOCAL_UPDATE_ANIMAL'; payload: { animalId: string; updatedData: Partial<Animal> } }
  | { type: 'LOCAL_DELETE_ANIMAL'; payload: { animalId: string } };

const initialState: FirestoreState = {
    animals: [],
    calendarEvents: [],
    tasks: [],
    managementAreas: [],
    loading: {
        animals: true,
        calendar: true,
        tasks: true,
        areas: true
    },
    error: null
};

// Helper function to convert Firestore Timestamps to JS Dates in nested objects
const convertTimestampsToDates = (data: any): any => {
    if (!data) return data;

    if (Array.isArray(data)) {
        return data.map(item => convertTimestampsToDates(item));
    }
    
    if (data instanceof Timestamp) {
        return data.toDate();
    }

    if (typeof data === 'object' && data !== null) {
        const converted = { ...data };
        for (const key in converted) {
            converted[key] = convertTimestampsToDates(converted[key]);
        }
        return converted;
    }
    
    return data;
};

// Helper function to convert JS Dates back to Firestore Timestamps for writing
const convertDatesToTimestamps = (data: any): any => {
    if (!data) return data;

    if (Array.isArray(data)) {
        return data.map(item => convertDatesToTimestamps(item));
    }

    if (data instanceof Date) {
        return Timestamp.fromDate(data);
    }
    
    if (typeof data === 'object' && data !== null) {
        const converted = { ...data };
        for (const key in converted) {
            converted[key] = convertDatesToTimestamps(converted[key]);
        }
        return converted;
    }
    
    return data;
};


const firestoreReducer = (state: FirestoreState, action: FirestoreAction): FirestoreState => {
    switch (action.type) {
        case 'SET_LOADING_STATUS':
            return {
                ...state,
                loading: { ...state.loading, [action.payload.collection]: action.payload.status },
            };
        case 'SET_DATA':
            return {
                ...state,
                [action.payload.collection]: action.payload.data,
            };
        case 'SET_ERROR':
            return { ...state, error: action.payload };
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
            return {
                ...state,
                animals: state.animals.filter(animal => animal.id !== action.payload.animalId),
            };
        default:
            return state;
    }
};

// Helper to remove undefined properties from an object recursively.
// This prevents Firestore errors when trying to write `undefined`.
const removeUndefined = (obj: any): any => {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    if (Array.isArray(obj)) {
        // Filter out undefined items from arrays as well
        return obj.map(item => removeUndefined(item)).filter(item => item !== undefined);
    }
    const newObj: any = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const value = obj[key];
            if (value !== undefined) {
                // Recursively remove undefined from nested objects
                newObj[key] = removeUndefined(value);
            }
        }
    }
    return newObj;
};


// --- The Hook ---

export const useFirestoreData = (user: AppUser | null) => {
    const [state, dispatch] = useReducer(firestoreReducer, initialState);
    const userId = user?.uid;

    useEffect(() => {
        // If there's no user OR no DB connection, do nothing and set loading to false.
        if (!userId || !db) {
            Object.keys(initialState.loading).forEach(key => {
                 dispatch({ type: 'SET_LOADING_STATUS', payload: { collection: key as keyof FirestoreState['loading'], status: false } });
            });
            return;
        }

        // Set loading to true for all collections when user changes
        Object.keys(initialState.loading).forEach(key => {
            dispatch({ type: 'SET_LOADING_STATUS', payload: { collection: key as keyof FirestoreState['loading'], status: true } });
        });

        const collections: (keyof Omit<FirestoreState, 'loading' | 'error'>)[] = [
            'animals',
            'calendarEvents',
            'tasks',
            'managementAreas',
        ];
        
        const unsubscribers = collections.map((collectionName) => {
            let loadingKey: keyof FirestoreState['loading'];
            let firestorePath: string;

            switch(collectionName) {
                case 'calendarEvents':
                    loadingKey = 'calendar';
                    firestorePath = 'calendar';
                    break;
                case 'managementAreas':
                    loadingKey = 'areas';
                    firestorePath = 'areas';
                    break;
                case 'animals':
                    loadingKey = 'animals';
                    firestorePath = 'animals';
                    break;
                case 'tasks':
                    loadingKey = 'tasks';
                    firestorePath = 'tasks';
                    break;
            }
            
            const q = db.collection(firestorePath).where("userId", "==", userId);
            
            return q.onSnapshot((querySnapshot) => {
                const data = querySnapshot.docs.map(doc => {
                    const docData = convertTimestampsToDates(doc.data());
                    const entity = {
                        id: doc.id,
                        ...docData,
                    };

                    // Ensure required arrays exist for animals to prevent runtime errors.
                    if (collectionName === 'animals') {
                        // --- Robustly handle the 'fotos' field to prevent crashes ---
                        let finalFotos: string[] = [];
                        const rawFotos = entity.fotos; // This could be: string, string[], object[], null, undefined
                        
                        if (typeof rawFotos === 'string' && rawFotos.trim()) {
                            finalFotos = [rawFotos];
                        } else if (Array.isArray(rawFotos)) {
                            finalFotos = rawFotos
                                .map(item => {
                                    if (typeof item === 'string') {
                                        return item;
                                    }
                                    // Handle cases like [{ url: '...' }]
                                    if (typeof item === 'object' && item !== null && 'url' in item && typeof (item as any).url === 'string') {
                                        return (item as any).url;
                                    }
                                    return null; // Invalid item
                                })
                                .filter((url): url is string => !!url && url.trim() !== ''); // Filter out nulls and empty strings
                        }
                        
                        // If after all sanitization we have no valid photos, use the placeholder.
                        if (finalFotos.length === 0) {
                            finalFotos = ['https://storage.googleapis.com/aistudio-marketplace/gallery/cattle_management/cow_placeholder.png'];
                        }
                        entity.fotos = finalFotos;

                        entity.historicoSanitario = entity.historicoSanitario || [];
                        entity.historicoPesagens = entity.historicoPesagens || [];
                        // Also good to default optional arrays
                        entity.historicoPrenhez = entity.historicoPrenhez || [];
                        entity.historicoAborto = entity.historicoAborto || [];
                        entity.historicoProgenie = entity.historicoProgenie || [];
                    }

                    return entity;
                });
                dispatch({ type: 'SET_DATA', payload: { collection: collectionName, data } });
                dispatch({ type: 'SET_LOADING_STATUS', payload: { collection: loadingKey, status: false }});
            }, (error) => {
                console.error(`Error fetching ${collectionName}:`, error);
                dispatch({ type: 'SET_ERROR', payload: `Failed to fetch ${collectionName}` });
                dispatch({ type: 'SET_LOADING_STATUS', payload: { collection: loadingKey, status: false }});
            });
        });
        
        return () => {
            unsubscribers.forEach(unsub => unsub());
        };
    }, [userId]);

    const addAnimal = useCallback(async (animalData: Omit<Animal, 'id' | 'fotos' | 'historicoSanitario' | 'historicoPesagens'>) => {
        if (!userId || !db) return;
        try {
            const batch = db.batch();
            const newAnimalRef = db.collection('animals').doc();
            
            const initialWeightHistory = animalData.pesoKg > 0 
                ? [{ id: `initial-${newAnimalRef.id}`, date: animalData.dataNascimento, weightKg: animalData.pesoKg, type: WeighingType.None }]
                : [];

            // Create a complete animal object with default empty arrays and a placeholder photo.
            const fullAnimalData: Omit<Animal, 'id'> = {
                ...animalData,
                fotos: ['https://storage.googleapis.com/aistudio-marketplace/gallery/cattle_management/cow_placeholder.png'],
                historicoSanitario: [],
                historicoPesagens: initialWeightHistory,
                historicoPrenhez: [],
                historicoAborto: [],
                historicoProgenie: [],
            };

            const dataWithTimestamp = convertDatesToTimestamps(fullAnimalData);
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
                    // FIX: Conditionally build the offspring record. Firestore's arrayUnion
                    // crashes if any object property has an `undefined` value. This ensures
                    // `birthWeightKg` is only included if it's a valid number.
                    const newOffspringRecord: {
                        id: string;
                        offspringBrinco: string;
                        birthWeightKg?: number;
                    } = {
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
            await batch.commit();
        } catch (error) {
            console.error("Error adding animal:", error);
        }
    }, [userId]);

    const updateAnimal = useCallback((animalId: string, updatedData: Partial<Omit<Animal, 'id'>>) => {
        if (!userId || !db) {
            console.error("Usuário não autenticado ou BD indisponível. A atualização foi ignorada.");
            return;
        }
    
        const animalBeingUpdated = state.animals.find(a => a.id === animalId);
        if (!animalBeingUpdated) {
            console.error("Animal a ser atualizado não encontrado no estado local.");
            return;
        }
    
        // Start optimistic update for the main animal
        dispatch({ type: 'LOCAL_UPDATE_ANIMAL', payload: { animalId, updatedData } });
    
        const performBackgroundUpdate = async () => {
            if (!db) return; // Guard clause for async context
            const batch = db.batch();
            const animalRef = db.collection('animals').doc(animalId);
    
            // 1. Handle main animal data update
            const sanitizedData = removeUndefined(updatedData);
            const dataWithTimestamp = convertDatesToTimestamps(sanitizedData);
            batch.update(animalRef, dataWithTimestamp);
    
            // 2. Handle mother relationship change
            const oldMaeNome = animalBeingUpdated.maeNome;
            const newMaeNome = updatedData.maeNome;
            const motherChanged = newMaeNome !== undefined && newMaeNome !== oldMaeNome;
    
            if (motherChanged) {
                // Remove from old mother's progeny
                if (oldMaeNome) {
                    const oldMother = state.animals.find(a => a.brinco.toLowerCase() === oldMaeNome.toLowerCase().trim() && a.sexo === Sexo.Femea);
                    if (oldMother) {
                        const newProgenyHistory = (oldMother.historicoProgenie || []).filter(p => p.offspringBrinco !== animalBeingUpdated.brinco);
                        batch.update(db.collection('animals').doc(oldMother.id), { historicoProgenie: newProgenyHistory });
                        dispatch({ type: 'LOCAL_UPDATE_ANIMAL', payload: { animalId: oldMother.id, updatedData: { historicoProgenie: newProgenyHistory } } });
                    }
                }
                // Add to new mother's progeny (basic record, weights will be handled next)
                if (newMaeNome) {
                    const newMother = state.animals.find(a => a.brinco.toLowerCase() === newMaeNome.toLowerCase().trim() && a.sexo === Sexo.Femea);
                    if (newMother) {
                        const progenyRecord = { id: `prog_${animalBeingUpdated.id}`, offspringBrinco: animalBeingUpdated.brinco };
                        // Note: Using arrayUnion is simpler but makes local state updates harder.
                        // We'll overwrite the whole array for consistency with weight updates.
                        const newProgenyHistory = [...(newMother.historicoProgenie || []), progenyRecord];
                        batch.update(db.collection('animals').doc(newMother.id), { historicoProgenie: newProgenyHistory });
                        dispatch({ type: 'LOCAL_UPDATE_ANIMAL', payload: { animalId: newMother.id, updatedData: { historicoProgenie: newProgenyHistory } } });
                    }
                }
            }
    
            // 3. Handle progeny weight updates (on the correct mother)
            const latestWeaningWeight = updatedData.historicoPesagens?.filter(p => p.type === WeighingType.Weaning).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
            const latestYearlingWeight = updatedData.historicoPesagens?.filter(p => p.type === WeighingType.Yearling).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
    
            const motherForWeightUpdateName = newMaeNome !== undefined ? newMaeNome : oldMaeNome;
    
            if ((latestWeaningWeight || latestYearlingWeight) && motherForWeightUpdateName) {
                const mother = state.animals.find(a => a.brinco.toLowerCase() === motherForWeightUpdateName.toLowerCase().trim() && a.sexo === Sexo.Femea);
                if (mother) {
                    const progenyHistory = [...(mother.historicoProgenie || [])];
                    const progenyIndex = progenyHistory.findIndex(p => p.offspringBrinco === animalBeingUpdated.brinco);
                    
                    let recordNeedsUpdate = false;
                    let record = progenyIndex > -1 ? { ...progenyHistory[progenyIndex] } : { id: `prog_${animalBeingUpdated.id}_${Date.now()}`, offspringBrinco: animalBeingUpdated.brinco };
    
                    if (latestWeaningWeight && record.weaningWeightKg !== latestWeaningWeight.weightKg) {
                        record.weaningWeightKg = latestWeaningWeight.weightKg;
                        recordNeedsUpdate = true;
                    }
                    if (latestYearlingWeight && record.yearlingWeightKg !== latestYearlingWeight.weightKg) {
                        record.yearlingWeightKg = latestYearlingWeight.weightKg;
                        recordNeedsUpdate = true;
                    }
    
                    if (recordNeedsUpdate) {
                        if (progenyIndex > -1) {
                            progenyHistory[progenyIndex] = record;
                        } else {
                            progenyHistory.push(record);
                        }
                        batch.update(db.collection('animals').doc(mother.id), { historicoProgenie: convertDatesToTimestamps(progenyHistory) });
                        dispatch({ type: 'LOCAL_UPDATE_ANIMAL', payload: { animalId: mother.id, updatedData: { historicoProgenie: progenyHistory } } });
                    }
                }
            }
    
            try {
                await batch.commit();
            } catch (error) {
                console.error("Falha na transação de atualização do animal em segundo plano:", error);
                dispatch({ type: 'SET_ERROR', payload: `Falha ao sincronizar dados do animal ${animalId}. Por favor, recarregue.` });
            }
        };
    
        performBackgroundUpdate();
    }, [userId, state.animals]);


    const deleteAnimal = useCallback(async (animalId: string): Promise<void> => {
        if (!userId || !db) {
            throw new Error("Usuário não autenticado ou BD indisponível.");
        }
        
        const animalToDelete = state.animals.find(a => a.id === animalId);
        dispatch({ type: 'LOCAL_DELETE_ANIMAL', payload: { animalId } });
        
        try {
            const batch = db.batch();
            const animalRef = db.collection('animals').doc(animalId);
            
            batch.delete(animalRef);

            if (animalToDelete?.maeNome) {
                 const motherBrinco = animalToDelete.maeNome.toLowerCase().trim();
                 const motherQuery = await db.collection('animals')
                     .where('userId', '==', userId)
                     .where('brinco', '==', motherBrinco)
                     .limit(1).get();

                 if (!motherQuery.empty) {
                     const motherDoc = motherQuery.docs[0];
                     const motherData = motherDoc.data() as Animal;
                     const updatedProgenie = (motherData.historicoProgenie || []).filter(
                         p => p.offspringBrinco !== animalToDelete.brinco
                     );
                     batch.update(motherDoc.ref, { historicoProgenie: updatedProgenie });
                 }
            }
            
            await batch.commit();
        } catch (error) {
            console.error("Error deleting animal:", error);
            // Reverter a exclusão otimista em caso de falha
            if (animalToDelete) {
                dispatch({ type: 'SET_DATA', payload: { collection: 'animals', data: [...state.animals, animalToDelete] }});
            }
            throw error;
        }
    }, [userId, state.animals]);


    const addOrUpdateCalendarEvent = useCallback(async (event: Omit<CalendarEvent, 'id'> & { id?: string }) => {
        if (!userId || !db) return;
        try {
            const { id, ...eventData } = event;
            const dataWithTimestamp = convertDatesToTimestamps(eventData);
            if (id) {
                await db.collection('calendar').doc(id).update(dataWithTimestamp);
            } else {
                await db.collection('calendar').add({ ...dataWithTimestamp, userId });
            }
        } catch (error) {
            console.error("Error saving calendar event:", error);
        }
    }, [userId]);

    const deleteCalendarEvent = useCallback(async (eventId: string) => {
        if (!userId || !db) return;
        try {
            await db.collection('calendar').doc(eventId).delete();
        } catch (error) {
            console.error("Error deleting calendar event:", error);
        }
    }, [userId]);

    const addTask = useCallback(async (task: Omit<Task, 'id' | 'isCompleted'>) => {
        if (!userId || !db) return;
        try {
            const newTask = { ...task, isCompleted: false, userId };
            const dataWithTimestamp = convertDatesToTimestamps(newTask);
            await db.collection('tasks').add(dataWithTimestamp);
        } catch (error) {
            console.error("Error adding task:", error);
        }
    }, [userId]);

    const toggleTaskCompletion = useCallback(async (task: Task) => {
        if (!userId || !db) return;
        try {
            await db.collection('tasks').doc(task.id).update({ isCompleted: !task.isCompleted });
        } catch (error) {
            console.error("Error toggling task completion:", error);
        }
    }, [userId]);

    const deleteTask = useCallback(async (taskId: string) => {
        if (!userId || !db) return;
        try {
            await db.collection('tasks').doc(taskId).delete();
        } catch (error) {
            console.error("Error deleting task:", error);
        }
    }, [userId]);

    const addOrUpdateManagementArea = useCallback(async (area: Omit<ManagementArea, 'id'> & { id?: string }) => {
        if (!userId || !db) return;
        try {
            const { id, ...areaData } = area;
            if (id) {
                await db.collection('areas').doc(id).update(areaData);
            } else {
                await db.collection('areas').add({ ...areaData, userId });
            }
        } catch (error) {
            console.error("Error saving management area:", error);
        }
    }, [userId]);

    const deleteManagementArea = useCallback(async (areaId: string) => {
        if (!userId || !db) return;
        try {
            const batch = db.batch();
            const animalsInAreaQuery = db.collection('animals').where('userId', '==', userId).where('managementAreaId', '==', areaId);
            const snapshot = await animalsInAreaQuery.get();
            snapshot.docs.forEach(doc => {
                 batch.update(doc.ref, { managementAreaId: FieldValue.delete() });
            });
            const areaRef = db.collection('areas').doc(areaId);
            batch.delete(areaRef);
            await batch.commit();
        } catch (error) {
            console.error("Error deleting management area:", error);
        }
    }, [userId]);
    
    const assignAnimalsToArea = useCallback(async (areaId: string, animalIdsToAssign: string[]) => {
        if (!userId || !db) return;
        try {
            const batch = db.batch();
            const animalsInAreaQuery = db.collection('animals').where('userId', '==', userId).where('managementAreaId', '==', areaId);
            const currentAnimalsSnapshot = await animalsInAreaQuery.get();
            const currentlyInAreaSet = new Set<string>(currentAnimalsSnapshot.docs.map(doc => doc.id));

            const toAssignSet = new Set(animalIdsToAssign);

            for (const animalId of toAssignSet) {
                if (!currentlyInAreaSet.has(animalId)) {
                    const docRef = db.collection('animals').doc(animalId);
                    batch.update(docRef, { managementAreaId: areaId });
                }
            }

            for (const animalId of currentlyInAreaSet) {
                if (!toAssignSet.has(animalId)) {
                    const docRef = db.collection('animals').doc(animalId);
                    batch.update(docRef, { managementAreaId: FieldValue.delete() });
                }
            }
            
            await batch.commit();
        } catch (error) {
            console.error("Error assigning animals to area:", error);
        }
    }, [userId]);

    return {
        state,
        db,
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
