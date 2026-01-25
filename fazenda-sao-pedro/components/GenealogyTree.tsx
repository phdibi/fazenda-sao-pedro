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
    gender: 'M' | 'F' | '?';
    level: number;
    isOffspring?: boolean;
    generationLabel?: string;
    isFIV?: boolean;
    compact?: boolean;
}

const Node = ({ animal, name, gender, level, isOffspring, generationLabel, isFIV, compact = false }: NodeProps) => {
    // Cores baseadas no nível e se é descendente
    const getBgColor = () => {
        if (level === 0) return 'bg-brand-primary';
        if (isOffspring) {
            if (level === 1) return 'bg-green-900/60';
            if (level === 2) return 'bg-green-900/40';
            return 'bg-green-900/25';
        }
        if (level === 1) return 'bg-base-700';
        if (level === 2) return 'bg-base-800/70';
        return 'bg-base-800/40';
    };

    const bgColor = getBgColor();
    const textColor = level === 0 ? 'text-white' : 'text-gray-300';
    const genderColor = gender === 'M' ? 'border-blue-400' : gender === 'F' ? 'border-pink-400' : 'border-gray-400';
    const sizeClass = compact ? 'min-w-[70px] p-1' : 'min-w-[100px] p-2';

    // Nome de exibição: nome > brinco > name passado > "Desconhecido"
    const displayName = animal?.nome || animal?.brinco || name || 'Desconhecido';
    // Só mostra brinco separado se tem nome E brinco (e são diferentes)
    const showBrinco = animal?.brinco && animal?.nome && animal.nome !== animal.brinco;

    return (
        <div className={`flex-1 ${sizeClass} rounded-lg text-center ${bgColor} border-b-2 ${genderColor} shadow-md`}>
            <UserIcon className={`${compact ? 'w-3 h-3' : 'w-4 h-4'} mx-auto text-gray-400 mb-0.5`} />
            <p className={`font-bold ${compact ? 'text-[10px]' : 'text-sm'} ${textColor} truncate`}>
                {displayName}
            </p>
            {showBrinco && <p className={`${compact ? 'text-[9px]' : 'text-xs'} text-gray-400 truncate`}>{animal.brinco}</p>}
            {generationLabel && <p className={`${compact ? 'text-[8px]' : 'text-[10px]'} text-green-400 mt-0.5`}>{generationLabel}</p>}
            {isFIV && <span className="inline-block bg-purple-600/50 text-purple-200 text-[8px] px-1 rounded mt-0.5">FIV</span>}
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
    if (animal.isFIV && animal.maeBiologicaNome) {
        return animal.maeBiologicaNome;
    }
    return animal.maeNome;
};

const GenealogyTree = ({ animal, allAnimals }: GenealogyTreeProps) => {
    // ============================================
    // Busca um animal pelo ID, brinco ou nome
    // Prioridade: ID > Brinco > Nome
    // ============================================
    const findParent = (nameOrBrinco?: string, id?: string): Animal | undefined => {
        // Prioridade 1: busca por ID (mais confiável)
        if (id) {
            const byId = allAnimals.find(a => a.id === id);
            if (byId) return byId;
        }

        if (!nameOrBrinco) return undefined;
        const searchTerm = nameOrBrinco.toLowerCase().trim();

        // Prioridade 2: busca por BRINCO (exato) - os campos paiNome/maeNome armazenam brincos!
        const byBrinco = allAnimals.find(a => a.brinco.toLowerCase().trim() === searchTerm);
        if (byBrinco) return byBrinco;

        // Prioridade 3: busca por NOME (fallback)
        return allAnimals.find(a => a.nome?.toLowerCase().trim() === searchTerm);
    };

    // ============================================
    // Busca os filhos de um animal (considera FIV)
    // ============================================
    const findOffspringOf = (parentAnimal: Animal): Animal[] => {
        return allAnimals.filter(a => {
            if (a.id === parentAnimal.id) return false;

            const parentBrinco = parentAnimal.brinco.toLowerCase().trim();
            const parentNome = parentAnimal.nome?.toLowerCase().trim();

            // Verifica mãe biológica (FIV)
            if (a.isFIV && a.maeBiologicaNome) {
                const maeBiologica = a.maeBiologicaNome.toLowerCase().trim();
                if (maeBiologica === parentBrinco || (parentNome && maeBiologica === parentNome)) return true;
            }

            // Verifica mãe normal
            if (a.maeNome) {
                const maeNome = a.maeNome.toLowerCase().trim();
                if (maeNome === parentBrinco || (parentNome && maeNome === parentNome)) return true;
            }

            // Verifica pai
            if (a.paiNome) {
                const paiNome = a.paiNome.toLowerCase().trim();
                if (paiNome === parentBrinco || (parentNome && paiNome === parentNome)) return true;
            }

            // Verifica por ID
            if (a.maeId === parentAnimal.id || a.paiId === parentAnimal.id) return true;

            return false;
        });
    };

    // ============================================
    // GERAÇÕES ANTERIORES (Ancestrais)
    // Busca por ID primeiro, depois por nome/brinco
    // ============================================

    // Pais (Geração -1)
    const pai = findParent(animal.paiNome, animal.paiId);
    const maeNomeParaGenealogia = getMaeNome(animal);
    const maeIdParaGenealogia = animal.isFIV ? animal.maeBiologicaId : animal.maeId;
    const mae = findParent(maeNomeParaGenealogia, maeIdParaGenealogia);

    // Avós (Geração -2)
    const avoPaterno = pai ? findParent(pai.paiNome, pai.paiId) : undefined;
    const avoPaternaNome = pai ? getMaeNome(pai) : undefined;
    const avoPaternaMaeId = pai ? (pai.isFIV ? pai.maeBiologicaId : pai.maeId) : undefined;
    const avoPaterna = avoPaternaNome || avoPaternaMaeId ? findParent(avoPaternaNome, avoPaternaMaeId) : undefined;

    const avoMaterno = mae ? findParent(mae.paiNome, mae.paiId) : undefined;
    const avoMaternaNome = mae ? getMaeNome(mae) : undefined;
    const avoMaternaMaeId = mae ? (mae.isFIV ? mae.maeBiologicaId : mae.maeId) : undefined;
    const avoMaterna = avoMaternaNome || avoMaternaMaeId ? findParent(avoMaternaNome, avoMaternaMaeId) : undefined;

    // Bisavós (Geração -3)
    const bisavoPaternoPaterno = avoPaterno ? findParent(avoPaterno.paiNome, avoPaterno.paiId) : undefined;
    const bisavoPaternoPaternaNome = avoPaterno ? getMaeNome(avoPaterno) : undefined;
    const bisavoPaternoPaternaMaeId = avoPaterno ? (avoPaterno.isFIV ? avoPaterno.maeBiologicaId : avoPaterno.maeId) : undefined;
    const bisavoPaternoPaterna = bisavoPaternoPaternaNome || bisavoPaternoPaternaMaeId ? findParent(bisavoPaternoPaternaNome, bisavoPaternoPaternaMaeId) : undefined;

    const bisavoPaternoMaterno = avoPaterna ? findParent(avoPaterna.paiNome, avoPaterna.paiId) : undefined;
    const bisavoPaternoMaternaNome = avoPaterna ? getMaeNome(avoPaterna) : undefined;
    const bisavoPaternoMaternaMaeId = avoPaterna ? (avoPaterna.isFIV ? avoPaterna.maeBiologicaId : avoPaterna.maeId) : undefined;
    const bisavoPaternoMaterna = bisavoPaternoMaternaNome || bisavoPaternoMaternaMaeId ? findParent(bisavoPaternoMaternaNome, bisavoPaternoMaternaMaeId) : undefined;

    const bisavoMaternoPaterno = avoMaterno ? findParent(avoMaterno.paiNome, avoMaterno.paiId) : undefined;
    const bisavoMaternoPaternaNome = avoMaterno ? getMaeNome(avoMaterno) : undefined;
    const bisavoMaternoPaternaMaeId = avoMaterno ? (avoMaterno.isFIV ? avoMaterno.maeBiologicaId : avoMaterno.maeId) : undefined;
    const bisavoMaternoPaterna = bisavoMaternoPaternaNome || bisavoMaternoPaternaMaeId ? findParent(bisavoMaternoPaternaNome, bisavoMaternoPaternaMaeId) : undefined;

    const bisavoMaternoMaterno = avoMaterna ? findParent(avoMaterna.paiNome, avoMaterna.paiId) : undefined;
    const bisavoMaternoMaternaNome = avoMaterna ? getMaeNome(avoMaterna) : undefined;
    const bisavoMaternoMaternaMaeId = avoMaterna ? (avoMaterna.isFIV ? avoMaterna.maeBiologicaId : avoMaterna.maeId) : undefined;
    const bisavoMaternoMaterna = bisavoMaternoMaternaNome || bisavoMaternoMaternaMaeId ? findParent(bisavoMaternoMaternaNome, bisavoMaternoMaternaMaeId) : undefined;

    // ============================================
    // GERAÇÕES POSTERIORES (Descendentes)
    // ============================================

    // Filhos (Geração +1)
    const filhos = useMemo(() => findOffspringOf(animal), [animal, allAnimals]);

    // Netos (Geração +2) - filhos dos filhos
    const netos = useMemo(() => {
        const allNetos: Animal[] = [];
        for (const filho of filhos) {
            const netosDoFilho = findOffspringOf(filho);
            for (const neto of netosDoFilho) {
                if (!allNetos.find(n => n.id === neto.id)) {
                    allNetos.push(neto);
                }
            }
        }
        return allNetos;
    }, [filhos, allAnimals]);

    // Bisnetos (Geração +3) - filhos dos netos
    const bisnetos = useMemo(() => {
        const allBisnetos: Animal[] = [];
        for (const neto of netos) {
            const bisnetosDoNeto = findOffspringOf(neto);
            for (const bisneto of bisnetosDoNeto) {
                if (!allBisnetos.find(b => b.id === bisneto.id)) {
                    allBisnetos.push(bisneto);
                }
            }
        }
        return allBisnetos;
    }, [netos, allAnimals]);

    // Receptora (para FIV)
    const receptora = animal.isFIV && (animal.maeReceptoraNome || animal.maeReceptoraId)
        ? findParent(animal.maeReceptoraNome, animal.maeReceptoraId)
        : undefined;

    // DEBUG: Log para verificar busca de avós
    console.log('🔍 GenealogyTree Debug:', {
        animal: animal.brinco,
        paiNome: animal.paiNome,
        maeNome: animal.maeNome,
        maeId: animal.maeId,
        paiEncontrado: pai ? { brinco: pai.brinco, paiNome: pai.paiNome, maeNome: pai.maeNome, paiId: pai.paiId, maeId: pai.maeId } : 'NÃO ENCONTRADO',
        maeEncontrada: mae ? { brinco: mae.brinco, paiNome: mae.paiNome, maeNome: mae.maeNome, paiId: mae.paiId, maeId: mae.maeId } : 'NÃO ENCONTRADA',
        avoPaterno: avoPaterno?.brinco || 'não encontrado',
        avoPaterna: avoPaterna?.brinco || 'não encontrada',
        avoMaterno: avoMaterno?.brinco || 'não encontrado',
        avoMaterna: avoMaterna?.brinco || 'não encontrada',
    });

    // Flags de verificação
    const hasBisavos = bisavoPaternoPaterno || bisavoPaternoPaterna ||
                       bisavoPaternoMaterno || bisavoPaternoMaterna ||
                       bisavoMaternoPaterno || bisavoMaternoPaterna ||
                       bisavoMaternoMaterno || bisavoMaternoMaterna;

    const hasAvos = avoPaterno || avoPaterna || avoMaterno || avoMaterna;
    const hasPais = pai || mae || animal.paiNome || maeNomeParaGenealogia;
    const hasFilhos = filhos.length > 0;
    const hasNetos = netos.length > 0;
    const hasBisnetos = bisnetos.length > 0;

    // Contagem de gerações
    const geracoesAnteriores = (hasBisavos ? 3 : hasAvos ? 2 : hasPais ? 1 : 0);
    const geracoesPosteriores = (hasBisnetos ? 3 : hasNetos ? 2 : hasFilhos ? 1 : 0);

    return (
        <div className="mt-6 p-4 bg-base-900 rounded-lg overflow-x-auto">
            <h3 className="text-lg font-semibold text-white mb-4 text-center">
                Árvore Genealógica
                {(geracoesAnteriores > 0 || geracoesPosteriores > 0) && (
                    <span className="text-xs text-gray-400 ml-2">
                        ({geracoesAnteriores > 0 && `${geracoesAnteriores} anterior${geracoesAnteriores > 1 ? 'es' : ''}`}
                        {geracoesAnteriores > 0 && geracoesPosteriores > 0 && ' + '}
                        {geracoesPosteriores > 0 && `${geracoesPosteriores} posterior${geracoesPosteriores > 1 ? 'es' : ''}`})
                    </span>
                )}
            </h3>

            <div className="flex flex-col items-center gap-2 min-w-[600px]">

                {/* ============================================ */}
                {/* Geração -3: Bisavós */}
                {/* ============================================ */}
                {hasBisavos && (
                    <>
                        <p className="text-xs text-gray-500 mb-1">Bisavós</p>
                        <div className="w-full flex justify-center gap-1">
                            <div className="flex-1 flex justify-center gap-1">
                                <div className="flex gap-1">
                                    {bisavoPaternoPaterno && <Node animal={bisavoPaternoPaterno} gender="M" level={3} compact isFIV={bisavoPaternoPaterno?.isFIV} />}
                                    {bisavoPaternoPaterna && <Node animal={bisavoPaternoPaterna} gender="F" level={3} compact isFIV={bisavoPaternoPaterna?.isFIV} />}
                                </div>
                                <div className="flex gap-1">
                                    {bisavoPaternoMaterno && <Node animal={bisavoPaternoMaterno} gender="M" level={3} compact isFIV={bisavoPaternoMaterno?.isFIV} />}
                                    {bisavoPaternoMaterna && <Node animal={bisavoPaternoMaterna} gender="F" level={3} compact isFIV={bisavoPaternoMaterna?.isFIV} />}
                                </div>
                            </div>
                            <div className="flex-1 flex justify-center gap-1">
                                <div className="flex gap-1">
                                    {bisavoMaternoPaterno && <Node animal={bisavoMaternoPaterno} gender="M" level={3} compact isFIV={bisavoMaternoPaterno?.isFIV} />}
                                    {bisavoMaternoPaterna && <Node animal={bisavoMaternoPaterna} gender="F" level={3} compact isFIV={bisavoMaternoPaterna?.isFIV} />}
                                </div>
                                <div className="flex gap-1">
                                    {bisavoMaternoMaterno && <Node animal={bisavoMaternoMaterno} gender="M" level={3} compact isFIV={bisavoMaternoMaterno?.isFIV} />}
                                    {bisavoMaternoMaterna && <Node animal={bisavoMaternoMaterna} gender="F" level={3} compact isFIV={bisavoMaternoMaterna?.isFIV} />}
                                </div>
                            </div>
                        </div>
                        <VerticalConnector />
                    </>
                )}

                {/* ============================================ */}
                {/* Geração -2: Avós */}
                {/* ============================================ */}
                {hasAvos && (
                    <>
                        <p className="text-xs text-gray-500 mb-1">Avós</p>
                        <div className="w-full flex justify-center gap-2 md:gap-4">
                            <div className="flex-1 flex justify-center gap-2">
                                {avoPaterno && <Node animal={avoPaterno} gender="M" level={2} isFIV={avoPaterno?.isFIV} />}
                                {avoPaterna && <Node animal={avoPaterna} gender="F" level={2} isFIV={avoPaterna?.isFIV} />}
                            </div>
                            <div className="flex-1 flex justify-center gap-2">
                                {avoMaterno && <Node animal={avoMaterno} gender="M" level={2} isFIV={avoMaterno?.isFIV} />}
                                {avoMaterna && <Node animal={avoMaterna} gender="F" level={2} isFIV={avoMaterna?.isFIV} />}
                            </div>
                        </div>
                        <VerticalConnector />
                    </>
                )}

                {/* ============================================ */}
                {/* Geração -1: Pais */}
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
                {/* Geração +1: Filhos */}
                {/* ============================================ */}
                {hasFilhos && (
                    <>
                        <HorizontalConnector />
                        <div className="w-full">
                            <p className="text-center text-xs text-gray-500 mb-2">Filhos ({filhos.length})</p>
                            <div className="flex flex-wrap justify-center gap-2">
                                {filhos.slice(0, 12).map((filho) => (
                                    <Node
                                        key={filho.id}
                                        animal={filho}
                                        name={filho.nome || filho.brinco}
                                        gender={filho.sexo === Sexo.Macho ? 'M' : filho.sexo === Sexo.Femea ? 'F' : '?'}
                                        level={1}
                                        isOffspring={true}
                                        isFIV={filho.isFIV}
                                        compact
                                    />
                                ))}
                                {filhos.length > 12 && (
                                    <div className="flex items-center text-xs text-gray-400">
                                        +{filhos.length - 12} mais
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}

                {/* ============================================ */}
                {/* Geração +2: Netos */}
                {/* ============================================ */}
                {hasNetos && (
                    <>
                        <VerticalConnector />
                        <div className="w-full">
                            <p className="text-center text-xs text-gray-500 mb-2">Netos ({netos.length})</p>
                            <div className="flex flex-wrap justify-center gap-1">
                                {netos.slice(0, 15).map((neto) => (
                                    <Node
                                        key={neto.id}
                                        animal={neto}
                                        name={neto.nome || neto.brinco}
                                        gender={neto.sexo === Sexo.Macho ? 'M' : neto.sexo === Sexo.Femea ? 'F' : '?'}
                                        level={2}
                                        isOffspring={true}
                                        isFIV={neto.isFIV}
                                        compact
                                    />
                                ))}
                                {netos.length > 15 && (
                                    <div className="flex items-center text-xs text-gray-400">
                                        +{netos.length - 15} mais
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}

                {/* ============================================ */}
                {/* Geração +3: Bisnetos */}
                {/* ============================================ */}
                {hasBisnetos && (
                    <>
                        <VerticalConnector />
                        <div className="w-full">
                            <p className="text-center text-xs text-gray-500 mb-2">Bisnetos ({bisnetos.length})</p>
                            <div className="flex flex-wrap justify-center gap-1">
                                {bisnetos.slice(0, 18).map((bisneto) => (
                                    <Node
                                        key={bisneto.id}
                                        animal={bisneto}
                                        name={bisneto.nome || bisneto.brinco}
                                        gender={bisneto.sexo === Sexo.Macho ? 'M' : bisneto.sexo === Sexo.Femea ? 'F' : '?'}
                                        level={3}
                                        isOffspring={true}
                                        isFIV={bisneto.isFIV}
                                        compact
                                    />
                                ))}
                                {bisnetos.length > 18 && (
                                    <div className="flex items-center text-xs text-gray-400">
                                        +{bisnetos.length - 18} mais
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
                {(hasFilhos || hasNetos || hasBisnetos) && (
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-green-900/50 rounded" />
                        <span>Descendentes</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GenealogyTree;
