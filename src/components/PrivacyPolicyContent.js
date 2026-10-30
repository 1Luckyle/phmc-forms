// src/components/PrivacyPolicyContent.js
//
// TEXTE de la politique de confidentialité, partagé par la fenêtre « Politique de confidentialité » (PrivacyPolicyModal, pied de page) et par l'étape du
// guide de configuration (OnboardingModal) : les deux affichent le même texte, publié depuis le panneau admin (Admin → Politique de confidentialité).
// Sans version publiée, c'est le texte d'origine de utils/privacyPolicy.js qui s'affiche. À mettre à jour dès qu'une fonctionnalité collecte, stocke ou
// envoie de nouvelles données (nouveau service tiers, nouvelle donnée de profil, nouveau mail…).
import React, { useEffect, useState } from 'react';
import './PrivacyPolicyContent.css';
import { loadPolicy, parseInline, parsePolicy } from '../utils/privacyPolicy';

const Inline = ({ text }) => parseInline(text).map((part, index) => {
    if (part.type === 'bold') return <strong key={index}>{part.text}</strong>;
    if (part.type === 'italic') return <em key={index}>{part.text}</em>;
    if (part.type === 'link') return <a key={index} href={part.href} target="_blank" rel="noopener noreferrer">{part.text}</a>;
    return <React.Fragment key={index}>{part.text}</React.Fragment>;
});

// Affichage d'un texte de politique (aussi utilisé par l'aperçu de l'éditeur admin).
export const PolicyView = ({ text, miseAJour }) => (
    <div className="privacy-policy-content">
        {miseAJour && <p><em>Dernière mise à jour : {miseAJour}</em></p>}
        {parsePolicy(text).map((block, index) => {
            if (block.type === 'h') return <h3 key={index}>{block.text}</h3>;
            if (block.type === 'ul') return <ul key={index}>{block.items.map((item, i) => <li key={i}><Inline text={item} /></li>)}</ul>;
            return <p key={index}><Inline text={block.text} /></p>;
        })}
    </div>
);

const PrivacyPolicyContent = () => {
    const [policy, setPolicy] = useState(null);

    useEffect(() => {
        let cancelled = false;
        loadPolicy().then((loaded) => { if (!cancelled) setPolicy(loaded); });
        return () => { cancelled = true; };
    }, []);

    if (!policy) return <div className="privacy-policy-content"><p>Chargement…</p></div>;
    return <PolicyView text={policy.texte} miseAJour={policy.miseAJour} />;
};

export default PrivacyPolicyContent;
