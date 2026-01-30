import { Animal, AnimalStatus, Sexo } from '../../types';
import { OffspringStats, AnimalGroup, GroupBy } from './types';

export const computeStats = (animals: Animal[]): OffspringStats => {
    return animals.reduce(
        (acc, a) => ({
            total: acc.total + 1,
            machos: acc.machos + (a.sexo === Sexo.Macho ? 1 : 0),
            femeas: acc.femeas + (a.sexo === Sexo.Femea ? 1 : 0),
            ativos: acc.ativos + (a.status === AnimalStatus.Ativo ? 1 : 0),
            vendidos: acc.vendidos + (a.status === AnimalStatus.Vendido ? 1 : 0),
            obitos: acc.obitos + (a.status === AnimalStatus.Obito ? 1 : 0),
            fiv: acc.fiv + (a.isFIV ? 1 : 0),
        }),
        { total: 0, machos: 0, femeas: 0, ativos: 0, vendidos: 0, obitos: 0, fiv: 0 }
    );
};

const STATUS_ORDER: Record<string, number> = {
    [AnimalStatus.Ativo]: 0,
    [AnimalStatus.Vendido]: 1,
    [AnimalStatus.Obito]: 2,
};

const STATUS_LABELS: Record<string, string> = {
    [AnimalStatus.Ativo]: 'Ativos',
    [AnimalStatus.Vendido]: 'Vendidos',
    [AnimalStatus.Obito]: 'Óbito',
};

const SEXO_LABELS: Record<string, string> = {
    [Sexo.Macho]: 'Machos',
    [Sexo.Femea]: 'Fêmeas',
};

export const getGroupColor = (groupBy: GroupBy, key: string): string => {
    if (groupBy === 'status') {
        if (key === AnimalStatus.Ativo) return 'bg-emerald-400';
        if (key === AnimalStatus.Vendido) return 'bg-amber-400';
        if (key === AnimalStatus.Obito) return 'bg-red-400';
    }
    if (groupBy === 'sexo') {
        if (key === Sexo.Macho) return 'bg-blue-400';
        if (key === Sexo.Femea) return 'bg-pink-400';
    }
    return 'bg-gray-400';
};

export const groupAnimals = (animals: Animal[], groupBy: GroupBy): AnimalGroup[] => {
    if (groupBy === 'none') {
        return [{ key: 'all', label: `Todos (${animals.length})`, animals }];
    }

    const groups = new Map<string, Animal[]>();

    for (const animal of animals) {
        let key: string;
        switch (groupBy) {
            case 'status':
                key = animal.status;
                break;
            case 'sexo':
                key = animal.sexo;
                break;
            case 'anoNascimento':
                key = animal.dataNascimento
                    ? new Date(animal.dataNascimento).getFullYear().toString()
                    : 'Sem data';
                break;
            default:
                key = 'all';
        }
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(animal);
    }

    const entries = Array.from(groups.entries());

    // Ordena: status por ordem definida, ano decrescente, sexo por M/F
    entries.sort(([a], [b]) => {
        if (groupBy === 'status') {
            return (STATUS_ORDER[a] ?? 99) - (STATUS_ORDER[b] ?? 99);
        }
        if (groupBy === 'anoNascimento') {
            if (a === 'Sem data') return 1;
            if (b === 'Sem data') return -1;
            return Number(b) - Number(a);
        }
        return a.localeCompare(b);
    });

    return entries.map(([key, groupAnimals]) => {
        let label: string;
        if (groupBy === 'status') {
            label = STATUS_LABELS[key] || key;
        } else if (groupBy === 'sexo') {
            label = SEXO_LABELS[key] || key;
        } else {
            label = key;
        }
        return {
            key,
            label: `${label} (${groupAnimals.length})`,
            animals: groupAnimals,
            color: getGroupColor(groupBy, key),
        };
    });
};

// Busca um animal pelo ID, brinco ou nome
export const findParent = (
    allAnimals: Animal[],
    nameOrBrinco?: string,
    id?: string
): Animal | undefined => {
    if (id) {
        const byId = allAnimals.find(a => a.id === id);
        if (byId) return byId;
    }
    if (!nameOrBrinco) return undefined;
    const searchTerm = nameOrBrinco.toLowerCase().trim();
    const byBrinco = allAnimals.find(a => a.brinco.toLowerCase().trim() === searchTerm);
    if (byBrinco) return byBrinco;
    return allAnimals.find(a => a.nome?.toLowerCase().trim() === searchTerm);
};

// Retorna o nome da mãe correto (considerando FIV)
export const getMaeNome = (animal: Animal): string | undefined => {
    if (animal.isFIV && animal.maeBiologicaNome) {
        return animal.maeBiologicaNome;
    }
    return animal.maeNome;
};

// Busca filhos de um animal
export const findOffspringOf = (parentAnimal: Animal, allAnimals: Animal[]): Animal[] => {
    return allAnimals.filter(a => {
        if (a.id === parentAnimal.id) return false;

        const parentBrinco = parentAnimal.brinco.toLowerCase().trim();
        const parentNome = parentAnimal.nome?.toLowerCase().trim();

        if (a.isFIV && a.maeBiologicaNome) {
            const maeBiologica = a.maeBiologicaNome.toLowerCase().trim();
            if (maeBiologica === parentBrinco || (parentNome && maeBiologica === parentNome)) return true;
        }
        if (a.maeNome) {
            const maeNome = a.maeNome.toLowerCase().trim();
            if (maeNome === parentBrinco || (parentNome && maeNome === parentNome)) return true;
        }
        if (a.paiNome) {
            const paiNome = a.paiNome.toLowerCase().trim();
            if (paiNome === parentBrinco || (parentNome && paiNome === parentNome)) return true;
        }
        if (a.maeId === parentAnimal.id || a.paiId === parentAnimal.id) return true;

        return false;
    });
};
