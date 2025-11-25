import React, { useMemo } from 'react';
import { Animal, Sexo, AnimalStatus } from '../types';
import { TagIcon, ArrowsRightLeftIcon } from './common/Icons';

interface StatsDashboardProps {
  animals: Animal[];
}

interface StatCardProps {
  icon: React.ReactNode;
  title: string;
  value: React.ReactNode;
  subtitle?: string;
}

const StatCard = ({ icon, title, value, subtitle }: StatCardProps) => (
    <div className="bg-base-800 p-4 rounded-lg shadow-md flex items-center min-h-[95px]">
        <div className="p-3 rounded-full bg-brand-primary/20 text-brand-primary-light mr-4 self-start">
            {icon}
        </div>
        <div>
            <p className="text-sm text-gray-400">{title}</p>
            <div className="font-bold text-white">{value}</div>
            {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </div>
    </div>
);

// Define an interface for the stats object to ensure type consistency.
interface StatsData {
    breedDistribution: Record<string, number>;
    maleCount: number;
    femaleCount: number;
}

const StatsDashboard = ({ animals }: StatsDashboardProps) => {
    const stats = useMemo((): StatsData => {
        if (animals.length === 0) {
            return {
                breedDistribution: {},
                maleCount: 0,
                femaleCount: 0,
            };
        }

        const activeAnimals = animals.filter(a => a.status === AnimalStatus.Ativo);

        const maleCount = activeAnimals.filter(a => a.sexo === Sexo.Macho).length;
        const femaleCount = activeAnimals.filter(a => a.sexo === Sexo.Femea).length;
        
        const breedDistribution = activeAnimals.reduce((acc: Record<string, number>, animal) => {
            acc[animal.raca] = (acc[animal.raca] || 0) + 1;
            return acc;
        }, {});

        return {
            breedDistribution,
            maleCount,
            femaleCount,
        };
    }, [animals]);
    
    const breedValue = (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm pt-1">
            {Object.entries(stats.breedDistribution).length > 0 ? (
                Object.entries(stats.breedDistribution)
                    // Fix: Explicitly type sort parameters to ensure correct type inference for arithmetic operation.
                    .sort((a: [string, number], b: [string, number]) => b[1] - a[1])
                    .map(([raca, count]) => (
                        <span key={raca} className="whitespace-nowrap">{raca}: <strong className="text-lg">{count}</strong></span>
                    ))
            ) : (
                <span className="text-2xl">0</span>
            )}
        </div>
    );

    return (
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <StatCard 
                icon={<TagIcon className="w-6 h-6" />}
                title="Distribuição por Raça (Ativos)"
                value={breedValue}
                subtitle="Animais ativos nos filtros atuais"
            />
            <StatCard 
                icon={<ArrowsRightLeftIcon className="w-6 h-6" />}
                title="Distribuição / Sexo (Ativos)"
                value={<p className="text-2xl">{`${stats.maleCount} M / ${stats.femaleCount} F`}</p>}
                subtitle="Machos / Fêmeas"
            />
        </div>
    );
};

export default StatsDashboard;
