/**
 * Utilitários para manipulação de objetos
 * Funções comuns usadas em todo o projeto
 */

/**
 * Verifica se um valor é uma Date inválida
 */
const isInvalidDate = (value: any): boolean => {
    return value instanceof Date && isNaN(value.getTime());
};

/**
 * Remove recursivamente campos undefined e datas inválidas de um objeto
 * Firebase não aceita valores undefined, e datas inválidas causam problemas
 */
export const removeUndefined = (obj: any): any => {
    if (obj === null || typeof obj !== 'object') return obj;

    // Não processa Dates válidas
    if (obj instanceof Date) {
        return isInvalidDate(obj) ? undefined : obj;
    }

    if (Array.isArray(obj)) {
        return obj
            .map(item => removeUndefined(item))
            .filter(item => item !== undefined);
    }

    const newObj: any = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const value = obj[key];
            // Remove undefined E datas inválidas
            if (value !== undefined && !isInvalidDate(value)) {
                const processed = removeUndefined(value);
                // Só adiciona se o valor processado não for undefined
                if (processed !== undefined) {
                    newObj[key] = processed;
                }
            }
        }
    }
    return newObj;
};

/**
 * Deep clone de um objeto
 */
export const deepClone = <T>(obj: T): T => {
    if (obj === null || typeof obj !== 'object') return obj;
    
    if (obj instanceof Date) {
        return new Date(obj.getTime()) as unknown as T;
    }
    
    if (Array.isArray(obj)) {
        return obj.map(item => deepClone(item)) as unknown as T;
    }
    
    const cloned = {} as T;
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            (cloned as any)[key] = deepClone((obj as any)[key]);
        }
    }
    return cloned;
};

/**
 * Compara dois objetos superficialmente
 */
export const shallowEqual = (obj1: any, obj2: any): boolean => {
    if (obj1 === obj2) return true;
    if (!obj1 || !obj2) return false;
    
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
    
    if (keys1.length !== keys2.length) return false;
    
    return keys1.every(key => obj1[key] === obj2[key]);
};

/**
 * Merge profundo de objetos
 */
export const deepMerge = <T extends object>(target: T, ...sources: Partial<T>[]): T => {
    if (!sources.length) return target;
    
    const source = sources.shift();
    if (!source) return target;
    
    const result = { ...target };
    
    for (const key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
            const sourceValue = source[key];
            const targetValue = (result as any)[key];
            
            if (isPlainObject(sourceValue) && isPlainObject(targetValue)) {
                (result as any)[key] = deepMerge(targetValue, sourceValue);
            } else if (sourceValue !== undefined) {
                (result as any)[key] = sourceValue;
            }
        }
    }
    
    return deepMerge(result, ...sources);
};

/**
 * Verifica se um valor é um objeto simples (não Array, Date, etc)
 */
export const isPlainObject = (value: any): value is Record<string, any> => {
    return value !== null && 
           typeof value === 'object' && 
           !Array.isArray(value) && 
           !(value instanceof Date);
};

/**
 * Pega um valor de um objeto usando path (ex: 'user.profile.name')
 */
export const getNestedValue = (obj: any, path: string): any => {
    return path.split('.').reduce((acc, part) => acc?.[part], obj);
};

/**
 * Define um valor em um objeto usando path
 */
export const setNestedValue = <T extends object>(
    obj: T, 
    path: string, 
    value: any
): T => {
    const result = deepClone(obj);
    const parts = path.split('.');
    let current: any = result;
    
    for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!(part in current)) {
            current[part] = {};
        }
        current = current[part];
    }
    
    current[parts[parts.length - 1]] = value;
    return result;
};

/**
 * Omite campos específicos de um objeto
 */
export const omit = <T extends object, K extends keyof T>(
    obj: T, 
    keys: K[]
): Omit<T, K> => {
    const result = { ...obj };
    keys.forEach(key => delete result[key]);
    return result;
};

/**
 * Seleciona apenas campos específicos de um objeto
 */
export const pick = <T extends object, K extends keyof T>(
    obj: T, 
    keys: K[]
): Pick<T, K> => {
    const result = {} as Pick<T, K>;
    keys.forEach(key => {
        if (key in obj) {
            result[key] = obj[key];
        }
    });
    return result;
};

/**
 * Agrupa um array de objetos por uma chave
 */
export const groupBy = <T>(
    array: T[], 
    keyFn: (item: T) => string
): Record<string, T[]> => {
    return array.reduce((acc, item) => {
        const key = keyFn(item);
        if (!acc[key]) {
            acc[key] = [];
        }
        acc[key].push(item);
        return acc;
    }, {} as Record<string, T[]>);
};

/**
 * Cria um mapa de objetos por ID
 */
export const keyById = <T extends { id: string }>(array: T[]): Record<string, T> => {
    return array.reduce((acc, item) => {
        acc[item.id] = item;
        return acc;
    }, {} as Record<string, T>);
};

/**
 * Throttle de uma função
 */
export const throttle = <T extends (...args: any[]) => any>(
    fn: T,
    limit: number
): ((...args: Parameters<T>) => void) => {
    let inThrottle = false;
    
    return (...args: Parameters<T>) => {
        if (!inThrottle) {
            fn(...args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
};
