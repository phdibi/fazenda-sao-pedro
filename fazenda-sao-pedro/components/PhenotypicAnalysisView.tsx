import React, { useState } from 'react';
import { Animal, Raca, Sexo } from '../types';
import { generatePhenotypicAnalysis, PhenotypicData } from '../services/geminiServiceOptimized';
import Spinner from './common/Spinner';
import { SparklesIcon } from './common/Icons';

interface PhenotypicAnalysisViewProps {
    animals: Animal[];
}

interface AnimalSelectionState {
    mode: 'herd' | 'external';
    selectedAnimalId: string;
    externalData: {
        name: string;
        breed: string;
        traits: string;
        age: string;
        weight: string;
    };
}

const initialSelectionState: AnimalSelectionState = {
    mode: 'herd',
    selectedAnimalId: '',
    externalData: {
        name: '',
        breed: '',
        traits: '',
        age: '',
        weight: ''
    }
};

const PhenotypicAnalysisView: React.FC<PhenotypicAnalysisViewProps> = ({ animals }) => {
    const [animalA, setAnimalA] = useState<AnimalSelectionState>(initialSelectionState);
    const [animalB, setAnimalB] = useState<AnimalSelectionState>(initialSelectionState);
    const [analysisResult, setAnalysisResult] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string>('');

    const handleSelectionChange = (
        setter: React.Dispatch<React.SetStateAction<AnimalSelectionState>>,
        field: keyof AnimalSelectionState | keyof AnimalSelectionState['externalData'],
        value: string
    ) => {
        setter(prev => {
            if (field === 'mode') {
                return { ...prev, mode: value as 'herd' | 'external', selectedAnimalId: '', analysisResult: null };
            }
            if (field === 'selectedAnimalId') {
                return { ...prev, selectedAnimalId: value };
            }
            // External data fields
            return {
                ...prev,
                externalData: {
                    ...prev.externalData,
                    [field]: value
                }
            };
        });
    };

    const prepareData = (state: AnimalSelectionState): PhenotypicData | null => {
        if (state.mode === 'herd') {
            const animal = animals.find(a => a.id === state.selectedAnimalId);
            if (!animal) return null;

            // Construir string de traits baseada em dados disponíveis
            const traits = [
                animal.observacoes,
                `Sexo: ${animal.sexo}`,
                animal.maeNome ? `Mãe: ${animal.maeNome}` : '',
                animal.paiNome ? `Pai: ${animal.paiNome}` : '',
                animal.pesoKg ? `Peso atual: ${animal.pesoKg}kg` : ''
            ].filter(Boolean).join('. ');

            return {
                name: `${animal.nome || ''} (Brinco: ${animal.brinco})`,
                breed: animal.raca,
                traits: traits || 'Sem observações registradas.',
                age: animal.dataNascimento ? new Date(animal.dataNascimento).toLocaleDateString('pt-BR') : undefined,
                weight: animal.pesoKg,
                isExternal: false
            };
        } else {
            if (!state.externalData.breed || !state.externalData.traits) return null;
            return {
                name: state.externalData.name || 'Animal Externo',
                breed: state.externalData.breed,
                traits: state.externalData.traits,
                age: state.externalData.age,
                weight: state.externalData.weight ? parseFloat(state.externalData.weight) : undefined,
                isExternal: true
            };
        }
    };

    const handleAnalyze = async () => {
        setError('');
        setAnalysisResult(null);

        const dataA = prepareData(animalA);
        const dataB = prepareData(animalB);

        if (!dataA || !dataB) {
            setError('Por favor, preencha todos os dados obrigatórios para ambos os animais.');
            return;
        }

        setIsLoading(true);
        try {
            const result = await generatePhenotypicAnalysis(dataA, dataB);
            setAnalysisResult(result);
        } catch (err) {
            setError('Erro ao gerar análise. Tente novamente.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const renderAnimalInput = (
        title: string,
        state: AnimalSelectionState,
        setter: React.Dispatch<React.SetStateAction<AnimalSelectionState>>
    ) => (
        <div className="bg-base-800 p-6 rounded-lg shadow-lg flex-1 min-w-[300px]">
            <h3 className="text-xl font-bold text-white mb-4 border-b border-base-700 pb-2">{title}</h3>

            <div className="flex gap-4 mb-4">
                <label className="flex items-center cursor-pointer">
                    <input
                        type="radio"
                        checked={state.mode === 'herd'}
                        onChange={() => handleSelectionChange(setter, 'mode', 'herd')}
                        className="form-radio text-brand-primary h-4 w-4"
                    />
                    <span className="ml-2 text-gray-300">Do Rebanho</span>
                </label>
                <label className="flex items-center cursor-pointer">
                    <input
                        type="radio"
                        checked={state.mode === 'external'}
                        onChange={() => handleSelectionChange(setter, 'mode', 'external')}
                        className="form-radio text-brand-primary h-4 w-4"
                    />
                    <span className="ml-2 text-gray-300">Externo</span>
                </label>
            </div>

            {state.mode === 'herd' ? (
                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Selecione o Animal</label>
                    <select
                        value={state.selectedAnimalId}
                        onChange={(e) => handleSelectionChange(setter, 'selectedAnimalId', e.target.value)}
                        className="w-full bg-base-700 text-white rounded-md border-base-600 focus:ring-brand-primary focus:border-brand-primary"
                    >
                        <option value="">Selecione...</option>
                        {animals.map(a => (
                            <option key={a.id} value={a.id}>
                                {a.brinco} - {a.nome || 'Sem nome'} ({a.sexo})
                            </option>
                        ))}
                    </select>
                </div>
            ) : (
                <div className="space-y-3">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Nome / Identificação</label>
                        <input
                            type="text"
                            value={state.externalData.name}
                            onChange={(e) => handleSelectionChange(setter, 'name', e.target.value)}
                            className="w-full bg-base-700 text-white rounded-md border-base-600 p-2 text-sm"
                            placeholder="Ex: Touro Bandido"
                        />
                    </div>
                    <div className="flex gap-2">
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-400 mb-1">Raça *</label>
                            <select
                                value={state.externalData.breed}
                                onChange={(e) => handleSelectionChange(setter, 'breed', e.target.value)}
                                className="w-full bg-base-700 text-white rounded-md border-base-600 p-2 text-sm"
                            >
                                <option value="">Selecione...</option>
                                {Object.values(Raca).map(r => (
                                    <option key={r} value={r}>{r}</option>
                                ))}
                                <option value="Outra">Outra</option>
                            </select>
                        </div>
                         <div className="w-1/3">
                            <label className="block text-sm font-medium text-gray-400 mb-1">Peso (kg)</label>
                            <input
                                type="number"
                                value={state.externalData.weight}
                                onChange={(e) => handleSelectionChange(setter, 'weight', e.target.value)}
                                className="w-full bg-base-700 text-white rounded-md border-base-600 p-2 text-sm"
                                placeholder="Ex: 800"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Idade / Nascimento</label>
                        <input
                            type="text"
                            value={state.externalData.age}
                            onChange={(e) => handleSelectionChange(setter, 'age', e.target.value)}
                            className="w-full bg-base-700 text-white rounded-md border-base-600 p-2 text-sm"
                            placeholder="Ex: 5 anos ou 12/05/2019"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Características / Observações *</label>
                        <textarea
                            value={state.externalData.traits}
                            onChange={(e) => handleSelectionChange(setter, 'traits', e.target.value)}
                            className="w-full bg-base-700 text-white rounded-md border-base-600 p-2 text-sm h-24"
                            placeholder="Descreva as características fenotípicas: musculatura, aprumos, umbigo, pigmentação, temperamento, etc."
                        />
                    </div>
                </div>
            )}
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="bg-base-800/50 p-4 rounded-lg border border-base-700">
                <p className="text-gray-300 text-sm">
                    <span className="font-bold text-brand-primary">Dica:</span> Selecione dois animais para comparar.
                    Se um deles não estiver no rebanho (ex: sêmen externo ou touro vizinho),
                    selecione "Externo" e preencha os dados manualmente. A IA analisará a compatibilidade.
                </p>
            </div>

            <div className="flex flex-col md:flex-row gap-6">
                {renderAnimalInput("Animal A (Matriz/Reprodutor)", animalA, setAnimalA)}

                <div className="flex items-center justify-center">
                    <div className="hidden md:block text-4xl text-brand-primary">×</div>
                    <div className="md:hidden text-2xl text-brand-primary my-2">VS</div>
                </div>

                {renderAnimalInput("Animal B (Reprodutor/Matriz)", animalB, setAnimalB)}
            </div>

            <div className="flex justify-center mt-6">
                <button
                    onClick={handleAnalyze}
                    disabled={isLoading}
                    className="w-full md:w-auto px-8 py-3 bg-brand-primary hover:bg-brand-primary-light text-white font-bold rounded-lg shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isLoading ? <Spinner /> : <SparklesIcon className="w-6 h-6" />}
                    <span>Gerar Análise de Acasalamento</span>
                </button>
            </div>

            {error && (
                <div className="mt-4 p-4 bg-red-900/30 border border-red-800 rounded-lg text-red-200 text-center">
                    {error}
                </div>
            )}

            {analysisResult && (
                <div className="mt-8 bg-base-800 p-6 rounded-lg shadow-xl border border-base-700 animate-fade-in">
                    <div className="flex items-center gap-3 mb-6 border-b border-base-700 pb-4">
                        <SparklesIcon className="w-6 h-6 text-brand-primary" />
                        <h2 className="text-2xl font-bold text-white">Resultado da Análise</h2>
                    </div>
                    <div className="prose prose-invert max-w-none">
                        <div dangerouslySetInnerHTML={{ __html: analysisResult.replace(/\n/g, '<br/>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                    </div>
                    <div className="mt-6 pt-4 border-t border-base-700 text-center text-sm text-gray-500">
                        * Esta é uma análise gerada por inteligência artificial baseada nas informações fornecidas. Consulte sempre um técnico responsável.
                    </div>
                </div>
            )}
        </div>
    );
};

export default PhenotypicAnalysisView;
