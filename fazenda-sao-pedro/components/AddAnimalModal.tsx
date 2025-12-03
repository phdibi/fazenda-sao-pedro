import React, { useState, useEffect, useRef } from 'react';
import { Animal, Raca, Sexo, AnimalStatus } from '../types';
import Modal from './common/Modal';
import { PlusIcon, MicrophoneIcon, StopIcon } from './common/Icons';
import { structureAnimalDataFromText } from '../services/geminiServiceOptimized';
import Spinner from './common/Spinner';
import useSpeechRecognition from '../hooks/useSpeechRecognition';

// --- Voice Registration Component ---
interface AudioForAnimalAddProps {
  onDataExtracted: (data: Partial<Omit<Animal, 'id' | 'fotos' | 'historicoSanitario' | 'historicoPesagens'>>) => void;
}

const AudioForAnimalAdd = ({ onDataExtracted }: AudioForAnimalAddProps) => {
  const { isListening, transcript, startListening, stopListening, error: speechError } = useSpeechRecognition();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const processedTranscriptRef = useRef('');

  useEffect(() => {
    if (!isListening && transcript && transcript !== processedTranscriptRef.current) {
        processedTranscriptRef.current = transcript;
        processTranscription(transcript);
    }
  }, [isListening, transcript]);

  const processTranscription = async (text: string) => {
    setIsProcessing(true);
    setError('');
    try {
        const structuredData = await structureAnimalDataFromText(text);
        onDataExtracted(structuredData);
    } catch (err) {
        console.error("Error processing audio for animal registration:", err);
        setError('Falha ao processar o áudio com a IA. Tente novamente.');
    } finally {
        setIsProcessing(false);
    }
  };

  const handleRecordToggle = () => {
    if (isListening) {
      stopListening();
    } else {
      processedTranscriptRef.current = '';
      startListening();
    }
  };
  
  const currentError = error || speechError;

  return (
    <div className="p-4 bg-base-800 rounded-lg mb-6">
      <h3 className="text-lg font-semibold text-white mb-4">Cadastro Rápido por Voz</h3>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={handleRecordToggle}
          disabled={isProcessing}
          className={`flex items-center justify-center w-16 h-16 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-base-900 ${
            isListening ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' : 'bg-brand-primary hover:bg-brand-primary-light focus:ring-brand-primary'
          } ${isProcessing ? 'bg-base-700 cursor-not-allowed' : ''}`}
          aria-label={isListening ? 'Parar gravação' : 'Iniciar gravação'}
        >
          {isProcessing ? <Spinner /> : isListening ? <StopIcon className="w-8 h-8 text-white" /> : <MicrophoneIcon className="w-8 h-8 text-white" />}
        </button>
        <div className="flex-1">
          <p className="text-gray-300">
            {isProcessing
              ? 'Processando com Gemini...'
              : isListening
              ? 'Gravando... Fale os dados do animal.'
              : 'Pressione para iniciar a gravação dos dados.'}
          </p>
          {transcript && <p className="text-sm text-brand-primary-light mt-1 italic">"{transcript}"</p>}
          {currentError && <p className="text-red-400 text-sm mt-1">{currentError}</p>}
        </div>
      </div>
      <p className="text-xs text-gray-500 mt-3">Ex: "Cadastrar brinco 2030, nome Fagulha, raça Braford, macho..." Os campos serão preenchidos automaticamente.</p>
    </div>
  );
};


// --- Add Animal Modal ---
interface AddAnimalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddAnimal: (animal: Omit<Animal, 'id' | 'fotos' | 'historicoSanitario' | 'historicoPesagens'>) => void;
  animals: Animal[];
}

type AnimalFormData = Omit<Animal, 'id' | 'fotos' | 'historicoSanitario' | 'historicoPesagens' | 'pesoKg' | 'dataNascimento'> & {
  pesoKg: string;
  dataNascimento: string; // String vazia ou data no formato YYYY-MM-DD
};

const initialFormData: AnimalFormData = {
    brinco: '',
    nome: '',
    raca: Raca.Braford,
    sexo: Sexo.Femea,
    pesoKg: '',
    dataNascimento: '',
    status: AnimalStatus.Ativo,
    paiNome: '',
    maeNome: '',
    maeRaca: Raca.Braford
};

