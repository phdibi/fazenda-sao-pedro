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

type UploadError = {
    message: string;
    isConfigError?: boolean;
};

type UploadStatus = 'idle' | 'compressing' | 'uploading' | 'success' | 'error';

const ImageAnalyzerOptimized = ({ imageUrl, onUploadComplete, animalId, userId }: ImageAnalyzerProps) => {
    const [previewUrl, setPreviewUrl] = useState<string>(imageUrl);
    const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
    const [uploadProgress, setUploadProgress] = useState(0);
    const [compressionSavings, setCompressionSavings] = useState<string>('');
    const [error, setError] = useState<UploadError | null>(null);

    const uploadTaskRef = useRef<any | null>(null);
    const uploadTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

        const storage = firebaseServices.storage;
        if (!storage) {
            setError({
                message: "Firebase Storage não configurado.",
                isConfigError: true
            });
            setUploadStatus('error');
            return;
        }

        setError(null);
        setUploadProgress(0);
        setCompressionSavings('');

        // Preview local imediato
        const localPreviewUrl = URL.createObjectURL(file);
        setPreviewUrl(localPreviewUrl);

        // ============================================
        // 🔧 OTIMIZAÇÃO: COMPRESSÃO + THUMBNAIL
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

        } catch (compressError) {
            console.warn('Falha na compressão, usando original:', compressError);
            fileToUpload = file;
            thumbnailToUpload = file; // Fallback: usa original como thumb também
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

            // Upload da imagem principal
            const uploadTask = storageRef.put(fileToUpload);
            uploadTaskRef.current = uploadTask;

            // Timeout para detectar problemas
            uploadTimeoutRef.current = setTimeout(() => {
                if (uploadTask.snapshot.bytesTransferred === 0) {
                    uploadTask.cancel();
                    setError({
                        message: "Upload travou. Verifique configuração do storageBucket.",
                        isConfigError: true
                    });
                    setUploadStatus('error');
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
                    }
                    uploadTaskRef.current = null;
                    
                    if (uploadError.code === 'storage/canceled') {
                        setUploadStatus('idle');
                        return;
                    }

                    let message = "Erro no upload";
                    if (uploadError.code === 'storage/unauthorized') {
                        message = "Sem permissão. Verifique regras do Storage.";
                    } else if (uploadError.code === 'storage/bucket-not-found') {
                        message = "Bucket não encontrado. Verifique storageBucket.";
                    }

                    setError({ message, isConfigError: true });
                    setUploadStatus('error');
                    URL.revokeObjectURL(localPreviewUrl);
                },
                async () => {
                    if (uploadTimeoutRef.current) {
                        clearTimeout(uploadTimeoutRef.current);
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
            console.error('Erro no upload:', uploadError);
            setError({ message: uploadError.message || 'Erro desconhecido', isConfigError: true });
            setUploadStatus('error');
            URL.revokeObjectURL(localPreviewUrl);
        }
    };

    return (
        <div className="relative aspect-square bg-base-900 rounded-lg overflow-hidden flex items-center justify-center w-full max-w-sm mx-auto">
            <img 
                src={previewUrl} 
                alt="Foto do animal" 
                className="w-full h-full object-cover"
                loading="lazy" // 🔧 Lazy loading nativo
            />

            {/* Status: Comprimindo */}
            {uploadStatus === 'compressing' && (
                <div className="absolute inset-0 bg-base-900/80 flex flex-col items-center justify-center text-white">
                    <Spinner />
                    <p className="mt-2 text-sm">Otimizando imagem...</p>
                </div>
            )}

            {/* Status: Uploading */}
            {uploadStatus === 'uploading' && (
                <div className="absolute inset-0 bg-base-900/80 flex flex-col items-center justify-center text-white p-4">
                    <div className="w-3/4 bg-gray-600 rounded-full h-2.5">
                        <div 
                            className="bg-brand-primary h-2.5 rounded-full transition-all duration-300"
                            style={{ width: `${uploadProgress}%` }}
                        />
                    </div>
                    <p className="mt-2 text-sm">{Math.round(uploadProgress)}%</p>
                    {compressionSavings && (
                        <p className="mt-1 text-xs text-green-400">
                            📦 {compressionSavings}
                        </p>
                    )}
                </div>
            )}

            {/* Status: Sucesso */}
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

            {/* Status: Erro */}
            {error && (
                <div className="absolute inset-0 bg-base-900/95 flex flex-col items-center justify-center text-white p-4">
                    <div className="text-center">
                        <p className="text-red-400 font-semibold mb-2">{error.message}</p>
                        <button
                            onClick={() => {
                                setError(null);
                                setUploadStatus('idle');
                            }}
                            className="mt-4 bg-base-700 hover:bg-base-600 px-4 py-2 rounded text-sm"
                        >
                            Tentar novamente
                        </button>
                    </div>
                </div>
            )}

            {/* Botão de Upload */}
            {uploadStatus !== 'error' && uploadStatus !== 'compressing' && uploadStatus !== 'uploading' && (
                <label 
                    htmlFor="photo-upload" 
                    className="absolute bottom-4 right-4 bg-brand-primary hover:bg-brand-primary-light text-white p-3 rounded-full cursor-pointer shadow-lg transition-transform hover:scale-110"
                >
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

export default ImageAnalyzerOptimized;
