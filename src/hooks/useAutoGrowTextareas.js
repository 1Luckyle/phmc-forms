// src/hooks/useAutoGrowTextareas.js
import { useEffect, useLayoutEffect } from 'react';

const FORM_TEXTAREA_SELECTOR = '.form-container form textarea';

const grow = (el) => {
    if (!el || el.tagName !== 'TEXTAREA') return;
    // Remet la hauteur à celle de `rows` avant de mesurer, sinon la zone ne
    // pourrait jamais rétrécir quand on supprime du texte.
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + 2}px`;
};

const growAll = () => {
    document.querySelectorAll(FORM_TEXTAREA_SELECTOR).forEach(grow);
};

/**
 * Fait grandir automatiquement toutes les zones de texte du formulaire pour
 * que tout le texte soit visible sans défiler dans la case.
 *
 * Fonctionne sans modifier chaque formulaire : un écouteur global gère la
 * saisie, un MutationObserver gère les champs affichés conditionnellement, et
 * `deps` (typiquement formData) redimensionne après un chargement de rapport,
 * un autofill ou un changement de formulaire.
 */
const useAutoGrowTextareas = (deps = []) => {
    useEffect(() => {
        const onInput = (e) => {
            if (e.target && e.target.matches && e.target.matches(FORM_TEXTAREA_SELECTOR)) {
                grow(e.target);
            }
        };

        let frame = null;
        const scheduleGrowAll = () => {
            if (frame) cancelAnimationFrame(frame);
            frame = requestAnimationFrame(growAll);
        };

        document.addEventListener('input', onInput);
        window.addEventListener('resize', scheduleGrowAll);

        const formEl = document.querySelector('.form-container form');
        const observer = formEl ? new MutationObserver(scheduleGrowAll) : null;
        if (observer) observer.observe(formEl, { childList: true, subtree: true });

        return () => {
            document.removeEventListener('input', onInput);
            window.removeEventListener('resize', scheduleGrowAll);
            if (observer) observer.disconnect();
            if (frame) cancelAnimationFrame(frame);
        };
    }, []);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useLayoutEffect(growAll, deps);
};

export default useAutoGrowTextareas;
