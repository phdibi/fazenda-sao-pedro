import React from 'react';

interface GenealogyLegendProps {
    showFIV: boolean;
    showDescendants: boolean;
}

const GenealogyLegend = ({ showFIV, showDescendants }: GenealogyLegendProps) => (
    <div className="mt-4 pt-3 border-t border-base-700 flex flex-wrap justify-center gap-4 text-[10px] text-gray-500">
        <div className="flex items-center gap-1">
            <div className="w-3 h-1 bg-blue-400 rounded" />
            <span>Macho</span>
        </div>
        <div className="flex items-center gap-1">
            <div className="w-3 h-1 bg-pink-400 rounded" />
            <span>Fêmea</span>
        </div>
        <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-base-900/50 border border-dashed border-gray-600 rounded" />
            <span className="text-amber-600">Externo (não cadastrado)</span>
        </div>
        {showFIV && (
            <div className="flex items-center gap-1">
                <span className="bg-purple-600/50 text-purple-200 px-1 rounded">FIV</span>
                <span>Fertilização In Vitro</span>
            </div>
        )}
        {showDescendants && (
            <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-green-900/50 rounded" />
                <span>Descendentes</span>
            </div>
        )}
        <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Ativo</span>
        </div>
        <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-amber-400" />
            <span>Vendido</span>
        </div>
        <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-red-400" />
            <span>Óbito</span>
        </div>
    </div>
);

export default GenealogyLegend;
