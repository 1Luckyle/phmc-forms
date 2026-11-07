// src/components/FormSections.js
//
// Sections repliables de TOUS les formulaires : un clic (ou Entrée / Espace) sur un titre de section (« .form-section-title ») replie ou déplie les champs
// qui le suivent, jusqu'au titre suivant. Une petite flèche à droite du titre indique l'état (voir App.css).
//
// Fonctionnement : le composant ne rend rien ; il travaille directement sur le DOM du <form> qui le contient (comme FieldGuide), sans toucher aux
// formulaires eux-mêmes. Il pose `data-fold-hidden` sur les éléments repliés et `data-folded` / `data-foldable` sur le titre. Un observateur
// réapplique l'état quand un formulaire se redessine ou qu'un bloc conditionnel apparaît. Aucune donnée n'est modifiée : replier ne vide pas les champs.
//
// Garde-fous :
//  • une section repliée qui contient un champ en erreur (validation à l'envoi) se rouvre toute seule, une fois ;
//  • une section repliée qui contient encore des champs obligatoires vides est signalée en rouge (data-pending).
import { useEffect, useRef } from 'react';

const TITLE = '.form-section-title';
const STOP = `${TITLE}, .section-toggle`;
const ERROR = '.is-invalid';
const REQUIRED_EMPTY = '[data-req-empty]';

// Éléments qui suivent le titre, jusqu'au prochain titre (ou à un conteneur qui en contient un).
const sectionMembers = (title) => {
    const members = [];
    for (let el = title.nextElementSibling; el; el = el.nextElementSibling) {
        if (el.matches(STOP) || el.querySelector(STOP)) break;
        members.push(el);
    }
    return members;
};

const FormSections = ({ version }) => {
    const anchor = useRef(null);

    useEffect(() => {
        const form = anchor.current && anchor.current.closest('form');
        if (!form) return undefined;

        const folded = new Set();      // clés des sections repliées
        const autoOpened = new Set();  // sections rouvertes à cause d'une erreur, tant que l'erreur dure
        let frame = null;

        const keyed = () => {
            const seen = {};
            return Array.from(form.querySelectorAll(TITLE)).map((title) => {
                const text = (title.textContent || '').trim();
                seen[text] = (seen[text] || 0) + 1;
                return { title, key: `${text}#${seen[text]}` };
            });
        };

        const apply = () => {
            frame = null;
            keyed().forEach(({ title, key }) => {
                const members = sectionMembers(title);
                const foldable = members.length > 0;
                const hasError = members.some((el) => el.matches(ERROR) || el.querySelector(ERROR));
                if (hasError && folded.has(key) && !autoOpened.has(key)) { folded.delete(key); autoOpened.add(key); }
                if (!hasError) autoOpened.delete(key);
                const isFolded = foldable && folded.has(key);

                if (foldable) {
                    title.setAttribute('data-foldable', 'true');
                    title.setAttribute('role', 'button');
                    title.setAttribute('tabindex', '0');
                    title.setAttribute('aria-expanded', String(!isFolded));
                } else {
                    title.removeAttribute('data-foldable');
                    title.removeAttribute('role');
                    title.removeAttribute('tabindex');
                    title.removeAttribute('aria-expanded');
                }
                if (isFolded) title.setAttribute('data-folded', 'true'); else title.removeAttribute('data-folded');

                const pending = isFolded && members.some((el) => el.matches(REQUIRED_EMPTY) || el.querySelector(REQUIRED_EMPTY));
                if (pending) title.setAttribute('data-pending', 'true'); else title.removeAttribute('data-pending');

                members.forEach((el) => {
                    if (isFolded) { if (!el.hasAttribute('data-fold-hidden')) el.setAttribute('data-fold-hidden', ''); }
                    else if (el.hasAttribute('data-fold-hidden')) el.removeAttribute('data-fold-hidden');
                });
            });
        };
        const schedule = () => { if (frame === null) frame = window.requestAnimationFrame(apply); };

        const toggle = (title) => {
            const entry = keyed().find((item) => item.title === title);
            if (!entry || !title.hasAttribute('data-foldable')) return;
            if (folded.has(entry.key)) folded.delete(entry.key); else folded.add(entry.key);
            apply();
        };

        const onClick = (event) => {
            const title = event.target.closest && event.target.closest(TITLE);
            if (title && form.contains(title)) toggle(title);
        };
        const onKeyDown = (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            const title = event.target.closest && event.target.closest(TITLE);
            if (!title || event.target !== title) return;
            event.preventDefault();
            toggle(title);
        };

        form.addEventListener('click', onClick);
        form.addEventListener('keydown', onKeyDown);
        const observer = new MutationObserver(schedule);
        observer.observe(form, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'data-req-empty'] });
        apply();

        return () => {
            form.removeEventListener('click', onClick);
            form.removeEventListener('keydown', onKeyDown);
            observer.disconnect();
            if (frame !== null) window.cancelAnimationFrame(frame);
            // On rend le formulaire tel qu'il était : plus rien de masqué.
            form.querySelectorAll('[data-fold-hidden]').forEach((el) => el.removeAttribute('data-fold-hidden'));
        };
    }, [version]);

    return <span ref={anchor} hidden data-no-tip />;
};

export default FormSections;
