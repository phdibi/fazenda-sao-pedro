import { Animal } from '../../types';

// Referência a um ancestral - pode ser cadastrado ou externo
export interface AncestorRef {
    animal?: Animal;
    refName?: string;
    paiNome?: string;
    maeNome?: string;
    isReference: boolean;
}

// Props do nó da árvore (ancestrais e animal atual)
export interface NodeProps {
    animal?: Animal;
    name?: string;
    gender: 'M' | 'F' | '?';
    level: number;
    isOffspring?: boolean;
    generationLabel?: string;
    isFIV?: boolean;
    compact?: boolean;
    isReference?: boolean;
}

// Estatísticas de descendentes
export interface OffspringStats {
    total: number;
    machos: number;
    femeas: number;
    ativos: number;
    vendidos: number;
    obitos: number;
    fiv: number;
}

// Grupo de animais para exibição agrupada
export interface AnimalGroup {
    key: string;
    label: string;
    animals: Animal[];
    color?: string;
}

// Tipos de agrupamento
export type GroupBy = 'none' | 'status' | 'sexo' | 'anoNascimento';

// Gerações de descendentes
export type GenerationView = 'filhos' | 'netos' | 'bisnetos';
