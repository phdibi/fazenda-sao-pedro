import React, { useState, useEffect, useMemo } from 'react';
import { AnimalGroup } from './types';
import { computeStats } from './utils';
import OffspringMiniCard from './OffspringMiniCard';

interface OffspringGroupedGridProps {
    groups: AnimalGroup[];
    isSingleGroup: boolean;
}

const ITEMS_PER_PAGE = 48;

const OffspringGroupedGrid = ({ groups, isSingleGroup }: OffspringGroupedGridProps) => {
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
        const first = new Set<string>();
        if (groups.length > 0) first.add(groups[0].key);
        if (isSingleGroup) first.add('all');
        return first;
    });
    const [pages, setPages] = useState<Record<string, number>>({});

    const toggleGroup = (key: string) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    };

    const getPage = (key: string) => pages[key] || 0;
    const setPage = (key: string, page: number) => {
        setPages(prev => ({ ...prev, [key]: page }));
    };

    // Chave estável para detectar mudança de grupos
    const groupsKey = useMemo(() => groups.map(g => g.key).join(','), [groups]);

    useEffect(() => {
        if (isSingleGroup) {
            setExpandedGroups(new Set(['all']));
        } else {
            setExpandedGroups(new Set(groups.length > 0 ? [groups[0].key] : []));
        }
        setPages({});
    }, [groupsKey, isSingleGroup, groups]);

    return (
        <div className="space-y-2">
            {groups.map(group => {
                const isExpanded = isSingleGroup || expandedGroups.has(group.key);
                const page = getPage(group.key);
                const totalPages = Math.ceil(group.animals.length / ITEMS_PER_PAGE);
                const paginatedAnimals = group.animals.slice(
                    page * ITEMS_PER_PAGE,
                    (page + 1) * ITEMS_PER_PAGE
                );
                const groupStats = computeStats(group.animals);

                return (
                    <div key={group.key} className="rounded-lg overflow-hidden">
                        {/* Header do grupo (oculto se é grupo único) */}
                        {!isSingleGroup && (
                            <button
                                onClick={() => toggleGroup(group.key)}
                                className="w-full flex items-center gap-2 px-3 py-2 bg-base-800/60 hover:bg-base-800/80 transition-colors text-left"
                            >
                                <span className="text-gray-400 text-xs">
                                    {isExpanded ? '▼' : '▶'}
                                </span>
                                {group.color && (
                                    <span className={`w-2 h-2 rounded-full ${group.color}`} />
                                )}
                                <span className="text-sm text-gray-200 font-medium">
                                    {group.label}
                                </span>
                                <span className="flex-1" />
                                <span className="text-[10px] text-blue-400">
                                    M: {groupStats.machos}
                                </span>
                                <span className="text-[10px] text-pink-400 ml-2">
                                    F: {groupStats.femeas}
                                </span>
                            </button>
                        )}

                        {/* Grid de cards */}
                        {isExpanded && (
                            <div className={`${!isSingleGroup ? 'px-2 pt-2 pb-1' : ''}`}>
                                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 gap-1.5">
                                    {paginatedAnimals.map(animal => (
                                        <OffspringMiniCard key={animal.id} animal={animal} />
                                    ))}
                                </div>

                                {/* Paginação */}
                                {totalPages > 1 && (
                                    <div className="flex items-center justify-between mt-2 px-1 pb-1">
                                        <span className="text-[10px] text-gray-500">
                                            {page * ITEMS_PER_PAGE + 1}-{Math.min((page + 1) * ITEMS_PER_PAGE, group.animals.length)} de {group.animals.length}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setPage(group.key, page - 1)}
                                                disabled={page === 0}
                                                className="text-xs text-gray-400 hover:text-white disabled:text-gray-600 disabled:cursor-not-allowed px-1.5 py-0.5 rounded bg-base-700 hover:bg-base-600 disabled:bg-base-800"
                                            >
                                                ‹
                                            </button>
                                            <span className="text-[10px] text-gray-400">
                                                {page + 1}/{totalPages}
                                            </span>
                                            <button
                                                onClick={() => setPage(group.key, page + 1)}
                                                disabled={page >= totalPages - 1}
                                                className="text-xs text-gray-400 hover:text-white disabled:text-gray-600 disabled:cursor-not-allowed px-1.5 py-0.5 rounded bg-base-700 hover:bg-base-600 disabled:bg-base-800"
                                            >
                                                ›
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default OffspringGroupedGrid;
