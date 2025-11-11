import React, { useState, useEffect } from 'react';
import coroner from '../assets/county-coroner.png';

// --- Styles ---
// ... (Keep other styles: modalStyle, modalContentStyle, etc.) ...
const modalStyle = {
    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.7)', display: 'flex',
    justifyContent: 'center', alignItems: 'center', zIndex: 1050,
};
const modalContentStyle = {
    backgroundColor: '#0d1117', color: '#c9d1d9', padding: '25px',
    borderRadius: '8px', width: '85%', maxWidth: '700px',
    maxHeight: '85vh', overflowY: 'auto', position: 'relative',
    border: '1px solid #30363d', boxShadow: '0 5px 15px rgba(0,0,0,0.3)',
};
const modalHeaderStyle = {
    fontSize: '1.4em', fontWeight: 'bold', marginBottom: '15px',
    textAlign: 'center', borderBottom: '1px solid #30363d', paddingBottom: '15px',
};
const logoStyle = {
    display: 'block', margin: '10px auto 15px auto', maxWidth: '350px', height: 'auto',
};
const buttonContainerStyle = {
    display: 'flex',
    justifyContent: 'center', // Center the buttons
    gap: '10px', // Add space between buttons
    marginBottom: '20px', // Increased space below buttons
};
const sectionButtonStyle = {
    backgroundColor: '#21262d', // Darker, inactive background
    color: '#c9d1d9', // Light text
    border: '1px solid #30363d',
    padding: '8px 15px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.95em',
    transition: 'background-color 0.2s ease, border-color 0.2s ease', // Smooth transition
};
const activeSectionButtonStyle = {
    ...sectionButtonStyle, // Inherit base styles
    backgroundColor: '#238636', // Green background for active
    color: '#ffffff', // White text for active
    borderColor: '#30363d', // Keep border consistent or make slightly brighter if desired
};
const contentDisplayStyle = {
    width: '96%',
    // minHeight: '300px', // <-- REMOVED this line
    backgroundColor: '#161b22',
    color: '#c9d1d9',
    border: '1px solid #30363d',
    borderRadius: '5px',
    padding: '8px 9px',
    fontSize: '0.95em',
    lineHeight: '1.3',
    marginBottom: '20px',
    fontFamily: 'monospace',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'break-word', // Use overflowWrap instead of wordWrap
};

// --- Updated Footer Style ---
const modalFooterStyle = {
    display: 'flex',
    justifyContent: 'flex-end', // Keep items to the right
    alignItems: 'center', // Align items vertically
    marginTop: '20px',
    paddingTop: '15px',
    borderTop: '1px solid #30363d',
    gap: '8px', // Adjust gap for checkbox
};
// --- End Updated Footer Style ---

// --- Style for the label text ---
const footerLabelStyle = {
    fontSize: '0.9em',
    color: '#8b949e', // Dimmer color like helper text
    cursor: 'pointer', // Make label clickable to toggle checkbox
    userSelect: 'none', // Prevent text selection on click
};
// --- End Label Style ---

// --- Style for the checkbox ---
const checkboxStyle = {
    cursor: 'pointer',
    width: '16px', // Adjust size as needed
    height: '16px', // Adjust size as needed
    accentColor: '#6e7681', // Match the old button color for the checkmark
};
// --- End Checkbox Style ---

const closeButtonStyle = {
    position: 'absolute', top: '15px', right: '15px', background: 'none',
    border: 'none', color: '#f85149', fontSize: '24px', cursor: 'pointer', lineHeight: '1',
};
// --- End Styles ---

const LOCAL_STORAGE_KEY = 'hideCoronerTipsModal';

// --- Content Definitions (Keep as they are) ---
const tipsContent = `Bienvenue sur la page d'information du coroner

**Informations de base**
- Si votre nom est manquant sur ce site web, cliquez sur le bouton 'Données employé manquantes'.
- Les manuels peuvent être trouvés ici : Indisponible actuellement.

**Gestion de la radio**
- Le grade le plus élevé en service gérera généralement la radio.
- Vous pouvez utiliser /choixdep (faction) et /departement pour répondre aux factions.
- Exemple : /choixdep LSPD | /departement Bureau du coroner, vous avez une unité dépêchée, ETA est 5 minutes.
- Si vous NPC une unité (envoyer une unité par /do), informez les agents des forces de l'ordre que l'unité est en NPC et dites-leur de /envoyermorgue.

Plus de conseils à venir bientôt !`;

const commandsContent = `**Commandes de service :**
/cduty | /duty - Prendre/quitter le service en tant que coroner.
/trunk - Ouvre le coffre
/ctrunk | /cremove - Range un corps dans le coffre, retire un corps du coffre.
/cdrag - Traîner un corps jusqu'au fourgon du coroner - NOTE : Vous devez faire un clic droit pour arrêter de traîner sinon vous devenez un vaisseau spatial
/cdamages | /cexamine | /cdna - Examiner le défunt pour les dommages, l'ADN et les attributs du corps.
/cloot - Vérifier les objets sur le corps du défunt.

**Commandes de Roleplay :**
/createscene - Crée un /do de zone pour que les autres puissent voir.
/rb - Fait apparaître un objet au sol, vous pouvez utiliser Legal Factions - Gurney ou Bodybag.
Plus de commandes à venir bientôt !`;

