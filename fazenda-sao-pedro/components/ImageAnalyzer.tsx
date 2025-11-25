import React, { useState, useEffect, useRef } from 'react';
import Spinner from './common/Spinner';
import { PhotoIcon, CheckIcon } from './common/Icons';
import { storage } from '../services/firebase';

interface ImageAnalyzerProps {
  imageUrl: string;
  onUploadComplete: (newPhotoUrl: string) => void;
  animalId: string;
  userId: string;
}

// Structured error type for more detailed feedback
type UploadError = {
  message: string;
  isConfigError?: boolean;
};

// The 'saving' state is removed; this component is only responsible for the UPLOAD.
type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';


const ImageAnalyzer = ({ imageUrl, onUploadComplete, animalId, userId }: ImageAnalyzerProps) => {
  const [previewUrl, setPreviewUrl] = useState<string>(imageUrl);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<UploadError | null>(null);

  const uploadTaskRef = useRef<any | null>(null);
  const timeoutTriggeredRef = useRef(false); // Ref to track if our timeout caused the cancellation.

  useEffect(() => {
    setPreviewUrl(imageUrl);
    // Reset state when the component receives a new animal/image
    if (uploadStatus !== 'idle') {
        setUploadStatus('idle');
        setUploadProgress(0);
        setError(null);
    }
    if (uploadTaskRef.current) {
        uploadTaskRef.current.cancel();
        uploadTaskRef.current = null;
    }
  }, [imageUrl, animalId]);
  
  // Cleanup effect to cancel upload on component unmount
  useEffect(() => {
    return () => {
        if (uploadTaskRef.current) {
            uploadTaskRef.current.cancel();
        }
    }
  }, []);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // --- SAFETY CHECK ---
    // If the storage service isn't available due to a config error, stop immediately.
    if (!storage) {
        setError({
            message: "O serviço de armazenamento (Firebase Storage) não está disponível. Verifique a configuração do Firebase em index.html.",
            isConfigError: true
        });
        setUploadStatus('error');
        return;
    }

    setError(null);
    setUploadProgress(0);
    setUploadStatus('uploading');
    timeoutTriggeredRef.current = false; // Reset flag for new upload

    if (uploadTaskRef.current) {
        uploadTaskRef.current.cancel();
    }
    
    const localPreviewUrl = URL.createObjectURL(file);
    setPreviewUrl(localPreviewUrl);

    try {
      const timestamp = new Date().getTime();
      const fileExtension = file.name.split('.').pop() || 'jpg';
      const storagePath = `animal_photos/${userId}/${animalId}/${timestamp}.${fileExtension}`;
      const storageRef = storage.ref(storagePath);
      
      const uploadTask = storageRef.put(file);
      uploadTaskRef.current = uploadTask;

      // --- TIMEOUT MECHANISM ---
      const timeoutId = setTimeout(() => {
        // Check if upload is still at 0% after 15 seconds
        if (uploadTask.snapshot.bytesTransferred === 0) {
            timeoutTriggeredRef.current = true; // Set flag to indicate this was a timeout cancellation
            uploadTask.cancel();
        }
      }, 15000); // 15-second timeout

      uploadTask.on(
        'state_changed',
        (snapshot: any) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
          // If we get any progress, the connection is working, so clear the timeout.
          if (snapshot.bytesTransferred > 0) {
            clearTimeout(timeoutId);
          }
        },
        (uploadError: any) => { // Error listener
          clearTimeout(timeoutId); // Always clear timeout on error
          uploadTaskRef.current = null;
          console.error('[Upload] Upload failed during state change:', uploadError);
          
          // --- INTELLIGENT CANCELLATION HANDLING ---
          if (uploadError.code === 'storage/canceled') {
              if (timeoutTriggeredRef.current) {
                  // This was a timeout! It's a real, user-facing error.
                  setError({
                      message: "O upload travou em 0%. Isso geralmente indica um erro de configuração do 'storageBucket' em index.html ou um problema de CORS no seu projeto Google Cloud.",
                      isConfigError: true
                  });
                  setUploadStatus('error');
              } else {
                  // This was a different cancellation (e.g., user closed modal). 
                  // It's not an error. Just reset the UI silently.
                  console.log("Upload cancelado (não por timeout). Resetando UI.");
                  setUploadStatus('idle');
                  setError(null);
              }
              URL.revokeObjectURL(localPreviewUrl);
              return; // Stop further processing for cancellations
          }

          // --- Standard Error Handling for other errors ---
          let detailedMessage: string;
          let isConfigError = true;

          switch (uploadError.code) {
              case 'storage/unauthorized':
                  detailedMessage = "Permissão Negada. Verifique suas Regras de Segurança do Firebase Storage.";
                  break;
              case 'storage/object-not-found':
              case 'storage/bucket-not-found':
                  detailedMessage = "Configuração do 'storageBucket' parece estar incorreta. O bucket não foi encontrado.";
                  break;
              case 'storage/project-not-found':
                  detailedMessage = "O projeto Firebase não foi encontrado. Verifique seu `projectId` em index.html.";
                  break;
             case 'storage/unknown':
                if (!navigator.onLine) {
                     detailedMessage = "Falha de conexão. Verifique sua internet.";
                     isConfigError = false;
                } else if (uploadError.message?.includes('CORS')) {
                    detailedMessage = "Erro de CORS. Verifique as configurações do bucket no Google Cloud Console.";
                } else {
                     detailedMessage = "Ocorreu um erro desconhecido. Verifique o console do navegador para detalhes.";
                }
                break;
              default:
                  detailedMessage = `O upload falhou devido a um problema de configuração ou permissão. Código: ${uploadError.code || 'desconhecido'}.`;
                  break;
          }
          
          setError({ message: detailedMessage, isConfigError });
          setUploadStatus('error');
          URL.revokeObjectURL(localPreviewUrl);
        },
        async () => { // Success listener
          clearTimeout(timeoutId);
          const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
          
          // The parent is now responsible for handling the save logic.
          // This component's job is just to upload the file and report success.
          onUploadComplete(downloadURL);
          setUploadStatus('success');
          
          uploadTaskRef.current = null;
          URL.revokeObjectURL(localPreviewUrl);
        }
      );

} catch (uploadError: any) {
  console.error('❌ Erro no upload:', uploadError);

  // Cancela o timeout se ele ainda estiver ativo
  if (uploadTimeoutRef.current) {
    clearTimeout(uploadTimeoutRef.current);
    uploadTimeoutRef.current = null;
  }

  // --- TRATAMENTO INTELIGENTE DE CANCELAMENTO ---
  if (uploadError.code === 'storage/canceled') {
    if (timeoutTriggeredRef.current) {
      // Timeout foi atingido = erro real de configuração
      setError({
        message: "⏱️ O upload travou em 0%. Isso geralmente indica um erro de configuração do 'storageBucket' no index.html ou problema de CORS.",
        isConfigError: true
      });
      setUploadStatus('error');
    } else {
      // Cancelamento normal (usuário fechou modal)
      console.log("Upload cancelado pelo usuário. Resetando UI.");
      setUploadStatus('idle');
      setError(null);
    }
    URL.revokeObjectURL(localPreviewUrl);
    return;
  }

  // --- TRATAMENTO DE ERROS ESPECÍFICOS ---
  let detailedMessage: string;
  let isConfigError = true;

  switch (uploadError.code) {
    case 'storage/unauthorized':
      detailedMessage = "🔒 Permissão Negada. Verifique as Regras de Segurança do Firebase Storage (devem permitir write para usuários autenticados).";
      break;

    case 'storage/object-not-found':
    case 'storage/bucket-not-found':
      detailedMessage = "📦 O bucket de armazenamento não foi encontrado. Verifique se o 'storageBucket' no index.html está correto (deve terminar com .appspot.com).";
      break;

    case 'storage/project-not-found':
      detailedMessage = "🔍 Projeto Firebase não encontrado. Verifique o 'projectId' no index.html.";
      break;

    case 'storage/unknown':
      if (!navigator.onLine) {
        detailedMessage = "📡 Sem conexão com a internet. Verifique sua rede e tente novamente.";
        isConfigError = false;
      } else if (uploadError.message?.toLowerCase().includes('cors')) {
        detailedMessage = "🌐 Erro de CORS detectado. O bucket precisa permitir requisições da sua origem.";
      } else {
        detailedMessage = `❓ Erro desconhecido: ${uploadError.message || 'Verifique o console do navegador (F12) para mais detalhes.'}`;
      }
      break;

    default:
      detailedMessage = `⚠️ Falha no upload (código: ${uploadError.code || 'desconhecido'}). Verifique as configurações do Firebase.`;
      break;
  }

  setError({
    message: detailedMessage,
    isConfigError
  });
  setUploadStatus('error');
  URL.revokeObjectURL(localPreviewUrl);
}



  return (
    <div className="relative aspect-square bg-base-900 rounded-lg overflow-hidden flex items-center justify-center w-full max-w-sm mx-auto">
        <img src={previewUrl} alt="Pré-visualização do animal" className="w-full h-full object-cover" />

        {/* Upload Overlay */}
        {uploadStatus === 'uploading' && (
            <div className="absolute inset-0 bg-base-900 bg-opacity-70 flex flex-col items-center justify-center text-white p-4">
                <div className="w-3/4 bg-gray-600 rounded-full h-2.5">
                    <div className="bg-brand-primary h-2.5 rounded-full" style={{ width: `${uploadProgress}%` }}></div>
                </div>
                <p className="mt-2 text-sm">{Math.round(uploadProgress)}%</p>
            </div>
        )}
        
        {uploadStatus === 'success' && (
             <div className="absolute inset-0 bg-green-900/80 flex flex-col items-center justify-center text-white">
                <CheckIcon className="w-12 h-12" />
                <p className="mt-2 font-bold">Upload Concluído!</p>
            </div>
        )}
        
        {error && (
  <div className="text-center p-4">
    <div className="text-red-400 font-semibold mb-2">
      {error.message}
    </div>

    {error.isConfigError && (
      <div className="mt-4 bg-base-900/50 p-4 rounded-lg text-xs text-left max-w-lg mx-auto">
        <p className="font-bold text-white mb-3 text-sm">
          📋 Checklist de Configuração:
        </p>

        <div className="space-y-4">
          {/* 1. Storage Bucket */}
          <div className="border-l-2 border-brand-primary pl-3">
            <p className="font-semibold text-white mb-1">
              1. Verifique o storageBucket (causa mais comum)
            </p>
            <ul className="list-disc list-inside ml-2 space-y-1 text-base-300">
              <li>Abra <code className="bg-base-800 px-1 rounded text-white">index.html</code></li>
              <li>Procure por <code className="bg-base-800 px-1 rounded text-white">storageBucket</code> (linha ~49)</li>
              <li>Deve ser: <code className="bg-base-800 px-1 rounded text-accent-green">seu-projeto.appspot.com</code></li>
              <li className="text-red-400">❌ NÃO use: <code className="bg-base-800 px-1 rounded line-through">.firebasestorage.app</code></li>
            </ul>
          </div>

          {/* 2. Console do navegador */}
          <div className="border-l-2 border-accent-yellow pl-3">
            <p className="font-semibold text-white mb-1">
              2. Verifique erros de CORS no Console
            </p>
            <ul className="list-disc list-inside ml-2 space-y-1 text-base-300">
              <li>Aperte <kbd className="bg-base-800 px-2 py-0.5 rounded text-white font-mono">F12</kbd></li>
              <li>Vá na aba "Console"</li>
              <li>Procure erros em vermelho mencionando "CORS"</li>
              <li>
                Se encontrar: <a 
                  href="https://firebase.google.com/docs/storage/web/cors" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-brand-primary-light underline hover:text-brand-primary"
                >
                  Configure CORS no bucket
                </a>
              </li>
            </ul>
          </div>

          {/* 3. Regras de segurança */}
          <div className="border-l-2 border-accent-blue pl-3">
            <p className="font-semibold text-white mb-1">
              3. Regras de Segurança do Storage
            </p>
            <ul className="list-disc list-inside ml-2 space-y-1 text-base-300">
              <li>No Firebase Console: <strong className="text-white">Storage → Rules</strong></li>
              <li>Deve permitir write para autenticados:</li>
            </ul>
            <pre className="mt-2 p-2 bg-base-800 rounded text-[10px] font-mono text-accent-green overflow-x-auto">
{`service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow write: if request.auth != null;
    }
  }
}`}
            </pre>
          </div>

          {/* 4. API ativada */}
          <div className="border-l-2 border-accent-red pl-3">
            <p className="font-semibold text-white mb-1">
              4. API do Storage ativada
            </p>
            <ul className="list-disc list-inside ml-2 space-y-1 text-base-300">
              <li>
                Acesse o <a 
                  href="https://console.cloud.google.com/apis/library/firebasestorage.googleapis.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-brand-primary-light underline hover:text-brand-primary"
                >
                  Google Cloud Console
                </a>
              </li>
              <li>Verifique se "Cloud Storage for Firebase" está ativada</li>
            </ul>
          </div>
        </div>

        <button
          onClick={() => setError(null)}
          className="mt-4 w-full bg-base-800 hover:bg-base-700 
                     text-white py-2 rounded transition-colors text-sm"
        >
          Fechar checklist
        </button>
      </div>
    )}
  </div>
)}



        {/* File Input - always available unless an error occurred */}
        {uploadStatus !== 'error' && (
            <label htmlFor="photo-upload" className="absolute bottom-4 right-4 bg-brand-primary hover:bg-brand-primary-light text-white p-3 rounded-full cursor-pointer shadow-lg transition-transform hover:scale-110">
                <PhotoIcon className="w-6 h-6" />
                <input id="photo-upload" type="file" accept="image/*" onChange={handleFileChange} className="sr-only" disabled={uploadStatus === 'uploading'}/>
            </label>
        )}
    </div>
  );
};

export default ImageAnalyzer;
