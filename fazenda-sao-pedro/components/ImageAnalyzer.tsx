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

    } catch (err) {
        // This catch block is a fallback, but the error listener above is more specific.
        console.error('[Upload] General catch block error:', err);
        setError({ message: 'Um erro inesperado ocorreu ao iniciar o upload.' });
        setUploadStatus('error');
        URL.revokeObjectURL(localPreviewUrl);
    }
  };


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
            <div className="absolute inset-0 bg-red-900/80 flex flex-col items-center justify-center text-white p-4 text-center">
                <p className="font-bold text-lg mb-2">🛑 Erro no Upload</p>
                <p className="text-sm">{error.message}</p>
                {error.isConfigError && (
                    <div className="mt-4 bg-base-900/50 p-3 rounded-lg text-xs text-left max-w-xs w-full">
                        <p className="font-bold mb-1">Checklist de Configuração:</p>
                        <ol className="list-decimal list-inside space-y-2">
                            <li>
                                <strong>`storageBucket` correto (causa comum):</strong>
                                <ul className="list-disc list-inside ml-4 mt-1 text-xs">
                                    <li>Abra <code className="bg-base-700 px-1 rounded">index.html</code>.</li>
                                    <li>Confirme que o valor é <strong className="text-white">exatamente</strong> igual ao do seu console Firebase (ex: `seu-projeto.appspot.com`).</li>
                                    <li><strong className="text-red-400">NÃO</strong> inclua `gs://`.</li>
                                </ul>
                            </li>
                            <li>
                                <strong>Verifique o Console do Navegador (CORS):</strong>
                                 <ul className="list-disc list-inside ml-4 mt-1 text-xs">
                                    <li>Aperte <strong className="text-white">F12</strong> para abrir as ferramentas de desenvolvedor.</li>
                                    <li>Vá para a aba <strong className="text-white">"Console"</strong>.</li>
                                    <li>Procure por erros em <strong className="text-red-400">vermelho</strong> mencionando `CORS`. Se encontrar, você precisa <a href="https://firebase.google.com/docs/storage/web/cors" target="_blank" rel="noopener noreferrer" className="underline hover:text-brand-primary-light">configurar o CORS</a> no seu bucket.</li>
                                </ul>
                            </li>
                            <li>
                                <strong>Regras do Storage/Firestore:</strong>
                                <ul className="list-disc list-inside ml-4 mt-1 text-xs">
                                    <li>No Firebase, vá para <strong className="text-white">Storage &gt; Regras</strong> e <strong className="text-white">Firestore &gt; Regras</strong>.</li>
                                    <li>Ambas devem permitir escrita para usuários autenticados, como:
                                        <code className="block mt-1 p-1.5 bg-base-700 rounded text-[10px] whitespace-pre-wrap">
                                            allow write: if request.auth != null;
                                        </code>
                                    </li>
                                </ul>
                            </li>
                            <li>
                                <strong>API do Storage ativada:</strong>
                                <ul className="list-disc list-inside ml-4 mt-1 text-xs">
                                    <li>Verifique no <a href="https://console.cloud.google.com/apis/library/firebasestorage.googleapis.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-brand-primary-light">Google Cloud Console</a> se a API "Cloud Storage for Firebase" está ativa para o seu projeto.</li>
                                </ul>
                            </li>
                        </ol>
                    </div>
                )}
                <label htmlFor="photo-upload-retry" className="mt-4 bg-base-100 text-base-900 text-sm font-bold py-2 px-4 rounded cursor-pointer">
                    Tentar Novamente
                    <input id="photo-upload-retry" type="file" accept="image/*" onChange={handleFileChange} className="sr-only" />
                </label>
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
