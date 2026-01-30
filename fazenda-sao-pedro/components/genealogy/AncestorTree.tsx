import React from 'react';
import { Animal, Sexo } from '../../types';
import { AncestorRef } from './types';
import { findParent } from './utils';
import GenealogyNode from './GenealogyNode';
import { VerticalConnector, HorizontalConnector } from './GenealogyConnectors';

interface AncestorTreeProps {
    animal: Animal;
    allAnimals: Animal[];
}

const getAncestorRef = (
    allAnimals: Animal[],
    nameOrBrinco?: string,
    id?: string
): AncestorRef | undefined => {
    if (!nameOrBrinco && !id) return undefined;

    const foundAnimal = findParent(allAnimals, nameOrBrinco, id);

    if (foundAnimal) {
        return {
            animal: foundAnimal,
            refName: foundAnimal.nome || foundAnimal.brinco,
            paiNome: foundAnimal.paiNome,
            maeNome: foundAnimal.isFIV ? foundAnimal.maeBiologicaNome : foundAnimal.maeNome,
            isReference: false,
        };
    } else if (nameOrBrinco) {
        return {
            refName: nameOrBrinco,
            isReference: true,
        };
    }

    return undefined;
};

const getMaeNome = (a: Animal): string | undefined =>
    a.isFIV ? a.maeBiologicaNome : a.maeNome;

const getMaeId = (a: Animal): string | undefined =>
    a.isFIV ? a.maeBiologicaId : a.maeId;

const getMaeRef = (allAnimals: Animal[], a: Animal) =>
    getAncestorRef(allAnimals, getMaeNome(a), getMaeId(a));