const AddAnimalModal = ({ isOpen, onClose, onAddAnimal, animals }: AddAnimalModalProps) => {
    const [formData, setFormData] = useState<AnimalFormData>(initialFormData);
    const [errors, setErrors] = useState<{ brinco?: string; pesoKg?: string }>({});
    
    useEffect(() => {
        if (!isOpen) {
            setFormData(initialFormData);
            setErrors({});
        }
    }, [isOpen]);

    const validateBrinco = (brincoValue: string) => {
        const trimmedBrinco = brincoValue.trim();
        if (!trimmedBrinco) {
            setErrors(prev => ({ ...prev, brinco: 'O brinco é obrigatório.' }));
            return false;
        }
        if (animals.some(animal => animal.brinco.toLowerCase() === trimmedBrinco.toLowerCase())) {
            setErrors(prev => ({ ...prev, brinco: 'Este brinco já está cadastrado.' }));
            return false;
        }
        setErrors(prev => ({ ...prev, brinco: undefined }));
        return true;
    };
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;

        if (name === 'brinco') {
            validateBrinco(value);
        }

        setFormData(prev => {
            const updatedData = {
                ...prev,
                [name]: value,
            };

            if (name === 'maeNome') {
                const mother = animals.find(a => a.brinco.toLowerCase() === value.trim().toLowerCase());
                if (mother) {
                    updatedData.maeRaca = mother.raca;
                }
            }

            return updatedData;
        });
    };
    
    const handleDataExtracted = (data: Partial<Omit<Animal, 'id' | 'fotos' | 'historicoSanitario' | 'historicoPesagens'>>) => {
        setFormData(prev => ({
            ...prev,
            ...data,
            pesoKg: data.pesoKg ? String(data.pesoKg) : '',
            dataNascimento: data.dataNascimento 
                ? new Date(data.dataNascimento).toISOString().split('T')[0] 
                : prev.dataNascimento,
        }));
        if (data.brinco) {
            validateBrinco(data.brinco);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const isBrincoValid = validateBrinco(formData.brinco);

        if (!isBrincoValid) {
            return;
        }
        
        const pesoKgValue = parseFloat(formData.pesoKg);
        const finalPeso = !isNaN(pesoKgValue) && pesoKgValue > 0 ? pesoKgValue : 0;
        
        // Data de nascimento: undefined se vazio, Date se preenchido
        let finalDataNascimento: Date | undefined = undefined;
        if (formData.dataNascimento) {
            const parsedDate = new Date(formData.dataNascimento + 'T00:00:00');
            if (!isNaN(parsedDate.getTime())) {
                finalDataNascimento = parsedDate;
            }
        }
        
        setErrors({});
        
        const finalData = {
            brinco: formData.brinco,
            nome: formData.nome,
            raca: formData.raca,
            sexo: formData.sexo,
            status: formData.status,
            paiNome: formData.paiNome,
            maeNome: formData.maeNome,
            maeRaca: formData.maeRaca,
            pesoKg: finalPeso,
            dataNascimento: finalDataNascimento,
        };
        
        onAddAnimal(finalData);
    };

    const isFormInvalid = !formData.brinco || !!errors.brinco;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Cadastrar Novo Animal">
            <AudioForAnimalAdd onDataExtracted={handleDataExtracted} />
            
            <form onSubmit={handleSubmit} className="space-y-6 pb-48 md:pb-4">
                 <div className="relative border border-base-700 p-4 rounded-lg">
                    <h3 className="absolute -top-3 left-4 bg-base-800 px-2 text-md font-semibold text-brand-primary-light">Identificação do Animal</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                        <div>
                            <label htmlFor="brinco" className="block text-sm font-medium text-gray-300">Brinco</label>
                            <input type="text" name="brinco" id="brinco" value={formData.brinco} onChange={handleChange} className={`mt-1 block w-full bg-base-700 border rounded-md shadow-sm focus:ring-brand-primary focus:border-brand-primary sm:text-sm p-2 ${errors.brinco ? 'border-red-500' : 'border-base-600'}`} required />
                            {errors.brinco && <p className="text-red-400 text-xs mt-1">{errors.brinco}</p>}
                        </div>
                        <div>
                            <label htmlFor="nome" className="block text-sm font-medium text-gray-300">Nome</label>
                            <input type="text" name="nome" id="nome" value={formData.nome} onChange={handleChange} className="mt-1 block w-full bg-base-700 border-base-600 rounded-md shadow-sm focus:ring-brand-primary focus:border-brand-primary sm:text-sm p-2" />
                        </div>
                        <div>
                            <label htmlFor="raca" className="block text-sm font-medium text-gray-300">Raça</label>
                            <select name="raca" id="raca" value={formData.raca} onChange={handleChange} className="mt-1 block w-full bg-base-700 border-base-600 rounded-md shadow-sm focus:ring-brand-primary focus:border-brand-primary sm:text-sm p-2">
                                {Object.values(Raca).map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>
                         <div>
                            <label htmlFor="sexo" className="block text-sm font-medium text-gray-300">Sexo</label>
                            <select name="sexo" id="sexo" value={formData.sexo} onChange={handleChange} className="mt-1 block w-full bg-base-700 border-base-600 rounded-md shadow-sm focus:ring-brand-primary focus:border-brand-primary sm:text-sm p-2">
                                 {Object.values(Sexo).map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="relative border border-base-700 p-4 rounded-lg">
                    <h3 className="absolute -top-3 left-4 bg-base-800 px-2 text-md font-semibold text-brand-primary-light">Dados de Nascimento</h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                         <div>
                            <label htmlFor="dataNascimento" className="block text-sm font-medium text-gray-300">
                                Data de Nascimento <span className="text-gray-500 text-xs">(opcional)</span>
                            </label>
                            <input 
                                type="date" 
                                name="dataNascimento" 
                                id="dataNascimento" 
                                value={formData.dataNascimento} 
                                onChange={handleChange} 
                                className="mt-1 block w-full bg-base-700 border border-base-600 rounded-md shadow-sm focus:ring-brand-primary focus:border-brand-primary sm:text-sm p-2" 
                            />
                        </div>
                        <div>
                            <label htmlFor="pesoKg" className="block text-sm font-medium text-gray-300">
                                Peso ao Nascer (kg) <span className="text-gray-500 text-xs">(opcional)</span>
                            </label>
                            <input type="number" step="0.1" name="pesoKg" id="pesoKg" value={formData.pesoKg} onChange={handleChange} className={`mt-1 block w-full bg-base-700 border rounded-md shadow-sm focus:ring-brand-primary focus:border-brand-primary sm:text-sm p-2 ${errors.pesoKg ? 'border-red-500' : 'border-base-600'}`} />
                            {errors.pesoKg && <p className="text-red-400 text-xs mt-1">{errors.pesoKg}</p>}
                        </div>
                    </div>
                </div>
                
                <div className="relative border border-base-700 p-4 rounded-lg">
                    <h3 className="absolute -top-3 left-4 bg-base-800 px-2 text-md font-semibold text-brand-primary-light">Filiação</h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                        <div>
                            <label htmlFor="maeNome" className="block text-sm font-medium text-gray-300">Brinco da Mãe</label>
                            <input 
                                type="text" 
                                name="maeNome" 
                                id="maeNome" 
                                value={formData.maeNome} 
                                onChange={handleChange} 
                                className="mt-1 block w-full bg-base-700 border-base-600 rounded-md shadow-sm focus:ring-brand-primary focus:border-brand-primary sm:text-sm p-2" 
                                placeholder="Ex: 2024"
                            />
                            <p className="text-xs text-gray-500 mt-1">A raça será puxada automaticamente</p>
                        </div>
                        <div className="md:col-span-2">
                            <label htmlFor="paiNome" className="block text-sm font-medium text-gray-300">Pai (Brinco ou Nome)</label>
                            <input 
                                type="text" 
                                name="paiNome" 
                                id="paiNome" 
                                value={formData.paiNome} 
                                onChange={handleChange} 
                                className="mt-1 block w-full bg-base-700 border-base-600 rounded-md shadow-sm focus:ring-brand-primary focus:border-brand-primary sm:text-sm p-2" 
                                placeholder="Ex: Touro 001"
                            />
                        </div>
                    </div>
                </div>

                <div className="relative border border-base-700 p-4 rounded-lg">
                    <h3 className="absolute -top-3 left-4 bg-base-800 px-2 text-md font-semibold text-brand-primary-light">Status Inicial</h3>
                     <div className="pt-2">
                        <label htmlFor="status" className="block text-sm font-medium text-gray-300">Status</label>
                        <select name="status" id="status" value={formData.status} onChange={handleChange} className="mt-1 block w-full bg-base-700 border-base-600 rounded-md shadow-sm focus:ring-brand-primary focus:border-brand-primary sm:text-sm p-2">
                             {Object.values(AnimalStatus).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                </div>
                
                <div className="pt-4 flex justify-end mb-24">
                    <button type="button" onClick={onClose} className="bg-base-700 text-gray-300 hover:bg-base-600 font-bold py-2 px-4 rounded transition-colors mr-2">
                        Cancelar
                    </button>
                    <button 
                        type="submit" 
                        disabled={isFormInvalid}
                        className="bg-brand-primary hover:bg-brand-primary-light text-white font-bold py-2 px-4 rounded transition-colors flex items-center gap-2 disabled:bg-base-700 disabled:cursor-not-allowed"
                    >
                        <PlusIcon className="w-5 h-5" />
                        Salvar Animal
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default AddAnimalModal;