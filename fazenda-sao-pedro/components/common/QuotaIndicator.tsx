import React, { useState, useEffect } from 'react';
import { getQuotaUsage, getUsagePercentages, getQuotaWarnings, QuotaWarning } from '../../services/quotaMonitor';

interface QuotaIndicatorProps {
    showAlways?: boolean;
}

/**
 * Componente visual que mostra o uso de quota do Firebase
 * Só aparece quando o uso está acima de 50% (ou se showAlways=true)
 */
const QuotaIndicator: React.FC<QuotaIndicatorProps> = ({ showAlways = false }) => {
    const [percentages, setPercentages] = useState(getUsagePercentages());
    const [warnings, setWarnings] = useState<QuotaWarning[]>([]);
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
        const updateQuota = () => {
            setPercentages(getUsagePercentages());
            setWarnings(getQuotaWarnings());
        };

        updateQuota();
        // Atualiza a cada 30 segundos
        const interval = setInterval(updateQuota, 30000);
        return () => clearInterval(interval);
    }, []);

    const maxPercentage = Math.max(percentages.reads, percentages.writes, percentages.deletes);

    // Não mostra se abaixo de 50% (a menos que showAlways)
    if (!showAlways && maxPercentage < 50) return null;

    const getColor = (pct: number) => {
        if (pct >= 90) return 'bg-red-100 text-red-700 border-red-300';
        if (pct >= 75) return 'bg-orange-100 text-orange-700 border-orange-300';
        if (pct >= 50) return 'bg-yellow-100 text-yellow-700 border-yellow-300';
        return 'bg-green-100 text-green-700 border-green-300';
    };

    const getIcon = (pct: number) => {
        if (pct >= 90) return '⛔';
        if (pct >= 75) return '🔴';
        if (pct >= 50) return '🟡';
        return '🟢';
    };

    const getProgressColor = (pct: number) => {
        if (pct >= 90) return 'bg-red-500';
        if (pct >= 75) return 'bg-orange-500';
        if (pct >= 50) return 'bg-yellow-500';
        return 'bg-green-500';
    };

    return (
        <div
            className={`fixed bottom-4 right-4 z-50 rounded-lg shadow-lg border cursor-pointer transition-all duration-200 ${getColor(maxPercentage)}`}
            onClick={() => setIsExpanded(!isExpanded)}
        >
            <div className="p-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                    <span>{getIcon(maxPercentage)}</span>
                    <span>Quota: {maxPercentage.toFixed(0)}%</span>
                    <svg
                        className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>

                {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-current border-opacity-20 space-y-3">
                        {/* Barra de progresso - Leituras */}
                        <div>
                            <div className="flex justify-between text-xs mb-1">
                                <span>Leituras</span>
                                <span className="font-mono">{percentages.reads.toFixed(1)}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                    className={`h-2 rounded-full transition-all ${getProgressColor(percentages.reads)}`}
                                    style={{ width: `${Math.min(percentages.reads, 100)}%` }}
                                />
                            </div>
                        </div>

                        {/* Barra de progresso - Escritas */}
                        <div>
                            <div className="flex justify-between text-xs mb-1">
                                <span>Escritas</span>
                                <span className="font-mono">{percentages.writes.toFixed(1)}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                    className={`h-2 rounded-full transition-all ${getProgressColor(percentages.writes)}`}
                                    style={{ width: `${Math.min(percentages.writes, 100)}%` }}
                                />
                            </div>
                        </div>

                        {/* Barra de progresso - Exclusões */}
                        <div>
                            <div className="flex justify-between text-xs mb-1">
                                <span>Exclusões</span>
                                <span className="font-mono">{percentages.deletes.toFixed(1)}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                    className={`h-2 rounded-full transition-all ${getProgressColor(percentages.deletes)}`}
                                    style={{ width: `${Math.min(percentages.deletes, 100)}%` }}
                                />
                            </div>
                        </div>

                        {/* Avisos */}
                        {warnings.length > 0 && (
                            <div className="pt-2 border-t border-current border-opacity-20">
                                {warnings.slice(0, 2).map((w, i) => (
                                    <div key={i} className="text-xs opacity-80 mt-1">
                                        {w.message}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Info de reset */}
                        <div className="pt-2 text-center text-xs opacity-60">
                            Reseta à meia-noite
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default QuotaIndicator;
