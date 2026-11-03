// src/components/FieldGuide.js
//
// Moteur des infobulles et des marques « à remplir » de TOUS les champs du site, monté une seule fois (App.js), sans rien à écrire dans chaque formulaire :
//   • au survol (ou au clavier) d'un champ, une infobulle dit exactement ce qu'il faut renseigner et si le champ est obligatoire ;
//   • dans un formulaire de rapport (zone `data-form-zone="{version}"`, voir MainApp), un champ OBLIGATOIRE encore vide est entouré de rouge,
//     d'après les règles du back-office (utils/formRulesCore.js) : plus de rouge posé à la main champ par champ.
// Les textes viennent de constants/fieldInfo.js (champs des formulaires) ; ailleurs, l'infobulle reprend le libellé ou l'indication du champ.
// Ajouter `data-no-tip` sur un champ (ou un de ses parents) supprime son infobulle.
import { useEffect } from 'react';
import { VERSION_FIELDS } from '../constants/formFieldCatalog';
import { getFieldInfo } from '../constants/fieldInfo';
import { isFieldRequired, lockedReasonOf, requiredFieldsOf, subscribeFormOverrides } from '../utils/formRulesCore';
import { startFormRulesSync } from '../utils/formRules';
import './FieldGuide.css';

const SKIP_TYPES = new Set(['hidden', 'button', 'submit', 'reset', 'file', 'range', 'color', 'image', 'checkbox', 'radio', 'search']);
const REASONS = { title: 'Compose le titre du rapport.', billing: 'Sert à la facturation du dossier.' };

// Champ saisissable survolé → { field (élément avec name/valeur), anchor (élément à entourer), name, type } ou null.
const resolveField = (target) => {
    if (!(target instanceof Element)) return null;
    const control = target.closest('input, textarea, select');
    if (control && !SKIP_TYPES.has(control.type)) {
        // Zone de saisie interne d'une liste déroulante (react-select) : le nom est porté par son champ caché.
        const container = control.closest('[class*="-container"]');
        const hidden = container ? container.querySelector('input[type="hidden"][name]') : null;
        if (hidden && !control.name) return { field: hidden, anchor: container.querySelector('[class*="-control"]') || container, name: hidden.name, type: 'select' };
        return { field: control, anchor: control, name: control.name || '', type: control.tagName === 'SELECT' ? 'select' : (control.tagName === 'TEXTAREA' ? 'textarea' : control.type) };
    }
    const selectControl = target.closest('[class*="-control"]');
    if (selectControl) {
        const container = selectControl.closest('[class*="-container"]');
        const hidden = container ? container.querySelector('input[type="hidden"][name]') : null;
        if (hidden) return { field: hidden, anchor: selectControl, name: hidden.name, type: 'select' };
    }
    return null;
};

const labelOf = (field, anchor) => {
    if (field.id) {
        const explicit = document.querySelector(`label[for="${CSS.escape(field.id)}"]`);
        if (explicit && explicit.textContent.trim()) return explicit.textContent.trim();
    }
    const group = anchor.closest('.form-group, .mb-1, .mb-2, .mb-3, .row, [class*="Group"]');
    const near = group ? group.querySelector('label') : null;
    if (near && near.textContent.trim()) return near.textContent.trim().replace(/\s+/g, ' ');
    return field.getAttribute('aria-label') || field.placeholder || '';
};

// Contenu de l'infobulle : { text, requirement: 'required' | 'optional' | '', reason }.
const describe = ({ field, anchor, name, type }) => {
    const zone = field.closest('[data-form-zone]');
    if (zone) {
        const version = Number(zone.getAttribute('data-form-zone'));
        const knownType = VERSION_FIELDS[version]?.[name];
        if (name && (knownType || version)) {
            const info = getFieldInfo(version, name, knownType || type);
            const required = isFieldRequired(version, name);
            // Candidatures : les autres champs sont exigés selon le poste, on n'affirme « facultatif » que pour un formulaire de rapport.
            const requirement = required ? 'required' : (version < 50 && knownType ? 'optional' : '');
            return { text: info.help, requirement, reason: REASONS[lockedReasonOf(version, name)] || '' };
        }
    }
    const label = labelOf(field, anchor).replace(/[:*]+\s*$/, '').trim();
    if (!label) return null;
    const mandatory = field.required || field.getAttribute('aria-required') === 'true';
    return { text: `À renseigner : ${label}.`, requirement: mandatory ? 'required' : '', reason: '' };
};