const AncestorTree = ({ animal, allAnimals }: AncestorTreeProps) => {
    // Pais (Geração -1)
    const paiRef = getAncestorRef(allAnimals, animal.paiNome, animal.paiId);
    const maeRef = getMaeRef(allAnimals, animal);

    // Avós (Geração -2)
    const avoPaterno = paiRef?.animal ? getAncestorRef(allAnimals, paiRef.animal.paiNome, paiRef.animal.paiId) : undefined;
    const avoPaterna = paiRef?.animal ? getMaeRef(allAnimals, paiRef.animal) : undefined;

    const avoMaterno = maeRef?.animal ? getAncestorRef(allAnimals, maeRef.animal.paiNome, maeRef.animal.paiId) : undefined;
    const avoMaterna = maeRef?.animal ? getMaeRef(allAnimals, maeRef.animal) : undefined;

    // Bisavós (Geração -3)
    const bisavoPaternoPaterno = avoPaterno?.animal ? getAncestorRef(allAnimals, avoPaterno.animal.paiNome, avoPaterno.animal.paiId) : undefined;
    const bisavoPaternoPaterna = avoPaterno?.animal ? getMaeRef(allAnimals, avoPaterno.animal) : undefined;

    const bisavoPaternoMaterno = avoPaterna?.animal ? getAncestorRef(allAnimals, avoPaterna.animal.paiNome, avoPaterna.animal.paiId) : undefined;
    const bisavoPaternoMaterna = avoPaterna?.animal ? getMaeRef(allAnimals, avoPaterna.animal) : undefined;

    const bisavoMaternoPaterno = avoMaterno?.animal ? getAncestorRef(allAnimals, avoMaterno.animal.paiNome, avoMaterno.animal.paiId) : undefined;
    const bisavoMaternoPaterna = avoMaterno?.animal ? getMaeRef(allAnimals, avoMaterno.animal) : undefined;

    const bisavoMaternoMaterno = avoMaterna?.animal ? getAncestorRef(allAnimals, avoMaterna.animal.paiNome, avoMaterna.animal.paiId) : undefined;
    const bisavoMaternoMaterna = avoMaterna?.animal ? getMaeRef(allAnimals, avoMaterna.animal) : undefined;

    // Receptora (para FIV)
    const receptora = animal.isFIV && (animal.maeReceptoraNome || animal.maeReceptoraId)
        ? findParent(allAnimals, animal.maeReceptoraNome, animal.maeReceptoraId)
        : undefined;

    const hasBisavos = bisavoPaternoPaterno || bisavoPaternoPaterna ||
        bisavoPaternoMaterno || bisavoPaternoMaterna ||
        bisavoMaternoPaterno || bisavoMaternoPaterna ||
        bisavoMaternoMaterno || bisavoMaternoMaterna;

    const hasAvos = avoPaterno || avoPaterna || avoMaterno || avoMaterna;
    const hasPais = paiRef || maeRef;

    const renderAncestorNode = (ref: AncestorRef | undefined, gender: 'M' | 'F', level: number, compact = false) => {
        if (!ref) return null;
        return (
            <GenealogyNode
                animal={ref.animal}
                name={ref.refName}
                gender={gender}
                level={level}
                isFIV={ref.animal?.isFIV}
                isReference={ref.isReference}
                compact={compact}
            />
        );
    };

    return (
        <>
            {/* Bisavós */}
            {hasBisavos && (
                <>
                    <p className="text-xs text-gray-500 mb-1">Bisavós</p>
                    <div className="w-full flex justify-center gap-1">
                        <div className="flex-1 flex justify-center gap-1">
                            <div className="flex gap-1">
                                {renderAncestorNode(bisavoPaternoPaterno, 'M', 3, true)}
                                {renderAncestorNode(bisavoPaternoPaterna, 'F', 3, true)}
                            </div>
                            <div className="flex gap-1">
                                {renderAncestorNode(bisavoPaternoMaterno, 'M', 3, true)}
                                {renderAncestorNode(bisavoPaternoMaterna, 'F', 3, true)}
                            </div>
                        </div>
                        <div className="flex-1 flex justify-center gap-1">
                            <div className="flex gap-1">
                                {renderAncestorNode(bisavoMaternoPaterno, 'M', 3, true)}
                                {renderAncestorNode(bisavoMaternoPaterna, 'F', 3, true)}
                            </div>
                            <div className="flex gap-1">
                                {renderAncestorNode(bisavoMaternoMaterno, 'M', 3, true)}
                                {renderAncestorNode(bisavoMaternoMaterna, 'F', 3, true)}
                            </div>
                        </div>
                    </div>
                    <VerticalConnector />
                </>
            )}

            {/* Avós */}
            {hasAvos && (
                <>
                    <p className="text-xs text-gray-500 mb-1">Avós</p>
                    <div className="w-full flex justify-center gap-2 md:gap-4">
                        <div className="flex-1 flex justify-center gap-2">
                            {renderAncestorNode(avoPaterno, 'M', 2)}
                            {renderAncestorNode(avoPaterna, 'F', 2)}
                        </div>
                        <div className="flex-1 flex justify-center gap-2">
                            {renderAncestorNode(avoMaterno, 'M', 2)}
                            {renderAncestorNode(avoMaterna, 'F', 2)}
                        </div>
                    </div>
                    <VerticalConnector />
                </>
            )}

            {/* Pais */}
            {hasPais && (
                <>
                    <p className="text-xs text-gray-500 mb-1">Pais</p>
                    <div className="w-full flex justify-center gap-4 md:gap-8">
                        {renderAncestorNode(paiRef, 'M', 1)}
                        {renderAncestorNode(maeRef, 'F', 1)}
                    </div>

                    {animal.isFIV && (
                        <div className="text-center mt-1">
                            <span className="inline-block bg-purple-900/50 text-purple-300 text-xs px-2 py-1 rounded-full border border-purple-600">
                                FIV - Doadora: {animal.maeBiologicaNome || 'N/A'}
                            </span>
                        </div>
                    )}

                    <HorizontalConnector />
                </>
            )}

            {/* Receptora (FIV) */}
            {animal.isFIV && animal.maeReceptoraNome && (
                <div className="w-full flex justify-center mb-1">
                    <div className="bg-pink-900/30 border border-pink-700 rounded-lg px-3 py-1.5 text-center">
                        <p className="text-[10px] text-pink-400">Gestado por (Receptora)</p>
                        <p className="text-sm text-pink-200 font-semibold">
                            {receptora?.nome || animal.maeReceptoraNome}
                        </p>
                        {receptora && <p className="text-[10px] text-pink-400">Brinco: {receptora.brinco}</p>}
                    </div>
                </div>
            )}

            {/* Animal Atual */}
            <div className="w-1/2 md:w-1/3 lg:w-1/4">
                <GenealogyNode
                    animal={animal}
                    name={animal.nome}
                    gender={animal.sexo === Sexo.Macho ? 'M' : 'F'}
                    level={0}
                    isFIV={animal.isFIV}
                />
            </div>
        </>
    );
};

export default AncestorTree;
export { getAncestorRef };
