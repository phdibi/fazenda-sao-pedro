import React, { useState, useMemo } from 'react';
import { Animal } from '../../types';
import { GenerationView, GroupBy } from './types';
import { computeStats, groupAnimals } from './utils';
import { HorizontalConnector } from './GenealogyConnectors';
import OffspringGroupedGrid from './OffspringGroupedGrid';

interface DescendantDashboardProps {
    filhos: Animal[];
    netos: Animal[];
    bisnetos: Animal[];
}

const GROUP_OPTIONS: { value: GroupBy; label: string }[] = [
    { value: 'none', label: 'Todos' },
    { value: 'status', label: 'Status' },
    { value: 'sexo', label: 'Sexo' },
    { value: 'anoNascimento', label: 'Ano' },
];

const DescendantDashboard = ({ filhos, netos, bisnetos }: DescendantDashboardProps) => {
    const hasFilhos = filhos.length > 0;
    const hasNetos = netos.length > 0;
    const hasBisnetos = bisnetos.length > 0;
    const hasAny = hasFilhos || hasNetos || hasBisnetos;

    // Determinar as tabs disponíveis (memoizado para estabilidade)
    const availableGenerations = useMemo(() => {
        const gens: { key: GenerationView; label: string; animals: Animal[] }[] = [];
        if (hasFilhos) gens.push({ key: 'filhos', label: 'Filhos', animals: filhos });
        if (hasNetos) gens.push({ key: 'netos', label: 'Netos', animals: netos });
        if (hasBisnetos) gens.push({ key: 'bisnetos', label: 'Bisnetos', animals: bisnetos });
        return gens;
    }, [filhos, netos, bisnetos, hasFilhos, hasNetos, hasBisnetos]);

    // Primeira geração disponível como default
    const defaultGen = availableGenerations.length > 0 ? availableGenerations[0].key : 'filhos';

    const [activeGeneration, setActiveGeneration] = useState<GenerationView>(defaultGen);
    const [groupBy, setGroupBy] = useState<GroupBy>('none');

    const currentAnimals = useMemo(() => {
        switch (activeGeneration) {
            case 'filhos': return filhos;
            case 'netos': return netos;
            case 'bisnetos': return bisnetos;
        }
    }, [activeGeneration, filhos, netos, bisnetos]);

    const stats = useMemo(() => computeStats(currentAnimals), [currentAnimals]);
    const groups = useMemo(() => groupAnimals(currentAnimals, groupBy), [currentAnimals, groupBy]);

    // Total geral de descendentes
    const totalDescendentes = filhos.length + netos.length + bisnetos.length;

    // Hooks acima, early return abaixo -- respeita as regras de React Hooks
    if (!hasAny) return null;

    return (
        <>
            <HorizontalConnector />

            <div className="w-full">
                {/* Header */}
                <div className="text-center mb-3">
                    <p className="text-xs text-gray-500">
                        Descendentes ({totalDescendentes})
                    </p>
                </div>

                {/* Barra de Estatísticas */}
                <div className="bg-base-800/40 rounded-lg p-2.5 mb-3">
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                        <StatPill value={stats.total} label="Total" />
                        <StatPill value={stats.machos} label="Machos" color="text-blue-400" />
                        <StatPill value={stats.femeas} label="Fêmeas" color="text-pink-400" />
                        <StatPill value={stats.ativos} label="Ativos" color="text-emerald-400" />
                        <StatPill value={stats.vendidos} label="Vendidos" color="text-amber-400" />
                        {stats.obitos > 0 && (
                            <StatPill value={stats.obitos} label="Óbito" color="text-red-400" />
                        )}
                        {stats.fiv > 0 && (
                            <StatPill value={stats.fiv} label="FIV" color="text-purple-400" />
                        )}
                    </div>
                </div>

                {/* Tabs de Geração */}
                {availableGenerations.length > 1 && (
                    <div className="flex gap-1 mb-3 border-b border-base-700 pb-1">
                        {availableGenerations.map(gen => (
                            <button
                                key={gen.key}
                                onClick={() => {
                                    setActiveGeneration(gen.key);
                                    setGroupBy('none');
                                }}
                                className={`px-3 py-1.5 text-xs rounded-t-md transition-colors ${
                                    activeGeneration === gen.key
                                        ? 'bg-base-700 text-brand-primary-light border-b-2 border-brand-primary-light font-medium'
                                        : 'text-gray-400 hover:text-gray-300 hover:bg-base-800/50'
                                }`}
                            >
                                {gen.label} ({gen.animals.length})
                            </button>
                        ))}
                    </div>
                )}

                {/* Se tem apenas 1 geração, mostra o label */}
                {availableGenerations.length === 1 && (
                    <div className="mb-2">
                        <span className="text-xs text-gray-400 font-medium">
                            {availableGenerations[0].label} ({availableGenerations[0].animals.length})
                        </span>
                    </div>
                )}

                {/* Controles de agrupamento */}
                {currentAnimals.length > 3 && (
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-[10px] text-gray-500 whitespace-nowrap">Agrupar:</span>
                        <div className="flex gap-1">
                            {GROUP_OPTIONS.map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => setGroupBy(opt.value)}
                                    className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                                        groupBy === opt.value
                                            ? 'bg-base-600 text-white'
                                            : 'bg-base-800 text-gray-400 hover:text-gray-300 hover:bg-base-700'
                                    }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Grid agrupado */}
                <OffspringGroupedGrid
                    groups={groups}
                    isSingleGroup={groupBy === 'none'}
                />
            </div>
        </>
    );
};

// Componente de pill estatístico
const StatPill = ({ value, label, color }: { value: number; label: string; color?: string }) => (
    <div className="bg-base-700/60 rounded-md px-2 py-1 text-center">
        <p className={`font-bold text-sm ${color || 'text-white'}`}>{value}</p>
        <p className="text-[9px] text-gray-500">{label}</p>
    </div>
);

export default DescendantDashboard;