const FieldGuide = () => {
    useEffect(() => {
        startFormRulesSync();
        const tip = document.createElement('div');
        tip.className = 'phmc-fieldtip';
        tip.setAttribute('role', 'tooltip');
        tip.innerHTML = '<div class="phmc-fieldtip-text"></div><div class="phmc-fieldtip-req"></div>';
        document.body.appendChild(tip);
        const textEl = tip.firstChild;
        const reqEl = tip.lastChild;
        let showTimer = null;
        let currentAnchor = null;

        const hide = () => { clearTimeout(showTimer); showTimer = null; currentAnchor = null; tip.classList.remove('on'); };
        const show = (resolved) => {
            if (!resolved.anchor.isConnected) return;
            const info = describe(resolved);
            if (!info || !info.text) return;
            textEl.textContent = info.text;
            reqEl.className = `phmc-fieldtip-req ${info.requirement}`;
            reqEl.textContent = info.requirement === 'required' ? `Obligatoire${info.reason ? ` · ${info.reason}` : ''}` : (info.requirement === 'optional' ? 'Facultatif' : '');
            tip.classList.add('on');
            const rect = resolved.anchor.getBoundingClientRect();
            const tipRect = tip.getBoundingClientRect();
            const margin = 8;
            let left = rect.left + rect.width / 2 - tipRect.width / 2;
            left = Math.max(margin, Math.min(left, window.innerWidth - tipRect.width - margin));
            let top = rect.top - tipRect.height - 10;
            const below = top < margin;
            if (below) top = rect.bottom + 10;
            tip.classList.toggle('below', below);
            tip.style.left = `${left}px`;
            tip.style.top = `${top}px`;
            tip.style.setProperty('--arrow-x', `${Math.max(14, Math.min(rect.left + rect.width / 2 - left, tipRect.width - 14))}px`);
            currentAnchor = resolved.anchor;
        };
        const schedule = (target) => {
            const resolved = resolveField(target);
            if (!resolved || resolved.field.closest('[data-no-tip]') || resolved.anchor === currentAnchor) return;
            if (resolved.field.getAttribute('title')) return;
            clearTimeout(showTimer);
            showTimer = setTimeout(() => show(resolved), 150);
        };
        const onOver = (event) => schedule(event.target);
        const onOut = (event) => { if (!event.relatedTarget || !currentAnchor || !currentAnchor.contains(event.relatedTarget)) hide(); };
        const onFocus = (event) => schedule(event.target);
        const onKey = (event) => { if (event.key === 'Escape') hide(); };

        // ── Marques rouges des champs obligatoires encore vides (dans les zones de formulaire) ──
        let raf = 0;
        const refreshMarks = () => {
            raf = 0;
            document.querySelectorAll('[data-form-zone]').forEach((zone) => {
                const version = Number(zone.getAttribute('data-form-zone'));
                const required = new Set(requiredFieldsOf(version));
                const groups = new Map();
                zone.querySelectorAll('input[name], textarea[name], select[name]').forEach((field) => {
                    if (!required.has(field.name) || (SKIP_TYPES.has(field.type) && field.type !== 'hidden')) return;
                    const entry = groups.get(field.name) || { fields: [], filled: false };
                    entry.fields.push(field);
                    if (String(field.value || '').trim() !== '') entry.filled = true;
                    groups.set(field.name, entry);
                });
                const marked = new Set();
                groups.forEach((entry) => {
                    if (entry.filled) return;
                    entry.fields.forEach((field) => {
                        let target = field;
                        if (field.type === 'hidden') {
                            const container = field.closest('[class*="-container"]');
                            target = container ? (container.querySelector('[class*="-control"]') || container) : null;
                        }
                        if (target) marked.add(target);
                    });
                });
                zone.querySelectorAll('[data-req-empty]').forEach((el) => { if (!marked.has(el)) el.removeAttribute('data-req-empty'); });
                marked.forEach((el) => { if (el.getAttribute('data-req-empty') !== '1') el.setAttribute('data-req-empty', '1'); });
            });
        };
        const scheduleMarks = () => { if (!raf) raf = requestAnimationFrame(refreshMarks); };

        document.addEventListener('mouseover', onOver);
        document.addEventListener('mouseout', onOut);
        document.addEventListener('focusin', onFocus);
        document.addEventListener('focusout', hide);
        document.addEventListener('keydown', onKey);
        document.addEventListener('input', scheduleMarks, true);
        document.addEventListener('change', scheduleMarks, true);
        window.addEventListener('scroll', hide, true);
        const observer = new MutationObserver(scheduleMarks);
        observer.observe(document.body, { childList: true, subtree: true });
        const unsubscribe = subscribeFormOverrides(scheduleMarks);
        const poll = setInterval(() => { if (!document.hidden && document.querySelector('[data-form-zone]')) scheduleMarks(); }, 1000);
        scheduleMarks();

        return () => {
            hide();
            document.removeEventListener('mouseover', onOver);
            document.removeEventListener('mouseout', onOut);
            document.removeEventListener('focusin', onFocus);
            document.removeEventListener('focusout', hide);
            document.removeEventListener('keydown', onKey);
            document.removeEventListener('input', scheduleMarks, true);
            document.removeEventListener('change', scheduleMarks, true);
            window.removeEventListener('scroll', hide, true);
            observer.disconnect();
            unsubscribe();
            clearInterval(poll);
            if (raf) cancelAnimationFrame(raf);
            tip.remove();
        };
    }, []);
    return null;
};

export default FieldGuide;
