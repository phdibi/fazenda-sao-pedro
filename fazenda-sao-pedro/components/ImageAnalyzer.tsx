import React, { useState, useEffect, useRef } from 'react';
import Spinner from './common/Spinner';
import { PhotoIcon, CheckIcon } from './common/Icons';
import { firebaseServices } from '../services/firebase';
import { prepareImageForUpload, getOptimalFormat } from '../utils/imageOptimization';

interface ImageAnalyzerProps {
  imageUrl: string;
  onUploadComplete: (newPhotoUrl: string, thumbnailUrl?: string) => void;
  animalId: string;
  userId: string;
}

// Structured error type for more detailed feedback
type UploadError = {
  message: string;
  isConfigError?: boolean;
};

type UploadStatus = 'idle' | 'compressing' | 'uploading' | 'success' | 'error';

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
const QUEUE_MESSAGE =
  '⏳ Já existe um upload em andamento. Aguarde a conclusão ou cancele antes de enviar outro arquivo.';

const ImageAnalyzer = ({ imageUrl, onUploadComplete, animalId, userId }: ImageAnalyzerProps) => {
  const [previewUrl, setPreviewUrl] = useState<string>(imageUrl);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [compressionSavings, setCompressionSavings] = useState<string>('');
  const [error, setError] = useState<UploadError | null>(null);

  const uploadTaskRef = useRef<any | null>(null);
  const uploadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutTriggeredRef = useRef(false);

  useEffect(() => {
    setPreviewUrl(imageUrl);
    if (uploadStatus !== 'idle') {
      setUploadStatus('idle');
      setUploadProgress(0);
      setError(null);
      setCompressionSavings('');
    }
    if (uploadTaskRef.current) {
      uploadTaskRef.current.cancel();
      uploadTaskRef.current = null;
    }
  }, [imageUrl, animalId]);

  useEffect(() => {
    return () => {
      if (uploadTaskRef.current) {
        uploadTaskRef.current.cancel();
      }
      if (uploadTimeoutRef.current) {
        clearTimeout(uploadTimeoutRef.current);
      }
    };
  }, []);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (uploadTaskRef.current && uploadStatus === 'uploading') {
      setError({ message: QUEUE_MESSAGE });
      return;
    }

    const storage = firebaseServices.storage;
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
    setCompressionSavings('');
    timeoutTriggeredRef.current = false;

    // Preview local imediato
    const localPreviewUrl = URL.createObjectURL(file);
    setPreviewUrl(localPreviewUrl);

    // ============================================
    // 🔧 OTIMIZAÇÃO: SEMPRE COMPRIMIR + THUMBNAIL
    // ============================================
    setUploadStatus('compressing');

    let fileToUpload: Blob;
    let thumbnailToUpload: Blob;
    let fileName: string;
    let thumbnailFileName: string;

    try {
      // Prepara imagem comprimida + thumbnail
      const prepared = await prepareImageForUpload(file);
      fileToUpload = prepared.compressed;
      thumbnailToUpload = prepared.thumbnail;
      setCompressionSavings(prepared.savings);

      // Define extensão baseada no formato
      const extension = getOptimalFormat() === 'image/webp' ? 'webp' : 'jpg';
      const timestamp = Date.now();
      fileName = `${timestamp}.${extension}`;
      thumbnailFileName = `${timestamp}_thumb.${extension}`;

      // Verifica se ainda está muito grande após compressão
      if (fileToUpload.size > MAX_FILE_SIZE_BYTES) {
        setError({
          message: `A imagem está muito grande mesmo após compressão (${(fileToUpload.size / (1024 * 1024)).toFixed(2)}MB). Use uma imagem menor.`,
          isConfigError: false
        });
        setUploadStatus('error');
        URL.revokeObjectURL(localPreviewUrl);
        return;
      }

    } catch (compressionError: any) {
      console.warn('Falha na compressão, usando original:', compressionError);
      fileToUpload = file;
      thumbnailToUpload = file;
      const ext = file.name.split('.').pop() || 'jpg';
      const timestamp = Date.now();
      fileName = `${timestamp}.${ext}`;
      thumbnailFileName = `${timestamp}_thumb.${ext}`;
    }

    // ============================================
    // UPLOAD (imagem principal + thumbnail)
    // ============================================
    setUploadStatus('uploading');

    try {
      const storagePath = `animal_photos/${userId}/${animalId}/${fileName}`;
      const thumbnailPath = `animal_photos/${userId}/${animalId}/${thumbnailFileName}`;
      const storageRef = storage.ref(storagePath);
      const thumbnailRef = storage.ref(thumbnailPath);

      const uploadTask = storageRef.put(fileToUpload);
      uploadTaskRef.current = uploadTask;

      // Timeout mechanism
      uploadTimeoutRef.current = setTimeout(() => {
        if (uploadTask.snapshot.bytesTransferred === 0) {
          timeoutTriggeredRef.current = true;
          uploadTask.cancel();
        }
      }, 15000);

      uploadTask.on(
        'state_changed',
        (snapshot: any) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
          if (snapshot.bytesTransferred > 0 && uploadTimeoutRef.current) {
            clearTimeout(uploadTimeoutRef.current);
            uploadTimeoutRef.current = null;
          }
        },
        (uploadError: any) => {
          if (uploadTimeoutRef.current) {
            clearTimeout(uploadTimeoutRef.current);
            uploadTimeoutRef.current = null;
          }
          uploadTaskRef.current = null;
          console.error('[Upload] Upload failed during state change:', uploadError);

          if (uploadError.code === 'storage/canceled') {
            if (timeoutTriggeredRef.current) {
              setError({
                message: "⏱️ O upload travou em 0%. Isso geralmente indica um erro de configuração do 'storageBucket' no index.html ou problema de CORS.",
                isConfigError: true
              });
              setUploadStatus('error');
            } else {
              console.log("Upload cancelado pelo usuário. Resetando UI.");
              setUploadStatus('idle');
              setError(null);
            }
            URL.revokeObjectURL(localPreviewUrl);
            return;
          }

          let detailedMessage: string;
          let isConfigError = true;

          switch (uploadError.code) {
            case 'storage/unauthorized':
              detailedMessage = "🔒 Permissão Negada. Verifique as Regras de Segurança do Firebase Storage.";
              break;
            case 'storage/object-not-found':
            case 'storage/bucket-not-found':
              detailedMessage = "📦 O bucket de armazenamento não foi encontrado.";
              break;
            case 'storage/project-not-found':
              detailedMessage = "🔍 Projeto Firebase não encontrado.";
              break;
            case 'storage/unknown':
              if (!navigator.onLine) {
                detailedMessage = "📡 Sem conexão com a internet.";
                isConfigError = false;
              } else if (uploadError.message?.toLowerCase().includes('cors')) {
                detailedMessage = "🌐 Erro de CORS detectado.";
              } else {
                detailedMessage = `❓ Erro desconhecido: ${uploadError.message || 'Verifique o console.'}`;
              }
              break;
            default:
              detailedMessage = `⚠️ Falha no upload (código: ${uploadError.code || 'desconhecido'}).`;
              break;
          }

          setError({ message: detailedMessage, isConfigError });
          setUploadStatus('error');
          URL.revokeObjectURL(localPreviewUrl);
        },
        async () => {
          if (uploadTimeoutRef.current) {
            clearTimeout(uploadTimeoutRef.current);
            uploadTimeoutRef.current = null;
          }
          
          // Obtém URL da imagem principal
          const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
          
          // Upload do thumbnail em background (não bloqueia)
          let thumbnailURL: string | undefined;
          try {
            await thumbnailRef.put(thumbnailToUpload);
            thumbnailURL = await thumbnailRef.getDownloadURL();
            console.log('📷 Thumbnail enviado com sucesso');
          } catch (thumbError) {
            console.warn('Falha no upload do thumbnail:', thumbError);
            // Continua sem thumbnail - não é crítico
          }
          
          onUploadComplete(downloadURL, thumbnailURL);
          setUploadStatus('success');
          uploadTaskRef.current = null;
          URL.revokeObjectURL(localPreviewUrl);
        }
      );

    } catch (uploadError: any) {
      console.error('❌ Erro ao iniciar upload:', uploadError);

      if (uploadTimeoutRef.current) {
        clearTimeout(uploadTimeoutRef.current);
        uploadTimeoutRef.current = null;
      }

      setError({
        message: `Falha ao iniciar o upload: ${uploadError.message || 'Erro desconhecido'}`,
        isConfigError: true
      });
      setUploadStatus('error');
      URL.revokeObjectURL(localPreviewUrl);
    }
  };

  return (
    <div className="relative aspect-square bg-base-900 rounded-lg overflow-hidden flex items-center justify-center w-full max-w-sm mx-auto">
      <img src={previewUrl} alt="Pré-visualização do animal" className="w-full h-full object-cover" loading="lazy" />

      {/* Status: Comprimindo */}
      {uploadStatus === 'compressing' && (
        <div className="absolute inset-0 bg-base-900/80 flex flex-col items-center justify-center text-white">
          <Spinner />
          <p className="mt-2 text-sm">Otimizando imagem...</p>
        </div>
      )}

      {uploadStatus === 'uploading' && (
        <div className="absolute inset-0 bg-base-900 bg-opacity-70 flex flex-col items-center justify-center text-white p-4">
          <div className="w-3/4 bg-gray-600 rounded-full h-2.5">
            <div className="bg-brand-primary h-2.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
          </div>
          <p className="mt-2 text-sm">{Math.round(uploadProgress)}%</p>
          {compressionSavings && (
            <p className="mt-1 text-xs text-green-400">
              📦 Economia: {compressionSavings}
            </p>
          )}
        </div>
      )}

      {uploadStatus === 'success' && (
        <div className="absolute inset-0 bg-green-900/80 flex flex-col items-center justify-center text-white">
          <CheckIcon className="w-12 h-12" />
          <p className="mt-2 font-bold">Upload Concluído!</p>
          {compressionSavings && (
            <p className="mt-1 text-sm text-green-300">
              Economia: {compressionSavings}
            </p>
          )}
        </div>
      )}

      {error && (
        <div className="absolute inset-0 bg-base-900/95 flex flex-col items-center justify-center text-white p-4 overflow-y-auto">
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
                      <li>Deve terminar com <code className="bg-base-800 px-1 rounded text-accent-green">.appspot.com</code> ou <code className="bg-base-800 px-1 rounded text-accent-green">.firebasestorage.app</code></li>
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
        </div>
      )}

      {uploadStatus !== 'error' && uploadStatus !== 'compressing' && uploadStatus !== 'uploading' && (
        <label htmlFor="photo-upload" className="absolute bottom-4 right-4 bg-brand-primary hover:bg-brand-primary-light text-white p-3 rounded-full cursor-pointer shadow-lg transition-transform hover:scale-110">
          <PhotoIcon className="w-6 h-6" />
          <input 
            id="photo-upload" 
            type="file" 
            accept="image/*" 
            onChange={handleFileChange} 
            className="sr-only" 
            disabled={uploadStatus !== 'idle' && uploadStatus !== 'success'}
          />
        </label>
      )}
    </div>
  );
};

export default ImageAnalyzer;
