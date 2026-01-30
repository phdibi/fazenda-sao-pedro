import React from 'react';
import { Animal, AnimalStatus, Sexo } from '../../types';

interface OffspringMiniCardProps {
    animal: Animal;
}

const OffspringMiniCard = ({ animal }: OffspringMiniCardProps) => {
    const genderBorder = animal.sexo === Sexo.Macho ? 'border-blue-400' : animal.sexo === Sexo.Femea ? 'border-pink-400' : 'border-gray-400';

    const statusCfg: Record<string, { color: string; label: string }> = {
        [AnimalStatus.Ativo]: { color: 'bg-emerald-400', label: 'Ativo' },
        [AnimalStatus.Vendido]: { color: 'bg-amber-400', label: 'Vendido' },
        [AnimalStatus.Obito]: { color: 'bg-red-400', label: 'Óbito' },
    };
    const st = statusCfg[animal.status];

    const displayName = animal.brinco;
    const showName = animal.nome && animal.nome !== animal.brinco;

    return (
        <div className={`relative bg-green-900/50 rounded-md p-1.5 text-center border-b-2 ${genderBorder} shadow-sm hover:bg-green-900/70 transition-colors`}>
            {st && (
                <span
                    className={`absolute top-0.5 right-0.5 w-2 h-2 rounded-full ${st.color} border border-black/30`}
                    title={st.label}
                />
            )}
            <p className="font-bold text-[11px] text-gray-200 truncate pr-2.5">
                {displayName}
            </p>
            {showName && (
                <p className="text-[9px] text-gray-400 truncate">{animal.nome}</p>
            )}
            {animal.isFIV && (
                <span className="inline-block bg-purple-600/50 text-purple-200 text-[7px] px-1 rounded mt-0.5">FIV</span>
            )}
        </div>
    );
};

export default OffspringMiniCard;
