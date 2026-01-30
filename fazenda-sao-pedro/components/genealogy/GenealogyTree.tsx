import React, { useMemo } from 'react';
import { Animal } from '../../types';
import { findOffspringOf } from './utils';
import AncestorTree from './AncestorTree';
import DescendantDashboard from './DescendantDashboard';
import GenealogyLegend from './GenealogyLegend';

interface GenealogyTreeProps {
    animal: Animal;
    allAnimals: Animal[];
}

const GenealogyTree = ({ animal, allAnimals }: GenealogyTreeProps) => {
    // Filhos (Geração +1)
    const filhos = useMemo(() => findOffspringOf(animal, allAnimals), [animal, allAnimals]);

    // Netos (Geração +2)
    const netos = useMemo(() => {
        const allNetos: Animal[] = [];
        for (const filho of filhos) {
            const netosDoFilho = findOffspringOf(filho, allAnimals);
            for (const neto of netosDoFilho) {
                if (!allNetos.find(n => n.id === neto.id)) {
                    allNetos.push(neto);
                }
            }
        }
        return allNetos;
    }, [filhos, allAnimals]);

    // Bisnetos (Geração +3)
    const bisnetos = useMemo(() => {
        const allBisnetos: Animal[] = [];
        for (const neto of netos) {
            const bisnetosDoNeto = findOffspringOf(neto, allAnimals);
            for (const bisneto of bisnetosDoNeto) {
                if (!allBisnetos.find(b => b.id === bisneto.id)) {
                    allBisnetos.push(bisneto);
                }
            }
        }
        return allBisnetos;
    }, [netos, allAnimals]);

    const hasDescendants = filhos.length > 0 || netos.length > 0 || bisnetos.length > 0;

    // Contagem de gerações para o título
    const hasPais = animal.paiNome || animal.paiId || animal.maeNome || animal.maeId || animal.maeBiologicaNome || animal.maeBiologicaId;
    const geracoesPosteriores = bisnetos.length > 0 ? 3 : netos.length > 0 ? 2 : filhos.length > 0 ? 1 : 0;

    return (
        <div className="mt-6 p-4 bg-base-900 rounded-lg overflow-x-auto">
            <h3 className="text-lg font-semibold text-white mb-4 text-center">
                Árvore Genealógica
                {(hasPais || geracoesPosteriores > 0) && (
                    <span className="text-xs text-gray-400 ml-2">
                        ({hasPais && 'ancestrais'}
                        {hasPais && geracoesPosteriores > 0 && ' + '}
                        {geracoesPosteriores > 0 && `${geracoesPosteriores} geração${geracoesPosteriores > 1 ? 'ões' : ''}`})
                    </span>
                )}
            </h3>

            <div className="flex flex-col items-center gap-2 min-w-[600px]">
                {/* Ancestrais + Animal Atual */}
                <AncestorTree animal={animal} allAnimals={allAnimals} />

                {/* Descendentes */}
                {hasDescendants && (
                    <DescendantDashboard
                        filhos={filhos}
                        netos={netos}
                        bisnetos={bisnetos}
                    />
                )}
            </div>

            {/* Legenda */}
            <GenealogyLegend
                showFIV={!!animal.isFIV}
                showDescendants={hasDescendants}
            />
        </div>
    );
};

export default GenealogyTree;
