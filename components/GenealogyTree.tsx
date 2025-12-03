import React from 'react';
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
}

const Node = ({ animal, name, gender, level, isOffspring }: NodeProps) => {
    const bgColor = level === 0 
        ? 'bg-brand-primary' 
        : level === 1 
            ? 'bg-base-700' 
            : isOffspring 
                ? 'bg-green-900/50' 
                : 'bg-base-800/50';
    const textColor = level === 0 ? 'text-white' : 'text-gray-300';
    const genderColor = gender === 'M' ? 'border-blue-400' : 'border-pink-400';

    return (
      <div className={`flex-1 min-w-[120px] p-2 rounded-lg text-center ${bgColor} border-b-2 ${genderColor} shadow-md`}>
        <UserIcon className="w-5 h-5 mx-auto text-gray-400 mb-1" />
        <p className={`font-bold text-sm ${textColor}`}>{animal?.nome || name || 'Desconhecido'}</p>
        {animal?.brinco && <p className="text-xs text-gray-400">Brinco: {animal.brinco}</p>}
        {isOffspring && <p className="text-xs text-green-400 mt-1">Filho(a)</p>}
      </div>
    );
};

interface ConnectorProps {
    level: number;
    direction?: 'up' | 'down';
}

const Connector = ({ level, direction = 'up' }: ConnectorProps) => (
    <div className={`flex flex-col items-center justify-center ${level === 1 ? 'w-full' : 'w-1/2'}`}>
        <div className={`w-px h-4 ${level === 1 ? 'bg-base-600' : 'bg-transparent'}`}></div>
        <ShareIcon className={`w-4 h-4 text-base-600 ${level === 1 ? (direction === 'down' ? '-rotate-90' : 'rotate-90') : 'hidden'}`} />
        <div className={`w-px h-4 ${level === 1 ? 'bg-base-600' : 'bg-transparent'}`}></div>
    </div>
);


const GenealogyTree = ({ animal, allAnimals }: GenealogyTreeProps) => {
  // Busca um animal pelo nome ou brinco
  const findParent = (name?: string): Animal | undefined => {
    if (!name) return undefined;
    return allAnimals.find(a => 
        a.nome?.toLowerCase() === name.toLowerCase() || 
        a.brinco?.toLowerCase() === name.toLowerCase()
    );
  };

  // ============================================
  // 🔧 NOVO: Busca os filhos do animal
  // ============================================
  const findOffspring = (): Animal[] => {
    // Busca animais que têm este animal como mãe ou pai
    return allAnimals.filter(a => {
        if (a.id === animal.id) return false; // Não inclui o próprio animal
        
        const animalBrinco = animal.brinco.toLowerCase().trim();
        const animalNome = animal.nome?.toLowerCase().trim();
        
        // Verifica se é mãe
        if (a.maeNome) {
            const maeBrinco = a.maeNome.toLowerCase().trim();
            if (maeBrinco === animalBrinco || (animalNome && maeBrinco === animalNome)) {
                return true;
            }
        }
        
        // Verifica se é pai
        if (a.paiNome) {
            const paiBrinco = a.paiNome.toLowerCase().trim();
            if (paiBrinco === animalBrinco || (animalNome && paiBrinco === animalNome)) {
                return true;
            }
        }
        
        return false;
    });
  };

  const pai = findParent(animal.paiNome);
  const mae = findParent(animal.maeNome);

  const avoPaterno = pai ? findParent(pai.paiNome) : undefined;
  const avoPaterna = pai ? findParent(pai.maeNome) : undefined;

  const avoMaterno = mae ? findParent(mae.paiNome) : undefined;
  const avoMaterna = mae ? findParent(mae.maeNome) : undefined;

  // 🔧 NOVO: Busca os filhos
  const filhos = findOffspring();

  return (
    <div className="mt-6 p-4 bg-base-900 rounded-lg">
      <h3 className="text-lg font-semibold text-white mb-6 text-center">Árvore Genealógica</h3>
      <div className="flex flex-col items-center gap-4">
        
        {/* Level 2: Grandparents */}
        {(avoPaterno || avoPaterna || avoMaterno || avoMaterna) && (
            <>
                <div className="w-full flex flex-wrap justify-center gap-2 md:gap-4">
                    <div className="flex-1 flex justify-center gap-2 md:gap-4">
                        {avoPaterno && <Node animal={avoPaterno} gender="M" level={2} />}
                        {avoPaterna && <Node animal={avoPaterna} gender="F" level={2} />}
                    </div>
                    <div className="flex-1 flex justify-center gap-2 md:gap-4">
                        {avoMaterno && <Node animal={avoMaterno} gender="M" level={2} />}
                        {avoMaterna && <Node animal={avoMaterna} gender="F" level={2} />}
                    </div>
                </div>
                <div className="w-full flex justify-center">
                     <Connector level={2} />
                     <Connector level={2} />
                </div>
            </>
        )}
        
        {/* Level 1: Parents */}
        {(pai || mae || animal.paiNome || animal.maeNome) && (
            <>
                <div className="w-full flex flex-wrap justify-center gap-4 md:gap-8">
                    {pai ? <Node animal={pai} name={pai.nome} gender="M" level={1} /> : (animal.paiNome && <Node name={animal.paiNome} gender="M" level={1} />)}
                    {mae ? <Node animal={mae} name={mae.nome} gender="F" level={1} /> : (animal.maeNome && <Node name={animal.maeNome} gender="F" level={1} />)}
                </div>
                <Connector level={1} />
            </>
        )}
        
        {/* Level 0: Current Animal */}
        <div className="w-1/2 md:w-1/4">
            <Node animal={animal} name={animal.nome} gender={animal.sexo === Sexo.Macho ? 'M' : 'F'} level={0} />
        </div>
        
        {/* ============================================ */}
        {/* 🔧 NOVO: Level -1: Offspring (Filhos) */}
        {/* ============================================ */}
        {filhos.length > 0 && (
            <>
                <Connector level={1} direction="down" />
                <div className="w-full">
                    <p className="text-center text-sm text-gray-400 mb-2">Filhos ({filhos.length})</p>
                    <div className="flex flex-wrap justify-center gap-2 md:gap-4">
                        {filhos.map(filho => (
                            <Node 
                                key={filho.id} 
                                animal={filho} 
                                gender={filho.sexo === Sexo.Macho ? 'M' : 'F'} 
                                level={2} 
                                isOffspring={true}
                            />
                        ))}
                    </div>
                </div>
            </>
        )}
      </div>
    </div>
  );
};

export default GenealogyTree;
