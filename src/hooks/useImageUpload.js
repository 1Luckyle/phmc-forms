import { useState } from 'react';
import * as Sentry from "@sentry/react";

export const useImageUpload = (showNotification, setFormData) => {
    const [isUploading, setIsUploading] = useState(false);

    const handleImageUpload = async (imageSource, fieldName) => {
        setIsUploading(true);
        let imageUrls = [];

        try {
            const imgbbApiKey = process.env.REACT_APP_IMGBB_API_KEY;
            if (!imgbbApiKey) {
                showNotification('La clé API ImgBB n\'est pas configurée.', 'error');
                setIsUploading(false);
                return;
            }

            let filesToUpload = [];
            if (typeof imageSource === 'string') {
                filesToUpload.push(imageSource);
            } else if (imageSource.target && imageSource.target.files) {
                filesToUpload = Array.from(imageSource.target.files);
            } else {
                filesToUpload.push(imageSource);
            }

            for (const file of filesToUpload) {
                const formData = new FormData();
                let base64Image;

                if (typeof file === 'string') {
                    base64Image = file.split(',')[1];
                } else {
                    base64Image = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result.split(',')[1]);
                        reader.onerror = reject;
                        reader.readAsDataURL(file);
                    });
                }
                
                formData.append('image', base64Image);

                const response = await fetch(`https://api.imgbb.com/1/upload?key=${imgbbApiKey}`, {
                    method: 'POST',
                    body: formData,
                });

                const data = await response.json();

                if (data.success) {
                    imageUrls.push(data.data.url);
                } else {
                    console.error('ImgBB upload failed:', data.error.message);
                    showNotification(`Le téléchargement ImgBB a échoué pour l'une des images : ${data.error.message}`, 'exclamation-circle');
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
        const imgbbApiKey = process.env.REACT_APP_IMGBB_API_KEY;
        if (!imgbbApiKey) {
            throw new Error('upload failed: la clé API ImgBB (REACT_APP_IMGBB_API_KEY) n\'est pas configurée.');
        }
        let data;
        try {
            const formData = new FormData();
            formData.append('image', dataUrl.split(',')[1]);
            const response = await fetch(`https://api.imgbb.com/1/upload?key=${imgbbApiKey}`, { method: 'POST', body: formData });
            data = await response.json();
        } catch (error) {
            console.error('Upload failed:', error);
            Sentry.captureException(error, { extra: { context: 'uploadImageDetailed' } });
            throw new Error(`upload failed: ImgBB injoignable (${error.message || 'réseau'}).`);
        }
        if (!data || !data.success) {
            console.error('ImgBB upload failed:', data);
            throw new Error(`upload failed: ImgBB a refusé l'image (${data?.error?.message || data?.status_txt || 'erreur inconnue'}).`);
        }
        return { url: data.data.url, deleteUrl: data.data.delete_url || '' };
    };

    return { isUploading, handleImageUpload, uploadImageDetailed };
};
