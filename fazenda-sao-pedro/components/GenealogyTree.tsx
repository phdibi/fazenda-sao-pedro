import React, { useMemo } from 'react';
import { Animal, Sexo } from '../types';
import { ShareIcon, UserIcon } from './common/Icons';

interface GenealogyTreeProps {
    animal: Animal;
    allAnimals: Animal[];
}

interface NodeProps {
    animal?: Animal;
    name?: string;
    gender: 'M' | 'F';
    level: number;
    isOffspring?: boolean;
    isFIV?: boolean;
    compact?: boolean;
}

const Node = ({ animal, name, gender, level, isOffspring, isFIV, compact = false }: NodeProps) => {
    const bgColor = level === 0
        ? 'bg-brand-primary'
        : level === 1
            ? 'bg-base-700'
            : level === 2
                ? 'bg-base-800/70'
                : isOffspring
                    ? 'bg-green-900/50'
                    : 'bg-base-800/40';
    const textColor = level === 0 ? 'text-white' : 'text-gray-300';
    const genderColor = gender === 'M' ? 'border-blue-400' : 'border-pink-400';
    const sizeClass = compact ? 'min-w-[80px] p-1' : 'min-w-[100px] p-2';

    return (
        <div className={`flex-1 ${sizeClass} rounded-lg text-center ${bgColor} border-b-2 ${genderColor} shadow-md`}>
            <UserIcon className={`${compact ? 'w-3 h-3' : 'w-4 h-4'} mx-auto text-gray-400 mb-0.5`} />
            <p className={`font-bold ${compact ? 'text-xs' : 'text-sm'} ${textColor} truncate`}>
                {animal?.nome || name || 'Desconhecido'}
            </p>
            {animal?.brinco && <p className={`${compact ? 'text-[10px]' : 'text-xs'} text-gray-400 truncate`}>{animal.brinco}</p>}
            {isOffspring && <p className="text-[10px] text-green-400 mt-0.5">Filho(a)</p>}
            {isFIV && <span className="inline-block bg-purple-600/50 text-purple-200 text-[9px] px-1 rounded mt-0.5">FIV</span>}
        </div>
    );
};

interface ConnectorProps {
    visible?: boolean;
}

const VerticalConnector = ({ visible = true }: ConnectorProps) => (
    <div className={`w-px h-3 ${visible ? 'bg-base-600' : 'bg-transparent'}`} />
);

const HorizontalConnector = () => (
    <div className="flex items-center justify-center w-full">
        <div className="flex-1 h-px bg-base-600" />
        <ShareIcon className="w-3 h-3 text-base-600 rotate-90 mx-1" />
        <div className="flex-1 h-px bg-base-600" />
    </div>
);

// ============================================
// Função auxiliar para obter a mãe correta (considera FIV)
// ============================================
const getMaeNome = (animal: Animal): string | undefined => {
    // Se for FIV, usa a mãe biológica (doadora)
    if (animal.isFIV && animal.maeBiologicaNome) {
        return animal.maeBiologicaNome;
    }
    return animal.maeNome;
};

