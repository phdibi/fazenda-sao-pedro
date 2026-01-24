import React, { useState, useEffect, useRef } from 'react';
import Spinner from './common/Spinner';
import { PhotoIcon, CheckIcon, TrashIcon } from './common/Icons';
import { firebaseServices } from '../services/firebase';
import { prepareImageForUpload, getOptimalFormat } from '../utils/imageOptimization';
import { isValidFirebaseStorageUrl } from '../services/storageService';

interface ImageAnalyzerProps {
    imageUrl: string;
    onUploadComplete: (newPhotoUrl: string, thumbnailUrl?: string) => void;
    animalId: string;
    userId: string;
    // Props para deleção de foto
    onDeletePhoto?: () => Promise<{ success: boolean; error?: string; freedSpace?: number }>;
    isDeletingPhoto?: boolean;
    isEditing?: boolean;
}

type UploadError = {
    message: string;
    isConfigError?: boolean;
};

type UploadStatus = 'idle' | 'compressing' | 'uploading' | 'success' | 'error' | 'deleting' | 'deleted';

const ImageAnalyzerOptimized = ({
    imageUrl,
    onUploadComplete,
    animalId,
    userId,
    onDeletePhoto,
    isDeletingPhoto = false,
    isEditing = false
}: ImageAnalyzerProps) => {
    const [previewUrl, setPreviewUrl] = useState<string>(imageUrl);
    const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
    const [uploadProgress, setUploadProgress] = useState(0);
    const [compressionSavings, setCompressionSavings] = useState<string>('');
    const [error, setError] = useState<UploadError | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteResult, setDeleteResult] = useState<{ freedSpace?: number } | null>(null);

    const uploadTaskRef = useRef<any | null>(null);
    const uploadTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Verifica se a foto atual pode ser deletada
    const canDeletePhoto = isEditing &&
                          onDeletePhoto &&
                          isValidFirebaseStorageUrl(imageUrl) &&
                          uploadStatus === 'idle';

    useEffect(() => {
        setPreviewUrl(imageUrl);
        if (uploadStatus !== 'idle' && uploadStatus !== 'deleted') {
            setUploadStatus('idle');
            setUploadProgress(0);
            setError(null);
            setCompressionSavings('');
        }
        if (uploadTaskRef.current) {
            uploadTaskRef.current.cancel();
            uploadTaskRef.current = null;
        }
        setShowDeleteConfirm(false);
        setDeleteResult(null);
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

    // Atualiza status quando isDeletingPhoto muda
    useEffect(() => {
        if (isDeletingPhoto) {
            setUploadStatus('deleting');
        }
    }, [isDeletingPhoto]);

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

    const handleDeleteClick = () => {
        setShowDeleteConfirm(true);
    };

    const handleConfirmDelete = async () => {
        if (!onDeletePhoto) return;

        setShowDeleteConfirm(false);
        setUploadStatus('deleting');

        const result = await onDeletePhoto();

        if (result.success) {
            setDeleteResult({ freedSpace: result.freedSpace });
            setUploadStatus('deleted');
            // Reset após 2 segundos
            setTimeout(() => {
                setUploadStatus('idle');
                setDeleteResult(null);
            }, 2000);
        } else {
            setError({ message: result.error || 'Erro ao deletar foto' });
            setUploadStatus('error');
        }
    };

    const handleCancelDelete = () => {
        setShowDeleteConfirm(false);
    };

    const formatBytes = (bytes: number): string => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
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

            {/* Status: Deletando */}
            {uploadStatus === 'deleting' && (
                <div className="absolute inset-0 bg-base-900/80 flex flex-col items-center justify-center text-white">
                    <Spinner />
                    <p className="mt-2 text-sm">Deletando foto...</p>
                </div>
            )}

            {/* Status: Foto Deletada */}
            {uploadStatus === 'deleted' && (
                <div className="absolute inset-0 bg-green-900/80 flex flex-col items-center justify-center text-white">
                    <CheckIcon className="w-12 h-12" />
                    <p className="mt-2 font-bold">Foto Removida!</p>
                    {deleteResult?.freedSpace && (
                        <p className="mt-1 text-sm text-green-300">
                            Liberados: {formatBytes(deleteResult.freedSpace)}
                        </p>
                    )}
                    <p className="mt-2 text-xs text-gray-300">
                        Clique em "Salvar" para confirmar
                    </p>
                </div>
            )}

            {/* Confirmação de Deleção */}
            {showDeleteConfirm && (
                <div className="absolute inset-0 bg-base-900/95 flex flex-col items-center justify-center text-white p-4">
                    <TrashIcon className="w-10 h-10 text-red-400 mb-3" />
                    <p className="text-center font-semibold mb-1">Deletar esta foto?</p>
                    <p className="text-center text-sm text-gray-400 mb-4">
                        Isso liberará espaço no Storage.<br/>
                        A ação não pode ser desfeita.
                    </p>
                    <div className="flex gap-3">
                        <button
                            onClick={handleCancelDelete}
                            className="bg-base-700 hover:bg-base-600 px-4 py-2 rounded text-sm"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleConfirmDelete}
                            className="bg-red-600 hover:bg-red-500 px-4 py-2 rounded text-sm font-semibold"
                        >
                            Deletar
                        </button>
                    </div>
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

            {/* Botões de Ação */}
            {uploadStatus !== 'error' &&
             uploadStatus !== 'compressing' &&
             uploadStatus !== 'uploading' &&
             uploadStatus !== 'deleting' &&
             uploadStatus !== 'deleted' &&
             !showDeleteConfirm && (
                <div className="absolute bottom-4 right-4 flex gap-2">
                    {/* Botão Deletar Foto (só aparece em modo edição com foto válida) */}
                    {canDeletePhoto && (
                        <button
                            onClick={handleDeleteClick}
                            className="bg-red-600 hover:bg-red-500 text-white p-3 rounded-full shadow-lg transition-transform hover:scale-110"
                            title="Deletar foto (libera espaço no Storage)"
                        >
                            <TrashIcon className="w-5 h-5" />
                        </button>
                    )}

                    {/* Botão Upload */}
                    <label
                        htmlFor="photo-upload"
                        className="bg-brand-primary hover:bg-brand-primary-light text-white p-3 rounded-full cursor-pointer shadow-lg transition-transform hover:scale-110"
                        title="Enviar nova foto"
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
                </div>
            )}
        </div>
    );
};

export default ImageAnalyzerOptimized;
