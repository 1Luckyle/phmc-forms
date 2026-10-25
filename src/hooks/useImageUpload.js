import { useState } from 'react';
import { uploadImageToServer } from '../utils/imageUploadApi';
import * as Sentry from "@sentry/react";

export const useImageUpload = (showNotification, setFormData) => {
    const [isUploading, setIsUploading] = useState(false);

    const handleImageUpload = async (imageSource, fieldName) => {
        setIsUploading(true);
        let imageUrls = [];

        try {
            let filesToUpload = [];
            if (typeof imageSource === 'string') {
                filesToUpload.push(imageSource);
            } else if (imageSource.target && imageSource.target.files) {
                filesToUpload = Array.from(imageSource.target.files);
            } else {
                filesToUpload.push(imageSource);
            }

            for (const file of filesToUpload) {
                let dataUrl;
                if (typeof file === 'string') {
                    dataUrl = file;
                } else {
                    dataUrl = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result);
                        reader.onerror = reject;
                        reader.readAsDataURL(file);
                    });
                }

                try {
                    const { url } = await uploadImageToServer(dataUrl);
                    imageUrls.push(url);
                } catch (uploadError) {
                    console.error('Image upload failed:', uploadError);
                    showNotification(`Le téléchargement a échoué pour l'une des images : ${uploadError.message}`, 'exclamation-circle');
                }
            }

            if (imageUrls.length > 0) {
                showNotification(`${imageUrls.length} image(s) téléchargée(s) avec succès!`, 'check-circle');

                if (fieldName) {
                    if (fieldName.includes('-')) {
                        const [key, indexStr] = fieldName.split('-');
                        const index = parseInt(indexStr, 10);

                        setFormData(prev => {
                            const newDecedents = [...prev.decedents];
                            const currentDecedent = newDecedents[index];
                            const currentValue = currentDecedent[key] || '';
                            const newValue = currentValue ? `${currentValue}, ${imageUrls.join(', ')}` : imageUrls.join(', ');
                            newDecedents[index] = { ...currentDecedent, [key]: newValue };

                            return { ...prev, decedents: newDecedents };
                        });

                    } else {
                        setFormData(prev => {
                            const currentValue = prev[fieldName] || '';
                            const newValue = currentValue ? `${currentValue}, ${imageUrls.join(', ')}` : imageUrls.join(', ');
                            return {
                                ...prev,
                                [fieldName]: newValue
                            };
                        });
                    }
                }
            }

        } catch (error) {
            console.error('Upload failed:', error);
            Sentry.captureException(error, { extra: { context: 'handleImageUpload' } });
            showNotification('Le téléchargement a échoué !', 'exclamation-circle');
        } finally {
            setIsUploading(false);
            return imageUrls;
        }
    };

    // Envoie UNE image (data URL) et retourne { url, deleteUrl }.
    // En cas d'échec, lève « upload failed: <raison> » pour que l'appelant affiche la vraie cause.
    // `deleteUrl` est la page de suppression ImgBB (ImgBB n'a pas d'API de suppression).
    const uploadImageDetailed = async (dataUrl) => {
        try {
            return await uploadImageToServer(dataUrl);
        } catch (error) {
            console.error('Upload failed:', error);
            Sentry.captureException(error, { extra: { context: 'uploadImageDetailed' } });
            throw new Error(`upload failed: ${error.message}`);
        }
    };

    return { isUploading, handleImageUpload, uploadImageDetailed };
};
