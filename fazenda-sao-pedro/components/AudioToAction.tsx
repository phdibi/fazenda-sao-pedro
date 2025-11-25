import React, { useState, useEffect, useRef } from 'react';
import { structureMedicalDataFromText } from '../services/geminiService';
import Spinner from './common/Spinner';
import { MicrophoneIcon, SparklesIcon, StopIcon } from './common/Icons';
import { MedicationAdministration } from '../types';
import useSpeechRecognition from '../hooks/useSpeechRecognition';

interface AudioToActionProps {
  onDataExtracted: (data: Partial<MedicationAdministration>) => void;
}

const AudioToAction = ({ onDataExtracted }: AudioToActionProps) => {
  const { isListening, transcript, startListening, stopListening, error: speechError } = useSpeechRecognition();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const processedTranscriptRef = useRef('');

  useEffect(() => {
    // Process the transcript only when listening has stopped and there's a new transcript
    if (!isListening && transcript && transcript !== processedTranscriptRef.current) {
      processedTranscriptRef.current = transcript;
      processTranscription(transcript);
    }
  }, [isListening, transcript]);

  const processTranscription = async (text: string) => {
    setIsProcessing(true);
    setError('');
    try {
      const structuredData = await structureMedicalDataFromText(text);
      onDataExtracted(structuredData);
    } catch (err) {
      console.error("Error processing audio:", err);
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
    <div className="mt-6 p-4 bg-base-900 rounded-lg">
      <h3 className="text-lg font-semibold text-white mb-4">Registro Rápido por Voz</h3>
      <div className="flex items-center gap-4">
        <button
          onClick={handleRecordToggle}
          disabled={isProcessing}
          className={`flex items-center justify-center w-16 h-16 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-base-900 ${
            isListening ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' : 'bg-brand-primary hover:bg-brand-primary-light focus:ring-brand-primary'
          } ${isProcessing ? 'bg-base-700 cursor-not-allowed' : ''}`}
        >
          {isProcessing ? <Spinner /> : isListening ? <StopIcon className="w-8 h-8 text-white" /> : <MicrophoneIcon className="w-8 h-8 text-white" />}
        </button>
        <div className="flex-1">
          <p className="text-gray-300">
            {isProcessing
              ? 'Processando com Gemini...'
              : isListening
              ? 'Gravando... Fale o comando. Ex: "Aplicar Ivermectina 10ml..."'
              : 'Pressione para iniciar a gravação do comando.'}
          </p>
          {transcript && <p className="text-sm text-brand-primary-light mt-1 italic">"{transcript}"</p>}
          {currentError && <p className="text-red-400 text-sm mt-1">{currentError}</p>}
        </div>
      </div>
      <p className="text-xs text-gray-500 mt-3">Os campos do formulário abaixo serão preenchidos automaticamente após o processamento.</p>
    </div>
  );
};

export default AudioToAction;
