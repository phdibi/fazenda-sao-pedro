import React from 'react';
import { AnimalStatus } from '../../types';
import { UserIcon } from '../common/Icons';
import { NodeProps } from './types';

const GenealogyNode = ({ animal, name, gender, level, isOffspring, generationLabel, isFIV, compact = false, isReference = false }: NodeProps) => {
    const getBgColor = () => {
        if (isReference) return 'bg-base-900/50';
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
    const textColor = isReference ? 'text-gray-400' : (level === 0 ? 'text-white' : 'text-gray-300');
    const genderColor = gender === 'M' ? 'border-blue-400' : gender === 'F' ? 'border-pink-400' : 'border-gray-400';
    const sizeClass = compact ? 'min-w-[70px] p-1' : 'min-w-[100px] p-2';
    const borderStyle = isReference ? 'border-dashed border border-gray-600' : '';

    const getStatusIndicator = () => {
        if (!animal?.status) return null;
        const cfg: Record<string, { color: string; label: string }> = {
            [AnimalStatus.Ativo]: { color: 'bg-emerald-400', label: 'Ativo' },
            [AnimalStatus.Vendido]: { color: 'bg-amber-400', label: 'Vendido' },
            [AnimalStatus.Obito]: { color: 'bg-red-400', label: 'Óbito' },
        };
        const st = cfg[animal.status];
        if (!st) return null;
        const dotSize = compact ? 'w-2 h-2' : 'w-2.5 h-2.5';
        return (
            <span
                className={`absolute top-1 right-1 ${dotSize} rounded-full ${st.color} border border-black/30`}
                title={st.label}
            />
        );
    };

    const displayName = animal?.nome || animal?.brinco || name || 'Desconhecido';
    const showBrinco = animal?.brinco && animal?.nome && animal.nome !== animal.brinco;

    return (
        <div className={`relative flex-1 ${sizeClass} rounded-lg text-center ${bgColor} border-b-2 ${genderColor} ${borderStyle} shadow-md`}>
            {getStatusIndicator()}
            <UserIcon className={`${compact ? 'w-3 h-3' : 'w-4 h-4'} mx-auto ${isReference ? 'text-gray-500' : 'text-gray-400'} mb-0.5`} />
            <p className={`font-bold ${compact ? 'text-[10px]' : 'text-sm'} ${textColor} truncate`}>
                {displayName}
            </p>
            {showBrinco && <p className={`${compact ? 'text-[9px]' : 'text-xs'} text-gray-400 truncate`}>{animal.brinco}</p>}
            {isReference && <p className={`${compact ? 'text-[7px]' : 'text-[9px]'} text-amber-600 italic`}>externo</p>}
            {generationLabel && <p className={`${compact ? 'text-[8px]' : 'text-[10px]'} text-green-400 mt-0.5`}>{generationLabel}</p>}
            {isFIV && <span className="inline-block bg-purple-600/50 text-purple-200 text-[8px] px-1 rounded mt-0.5">FIV</span>}
        </div>
    );
};

export default GenealogyNode;
