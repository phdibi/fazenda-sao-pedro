// ============================================
// SERVIÇO DE STORAGE - GERENCIAMENTO DE FOTOS
// ============================================
// Funções para upload, deleção e gerenciamento
// de fotos no Firebase Storage

import { firebaseServices } from './firebase';

// ============================================
// TIPOS
// ============================================

export interface DeletePhotoResult {
    success: boolean;
    deletedUrl?: string;
    deletedThumbnailUrl?: string;
    error?: string;
    freedSpace?: number; // bytes liberados (estimativa)
}

export interface StorageUsageInfo {
    totalPhotos: number;
    estimatedSize: string;
}

// ============================================
// UTILITÁRIOS
// ============================================

/**
 * Extrai o caminho do Storage a partir de uma URL do Firebase
 * URLs do Firebase Storage seguem o padrão:
 * https://firebasestorage.googleapis.com/v0/b/BUCKET/o/PATH%2FENCODED?token=...
 */
const extractPathFromUrl = (url: string): string | null => {
    try {
        // Verifica se é uma URL do Firebase Storage
        if (!url.includes('firebasestorage.googleapis.com')) {
            return null;
        }

        // Extrai o path encoded após "/o/"
        const match = url.match(/\/o\/(.+?)\?/);
        if (!match) return null;

        // Decodifica o path (substitui %2F por /)
        const encodedPath = match[1];
        const decodedPath = decodeURIComponent(encodedPath);

        return decodedPath;
    } catch (error) {
        console.error('Erro ao extrair path da URL:', error);
        return null;
    }
};

/**
 * Gera a URL do thumbnail a partir da URL principal
 * Padrão: timestamp.ext -> timestamp_thumb.ext
 */
const getThumbnailUrl = (mainUrl: string): string | null => {
    try {
        // Extrai o nome do arquivo da URL
        const path = extractPathFromUrl(mainUrl);
        if (!path) return null;

        // Encontra a extensão e adiciona _thumb
        const lastDot = path.lastIndexOf('.');
        if (lastDot === -1) return null;

        const basePath = path.substring(0, lastDot);
        const extension = path.substring(lastDot);
        const thumbPath = `${basePath}_thumb${extension}`;

        // Reconstrói a URL do thumbnail
        // Nota: isso não é perfeito mas serve para nosso propósito
        return mainUrl.replace(encodeURIComponent(path.split('/').pop()!),
                              encodeURIComponent(thumbPath.split('/').pop()!));
    } catch {
        return null;
    }
};

/**
 * Formata bytes para string legível
 */
const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// ============================================
// FUNÇÕES PRINCIPAIS
// ============================================

/**
 * Deleta uma foto do Firebase Storage
 * Também tenta deletar o thumbnail associado
 *
 * @param photoUrl - URL da foto principal
 * @returns Resultado da operação
 */