const sceneInfoContent = `**Approche initiale :**
<ul>- Assurez-vous que la scène est sécurisée avant d'entrer.
- Observez la disposition générale de la scène sans déranger les preuves.
- Identifiez l'agent des forces de l'ordre responsable et demandez l'autorisation de déplacer le corps.</ul>**Documentation :**
<ul>- Prenez de brèves notes de la scène et remplissez le résumé succinct au fur et à mesure.
- Photographiez les détails importants (/camera) : (défunt, éclaboussures ou flaques de sang, preuves).</ul>**Examen du défunt (sur la scène) :**
<ul>- Notez la position et la tenue du défunt.
- Examinez le défunt et déterminez les causes du décès (/cdamages & /cdna - Prenez une capture d'écran car vous en aurez besoin pour le rapport).
- Vérifiez l'identification, les effets personnels (/cloot).</ul>**Gestion des preuves :**
<ul>- Ne déplacez aucune preuve avant de collecter des photographies.
- Si une preuve doit être déplacée, documentez d'abord son emplacement d'origine.
- Informez les agents des forces de l'ordre si des armes à feu/drogues sont trouvées, si aucune n'est présente, rangez-les dans le casier à preuves (/el).</ul>**Étapes finales :**
<ul>- Déplacez le défunt vers le fourgon du coroner (/cdrag). Une fois au fourgon, faites un clic droit pour arrêter de traîner et (/ctrunk) pour ranger le défunt à l'intérieur.
- Retournez à la morgue et ouvrez le coffre (/trunk) et sortez le défunt (/cremove) et placez-le dans la morgue (/cmorgue).
- Remplissez le rapport du défunt et déposez-le sur le forum.
`;
// --- End Content ---

// --- Helper function to parse simple markdown-like bold ---
const parseBoldMarkdown = (text) => {
    const boldRegex = /\*\*(.*?)\*\*/g;
    const htmlText = text.replace(boldRegex, '<b>$1</b>');
    return { __html: htmlText };
};
// --- End Helper Function ---

const CoronerTipsModal = ({ show, onClose }) => {
    const [displayMode, setDisplayMode] = useState('tips');
    const [dontShowAgain, setDontShowAgain] = useState(false);

    useEffect(() => {
        if (show) {
            // Check localStorage when the modal becomes visible
            const shouldHidePermanently = localStorage.getItem(LOCAL_STORAGE_KEY) === 'true';
            setDontShowAgain(shouldHidePermanently); // Set checkbox state based on storage
            setDisplayMode('tips'); // Reset content view
        }
    }, [show]); // Run when the 'show' prop changes

    const handleDontShowAgainChange = (event) => {
        const isChecked = event.target.checked;
        setDontShowAgain(isChecked); // Update the state immediately

        try {
            if (isChecked) {
                localStorage.setItem(LOCAL_STORAGE_KEY, 'true');
                // Optionally close the modal immediately when checked, or wait for user to close
                // onClose();
            } else {
                // If unchecked, remove the item from localStorage
                localStorage.removeItem(LOCAL_STORAGE_KEY);
            }
        } catch (error) {
            console.error("Failed to update localStorage item:", error);
            // Revert state if localStorage fails? Optional.
            // setDontShowAgain(!isChecked);
        }
    };

    const handleClose = () => {
        onClose();
    };

    if (!show) {
        return null;
    }

    let currentContent;
    switch (displayMode) {
        // ... switch cases ...
        case 'commands':
            currentContent = commandsContent;
            break;
        case 'scene':
            currentContent = sceneInfoContent;
            break;
        case 'tips':
        default:
            currentContent = tipsContent;
            break;
    }

    const parsedHtmlContent = parseBoldMarkdown(currentContent);

    return (
        <div style={modalStyle} onClick={handleClose}>
            <div
                style={modalContentStyle}
                className="coroner-tips-modal-content"
                onClick={(e) => e.stopPropagation()}
            >
                <button onClick={handleClose} style={closeButtonStyle} aria-label="Fermer la fenêtre">
                    &times;
                </button>
                <div style={modalHeaderStyle}>
                    Guide d'astuce des coroners
                </div>
                <img src={coroner} alt="Logo du coroner" style={logoStyle} />

                <div style={buttonContainerStyle}>
                    {/* ... section buttons ... */}
                     <button
                        onClick={() => setDisplayMode('tips')}
                        style={displayMode === 'tips' ? activeSectionButtonStyle : sectionButtonStyle}
                    >
                        Conseils et astuces
                    </button>
                    <button
                        onClick={() => setDisplayMode('commands')}
                        style={displayMode === 'commands' ? activeSectionButtonStyle : sectionButtonStyle}
                    >
                        Commandes utiles
                    </button>
                    <button
                        onClick={() => setDisplayMode('scene')}
                        style={displayMode === 'scene' ? activeSectionButtonStyle : sectionButtonStyle}
                    >
                        Résumé de la gestion de scène
                    </button>
                </div>

                <div
                    style={contentDisplayStyle}
                    dangerouslySetInnerHTML={parsedHtmlContent}
                />

                {/* --- Updated Footer with Checkbox --- */}
                <div style={modalFooterStyle}>
                    <label htmlFor="dontShowAgainCheckbox" style={footerLabelStyle}>
                        Ne plus afficher automatiquement ?
                    </label>
                    <input
                        type="checkbox"
                        id="dontShowAgainCheckbox"
                        checked={dontShowAgain} // <-- Control checked state
                        onChange={handleDontShowAgainChange} // <-- Use updated handler
                        style={checkboxStyle}
                        title="Empêcher cette fenêtre de s'afficher automatiquement" // Updated title
                    />
                </div>
                {/* --- End Updated Footer --- */}
            </div>
        </div>
    );
};

export default CoronerTipsModal;