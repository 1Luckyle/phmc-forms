import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './BaseModal.css';
import './DarkUi.css';

const BaseModal = ({
    isOpen,
    onClose,
    title,
    children,
    className = '',
    showCloseButton = true,
    closeOnOverlayClick = true,
    modalSize = 'medium',
    zIndex = 1050,
}) => {
    const modalRef = useRef(null);
    const previousActiveElement = useRef(null);
    // onClose est le plus souvent une fonction fléchée recréée à chaque rendu du parent (MainApp se
    // re-rend chaque seconde à cause de l'horloge UTC). On la lit via une ref : placée dans les
    // dépendances de l'effet ci-dessous, elle le rejouerait chaque seconde et volerait le focus au
    // champ en cours de saisie (champs et listes qui "se désélectionnent tout seuls").
    const onCloseRef = useRef(onClose);
    useEffect(() => { onCloseRef.current = onClose; });

    useEffect(() => {
        if (isOpen) {
            // Store the currently focused element
            previousActiveElement.current = document.activeElement;
            
            // Lock body scroll
            document.body.style.overflow = 'hidden';
            
            // Focus the modal (sauf si le focus est déjà à l'intérieur)
            if (!modalRef.current?.contains(document.activeElement)) {
                modalRef.current?.focus();
            }

            // Handle escape key
            const handleEscape = (e) => {
                if (e.key === 'Escape' && onCloseRef.current) {
                    onCloseRef.current();
                }
            };
            window.addEventListener('keydown', handleEscape);

            return () => {
                // Cleanup
                document.body.style.overflow = '';
                window.removeEventListener('keydown', handleEscape);
                
                // Restore focus
                previousActiveElement.current?.focus();
            };
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleOverlayClick = (e) => {
        if (closeOnOverlayClick && e.target === e.currentTarget && onClose) {
            onClose();
        }
    };

    const modalContent = (
        <div 
            className="modal-overlay"
            onClick={handleOverlayClick}
            style={{ zIndex }}
            role="presentation"
        >
            <div
                ref={modalRef}
                className={`modal-container dark-ui ${className} modal-size-${modalSize}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-title"
                tabIndex={-1}
            >
                <div className="modal-header">
                    <h2 id="modal-title" className="modal-title">{title}</h2>
                    {showCloseButton && (
                        <button
                            type="button"
                            className="modal-close-button"
                            onClick={onClose}
                            aria-label="Close modal"
                        >
                            ×
                        </button>
                    )}
                </div>
                <div className="modal-content">
                    {children}
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};

export default BaseModal;