export const deletePhotoFromStorage = async (photoUrl: string): Promise<DeletePhotoResult> => {
    const storage = firebaseServices.storage;

    if (!storage) {
        return {
            success: false,
            error: 'Firebase Storage não configurado'
        };
    }

    // Ignora placeholders
    if (photoUrl.includes('cow_placeholder.png') ||
        photoUrl.includes('placeholder') ||
        !photoUrl.includes('firebasestorage.googleapis.com')) {
        return {
            success: true,
            deletedUrl: photoUrl,
            error: 'URL ignorada (placeholder ou externa)'
        };
    }

    const path = extractPathFromUrl(photoUrl);
    if (!path) {
        return {
            success: false,
            error: 'Não foi possível extrair o caminho da URL'
        };
    }

    let freedSpace = 0;
    let deletedThumbnailUrl: string | undefined;

    try {
        // Deleta a foto principal
        const mainRef = storage.ref(path);

        // Tenta obter metadados para saber o tamanho
        try {
            const metadata = await mainRef.getMetadata();
            freedSpace += metadata.size || 0;
        } catch {
            // Se não conseguir metadados, estima ~150KB
            freedSpace += 150 * 1024;
        }

        await mainRef.delete();
        console.log(`🗑️ Foto deletada: ${path}`);

        // Tenta deletar o thumbnail associado
        const lastDot = path.lastIndexOf('.');
        if (lastDot !== -1) {
            const thumbPath = `${path.substring(0, lastDot)}_thumb${path.substring(lastDot)}`;
            try {
                const thumbRef = storage.ref(thumbPath);

                // Obtém tamanho do thumbnail
                try {
                    const thumbMetadata = await thumbRef.getMetadata();
                    freedSpace += thumbMetadata.size || 0;
                } catch {
                    freedSpace += 15 * 1024; // Estima ~15KB para thumbnail
                }

                await thumbRef.delete();
                deletedThumbnailUrl = thumbPath;
                console.log(`🗑️ Thumbnail deletado: ${thumbPath}`);
            } catch (thumbError: any) {
                // Thumbnail pode não existir, não é erro crítico
                if (thumbError.code !== 'storage/object-not-found') {
                    console.warn('Aviso ao deletar thumbnail:', thumbError);
                }
            }
        }

        return {
            success: true,
            deletedUrl: photoUrl,
            deletedThumbnailUrl,
            freedSpace
        };

    } catch (error: any) {
        console.error('Erro ao deletar foto:', error);

        // Trata erros específicos
        if (error.code === 'storage/object-not-found') {
            return {
                success: true, // Considera sucesso se o arquivo já não existe
                deletedUrl: photoUrl,
                error: 'Arquivo já havia sido deletado'
            };
        }

        if (error.code === 'storage/unauthorized') {
            return {
                success: false,
                error: 'Sem permissão para deletar. Verifique as regras do Storage.'
            };
        }

        return {
            success: false,
            error: error.message || 'Erro desconhecido ao deletar'
        };
    }
};

/**
 * Deleta múltiplas fotos do Firebase Storage
 * Útil para limpar todas as fotos de um animal
 *
 * @param photoUrls - Array de URLs das fotos
 * @returns Array de resultados
 */
export const deleteMultiplePhotos = async (photoUrls: string[]): Promise<{
    results: DeletePhotoResult[];
    totalFreed: number;
    successCount: number;
    errorCount: number;
}> => {
    const results: DeletePhotoResult[] = [];
    let totalFreed = 0;
    let successCount = 0;
    let errorCount = 0;

    for (const url of photoUrls) {
        const result = await deletePhotoFromStorage(url);
        results.push(result);

        if (result.success) {
            successCount++;
            totalFreed += result.freedSpace || 0;
        } else {
            errorCount++;
        }
    }

    console.log(`📊 Deleção concluída: ${successCount} sucesso, ${errorCount} erros, ${formatBytes(totalFreed)} liberados`);

    return {
        results,
        totalFreed,
        successCount,
        errorCount
    };
};

/**
 * Verifica se uma URL é uma foto válida do Firebase Storage
 */
export const isValidFirebaseStorageUrl = (url: string): boolean => {
    return url.includes('firebasestorage.googleapis.com') &&
           !url.includes('cow_placeholder.png');
};

/**
 * Conta quantas fotos válidas existem em um array
 */
export const countValidPhotos = (photoUrls: string[]): number => {
    return photoUrls.filter(isValidFirebaseStorageUrl).length;
};

/**
 * Estima o espaço ocupado por fotos (baseado em médias)
 * - Foto comprimida: ~150KB
 * - Thumbnail: ~15KB
 */
export const estimateStorageUsage = (photoCount: number): string => {
    const avgPhotoSize = 150 * 1024; // 150KB
    const avgThumbSize = 15 * 1024;  // 15KB
    const totalEstimate = photoCount * (avgPhotoSize + avgThumbSize);
    return formatBytes(totalEstimate);
};