const GenealogyTree = ({ animal, allAnimals }: GenealogyTreeProps) => {
    // ============================================
    // Busca um animal pelo nome ou brinco
    // ============================================
    const findParent = (name?: string): Animal | undefined => {
        if (!name) return undefined;
        return allAnimals.find(a =>
            a.nome?.toLowerCase() === name.toLowerCase() ||
            a.brinco?.toLowerCase() === name.toLowerCase()
        );
    };

    // ============================================
    // Busca os filhos do animal (considera FIV)
    // ============================================
    const findOffspring = useMemo(() => {
        const activeOffspring = allAnimals.filter(a => {
            if (a.id === animal.id) return false;

            const animalBrinco = animal.brinco.toLowerCase().trim();
            const animalNome = animal.nome?.toLowerCase().trim();

            // Verifica se é filho através de FIV (mãe biológica/doadora)
            if (a.isFIV && a.maeBiologicaNome) {
                const maeBiologica = a.maeBiologicaNome.toLowerCase().trim();
                if (maeBiologica === animalBrinco || (animalNome && maeBiologica === animalNome)) return true;
            }

            // Verifica mãe normal (não-FIV)
            if (a.maeNome && !a.isFIV) {
                const maeBrinco = a.maeNome.toLowerCase().trim();
                if (maeBrinco === animalBrinco || (animalNome && maeBrinco === animalNome)) return true;
            }

            // Verifica pai
            if (a.paiNome) {
                const paiBrinco = a.paiNome.toLowerCase().trim();
                if (paiBrinco === animalBrinco || (animalNome && paiBrinco === animalNome)) return true;
            }

            return false;
        });

        // Se for fêmea, inclui registros de progênie histórico
        if (animal.sexo === Sexo.Femea && animal.historicoProgenie) {
            const historicalOffspring = animal.historicoProgenie
                .filter(record => !activeOffspring.find(a => a.brinco.toLowerCase() === record.offspringBrinco.toLowerCase()))
                .map(record => ({
                    id: record.id,
                    brinco: record.offspringBrinco,
                    nome: record.offspringBrinco,
                    sexo: '?',
                    isGhost: true
                }));
            return [...activeOffspring, ...historicalOffspring];
        }

        return activeOffspring;
    }, [animal, allAnimals]);

    // ============================================
    // Monta a árvore genealógica com até 3 gerações
    // ============================================

    // Pais (Geração 1)
    const pai = findParent(animal.paiNome);
    const maeNomeParaGenealogia = getMaeNome(animal);
    const mae = findParent(maeNomeParaGenealogia);

    // Avós Paternos (Geração 2)
    const avoPaterno = pai ? findParent(pai.paiNome) : undefined;
    const avoPaternaNome = pai ? getMaeNome(pai) : undefined;
    const avoPaterna = avoPaternaNome ? findParent(avoPaternaNome) : undefined;

    // Avós Maternos (Geração 2)
    const avoMaterno = mae ? findParent(mae.paiNome) : undefined;
    const avoMaternaNome = mae ? getMaeNome(mae) : undefined;
    const avoMaterna = avoMaternaNome ? findParent(avoMaternaNome) : undefined;

    // Bisavós Paternos-Paterno (Geração 3) - Pai do Avô Paterno
    const bisavoPaternoPaterno = avoPaterno ? findParent(avoPaterno.paiNome) : undefined;
    const bisavoPaternoPaternaNome = avoPaterno ? getMaeNome(avoPaterno) : undefined;
    const bisavoPaternoPaterna = bisavoPaternoPaternaNome ? findParent(bisavoPaternoPaternaNome) : undefined;

    // Bisavós Paternos-Materno (Geração 3) - Pai da Avó Paterna
    const bisavoPaternoMaterno = avoPaterna ? findParent(avoPaterna.paiNome) : undefined;
    const bisavoPaternoMaternaNome = avoPaterna ? getMaeNome(avoPaterna) : undefined;
    const bisavoPaternoMaterna = bisavoPaternoMaternaNome ? findParent(bisavoPaternoMaternaNome) : undefined;

    // Bisavós Maternos-Paterno (Geração 3) - Pai do Avô Materno
    const bisavoMaternoPaterno = avoMaterno ? findParent(avoMaterno.paiNome) : undefined;
    const bisavoMaternoPaternaNome = avoMaterno ? getMaeNome(avoMaterno) : undefined;
    const bisavoMaternoPaterna = bisavoMaternoPaternaNome ? findParent(bisavoMaternoPaternaNome) : undefined;

    // Bisavós Maternos-Materno (Geração 3) - Pai da Avó Materna
    const bisavoMaternoMaterno = avoMaterna ? findParent(avoMaterna.paiNome) : undefined;
    const bisavoMaternoMaternaNome = avoMaterna ? getMaeNome(avoMaterna) : undefined;
    const bisavoMaternoMaterna = bisavoMaternoMaternaNome ? findParent(bisavoMaternoMaternaNome) : undefined;

    // Receptora (para FIV)
    const receptora = animal.isFIV && animal.maeReceptoraNome
        ? findParent(animal.maeReceptoraNome)
        : undefined;

    // Verifica se há dados em cada nível
    const hasBisavos = bisavoPaternoPaterno || bisavoPaternoPaterna ||
                       bisavoPaternoMaterno || bisavoPaternoMaterna ||
                       bisavoMaternoPaterno || bisavoMaternoPaterna ||
                       bisavoMaternoMaterno || bisavoMaternoMaterna;

    const hasAvos = avoPaterno || avoPaterna || avoMaterno || avoMaterna;
    const hasPais = pai || mae || animal.paiNome || maeNomeParaGenealogia;

    return (
        <div className="mt-6 p-4 bg-base-900 rounded-lg overflow-x-auto">
            <h3 className="text-lg font-semibold text-white mb-4 text-center">
                Árvore Genealógica
                {hasBisavos && <span className="text-xs text-gray-400 ml-2">(3 gerações)</span>}
            </h3>

            <div className="flex flex-col items-center gap-2 min-w-[600px]">

                {/* ============================================ */}
                {/* Geração 3: Bisavós */}
                {/* ============================================ */}
                {hasBisavos && (
                    <>
                        <p className="text-xs text-gray-500 mb-1">Bisavós</p>
                        <div className="w-full flex justify-center gap-1">
                            {/* Bisavós do lado Paterno */}
                            <div className="flex-1 flex justify-center gap-1">
                                {/* Pais do Avô Paterno */}
                                <div className="flex gap-1">
                                    {bisavoPaternoPaterno && <Node animal={bisavoPaternoPaterno} gender="M" level={3} compact isFIV={bisavoPaternoPaterno?.isFIV} />}
                                    {bisavoPaternoPaterna && <Node animal={bisavoPaternoPaterna} gender="F" level={3} compact isFIV={bisavoPaternoPaterna?.isFIV} />}
                                </div>
                                {/* Pais da Avó Paterna */}
                                <div className="flex gap-1">
                                    {bisavoPaternoMaterno && <Node animal={bisavoPaternoMaterno} gender="M" level={3} compact isFIV={bisavoPaternoMaterno?.isFIV} />}
                                    {bisavoPaternoMaterna && <Node animal={bisavoPaternoMaterna} gender="F" level={3} compact isFIV={bisavoPaternoMaterna?.isFIV} />}
                                </div>
                            </div>
                            {/* Bisavós do lado Materno */}
                            <div className="flex-1 flex justify-center gap-1">
                                {/* Pais do Avô Materno */}
                                <div className="flex gap-1">
                                    {bisavoMaternoPaterno && <Node animal={bisavoMaternoPaterno} gender="M" level={3} compact isFIV={bisavoMaternoPaterno?.isFIV} />}
                                    {bisavoMaternoPaterna && <Node animal={bisavoMaternoPaterna} gender="F" level={3} compact isFIV={bisavoMaternoPaterna?.isFIV} />}
                                </div>
                                {/* Pais da Avó Materna */}
                                <div className="flex gap-1">
                                    {bisavoMaternoMaterno && <Node animal={bisavoMaternoMaterno} gender="M" level={3} compact isFIV={bisavoMaternoMaterno?.isFIV} />}
                                    {bisavoMaternoMaterna && <Node animal={bisavoMaternoMaterna} gender="F" level={3} compact isFIV={bisavoMaternoMaterna?.isFIV} />}
                                </div>
                            </div>
                        </div>
                        <div className="w-full flex justify-center">
                            <VerticalConnector />
                        </div>
                    </>
                )}

                {/* ============================================ */}
                {/* Geração 2: Avós */}
                {/* ============================================ */}
                {hasAvos && (
                    <>
                        <p className="text-xs text-gray-500 mb-1">Avós</p>
                        <div className="w-full flex justify-center gap-2 md:gap-4">
                            {/* Avós Paternos */}
                            <div className="flex-1 flex justify-center gap-2">
                                {avoPaterno && <Node animal={avoPaterno} gender="M" level={2} isFIV={avoPaterno?.isFIV} />}
                                {avoPaterna && <Node animal={avoPaterna} gender="F" level={2} isFIV={avoPaterna?.isFIV} />}
                            </div>
                            {/* Avós Maternos */}
                            <div className="flex-1 flex justify-center gap-2">
                                {avoMaterno && <Node animal={avoMaterno} gender="M" level={2} isFIV={avoMaterno?.isFIV} />}
                                {avoMaterna && <Node animal={avoMaterna} gender="F" level={2} isFIV={avoMaterna?.isFIV} />}
                            </div>
                        </div>
                        <div className="w-full flex justify-center">
                            <VerticalConnector />
                        </div>
                    </>
                )}

                {/* ============================================ */}
                {/* Geração 1: Pais */}
                {/* ============================================ */}
                {hasPais && (
                    <>
                        <p className="text-xs text-gray-500 mb-1">Pais</p>
                        <div className="w-full flex justify-center gap-4 md:gap-8">
                            {pai
                                ? <Node animal={pai} gender="M" level={1} isFIV={pai?.isFIV} />
                                : animal.paiNome && <Node name={animal.paiNome} gender="M" level={1} />
                            }
                            {mae
                                ? <Node animal={mae} gender="F" level={1} isFIV={mae?.isFIV} />
                                : maeNomeParaGenealogia && <Node name={maeNomeParaGenealogia} gender="F" level={1} />
                            }
                        </div>

                        {/* Indicador FIV */}
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

                {/* ============================================ */}
                {/* Receptora (FIV) */}
                {/* ============================================ */}
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

                {/* ============================================ */}
                {/* Geração 0: Animal Atual */}
                {/* ============================================ */}
                <div className="w-1/2 md:w-1/3 lg:w-1/4">
                    <Node
                        animal={animal}
                        name={animal.nome}
                        gender={animal.sexo === Sexo.Macho ? 'M' : 'F'}
                        level={0}
                        isFIV={animal.isFIV}
                    />
                </div>

                {/* ============================================ */}
                {/* Filhos */}
                {/* ============================================ */}
                {findOffspring.length > 0 && (
                    <>
                        <HorizontalConnector />
                        <div className="w-full">
                            <p className="text-center text-xs text-gray-500 mb-2">Filhos ({findOffspring.length})</p>
                            <div className="flex flex-wrap justify-center gap-2">
                                {findOffspring.slice(0, 10).map((filho: any) => (
                                    <Node
                                        key={filho.id}
                                        animal={filho as Animal}
                                        name={filho.nome || filho.brinco}
                                        gender={filho.sexo === Sexo.Macho || filho.sexo === 'M' ? 'M' : filho.sexo === Sexo.Femea || filho.sexo === 'F' ? 'F' : 'M'}
                                        level={2}
                                        isOffspring={true}
                                        isFIV={filho.isFIV}
                                        compact
                                    />
                                ))}
                                {findOffspring.length > 10 && (
                                    <div className="flex items-center text-xs text-gray-400">
                                        +{findOffspring.length - 10} mais
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Legenda */}
            <div className="mt-4 pt-3 border-t border-base-700 flex flex-wrap justify-center gap-4 text-[10px] text-gray-500">
                <div className="flex items-center gap-1">
                    <div className="w-3 h-1 bg-blue-400 rounded" />
                    <span>Macho</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-3 h-1 bg-pink-400 rounded" />
                    <span>Fêmea</span>
                </div>
                {animal.isFIV && (
                    <div className="flex items-center gap-1">
                        <span className="bg-purple-600/50 text-purple-200 px-1 rounded">FIV</span>
                        <span>Fertilização In Vitro</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GenealogyTree;
