// src/components/FieldGuide.js
//
// Moteur des infobulles et des marques « à remplir » de TOUS les champs du site, monté une seule fois (App.js), sans rien à écrire dans chaque formulaire :
//   • au survol (ou au clavier) d'un champ, une infobulle dit exactement ce qu'il faut renseigner et si le champ est obligatoire ;
//   • dans un formulaire de rapport (zone `data-form-zone="{version}"`, voir MainApp), deux codes couleur sur les champs encore vides, d'après les règles
//     du back-office (utils/formRulesCore.js) : ROUGE (data-req-empty) = obligatoire à remplir ; BLEU (data-opt-empty) = facultatif pas encore rempli, pour voir
//     d'un coup d'œil ce qu'il reste à compléter sans le confondre avec une erreur. Plus de rouge posé à la main champ par champ.
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
// Fenêtres traitées comme des zones « automatiques » (couleurs obligatoire / facultatif sans balisage).
const AUTO_ZONE_SELECTOR = '.modal-container, .modal-content, .agency-selector-modal, .guide-modal';

// Conteneur d'une liste react-select (classe « css-xxxx-container »), ou null : « modal-container » ou « -container » en général ne suffisent pas.
const selectContainerOf = (el) => {
    let node = el.parentElement;
    while (node && node !== document.body) {
        const cls = typeof node.className === 'string' ? node.className : '';
        if (/(^|\s)css-[\w-]+-container(\s|$)/.test(cls)) return node;
        node = node.parentElement;
    }
    return null;
};

// Le champ a-t-il une VRAIE étiquette (label associé ou du même groupe) ? Un simple placeholder n'en est pas une.
const hasLabel = (field, anchor) => {
    if (field.id) {
        const explicit = document.querySelector(`label[for="${CSS.escape(field.id)}"]`);
        if (explicit && explicit.textContent.trim()) return true;
    }
    const group = anchor.closest('.form-group, .mb-1, .mb-2, .mb-3, .row, [class*="Group"]');
    const near = group ? group.querySelector('label') : null;
    return !!(near && near.textContent.trim());
};

const describe = ({ field, anchor, name, type }) => {
    // Champ d'identité verrouillé (tiré du profil, voir ForMyselfBanner) : l'infobulle dit comment le modifier.
    if (field.getAttribute('data-self-locked') === '1') {
        const host = field.closest('[data-self-lock-hint]');
        return { text: (host && host.getAttribute('data-self-lock-hint')) || 'Information tirée de votre profil : elle ne se modifie pas ici.', requirement: '', reason: '' };
    }
    const zone = field.closest('[data-form-zone]');
    if (zone) {
        const version = Number(zone.getAttribute('data-form-zone'));
        // Champs à choix par défaut (voir PresetTextField) : la zone de texte libre `xxxFree` a la même aide que le champ `xxx`.
        const baseName = name && !VERSION_FIELDS[version]?.[name] && VERSION_FIELDS[version]?.[name.replace(/(Free|Presets)$/, '')] ? name.replace(/(Free|Presets)$/, '') : name;
        const knownType = VERSION_FIELDS[version]?.[baseName];
        if (baseName && (knownType || version)) {
            const info = getFieldInfo(version, baseName, knownType || type);
            const required = isFieldRequired(version, baseName);
            // Candidatures : les autres champs sont exigés selon le poste, on n'affirme « facultatif » que pour un formulaire de rapport.
            const requirement = required ? 'required' : (version < 50 && knownType ? 'optional' : '');
            return { text: info.help, requirement, reason: REASONS[lockedReasonOf(version, baseName)] || '' };
        }
    }
    // Fenêtres hors formulaires de rapport (fiche, signalement, demande…) : une zone `data-guide-zone` donne les deux codes couleur et l'infobulle ;
    // `data-guide="texte"` sur un champ remplace l'indication par défaut (« À renseigner : libellé »).
    const customHost = field.closest('[data-guide]') || (anchor && anchor.closest ? anchor.closest('[data-guide]') : null);
    const custom = customHost ? customHost.getAttribute('data-guide') : '';
    const inGuideZone = !field.closest('[data-no-mark]') && (!!field.closest('[data-guide-zone]') || (!!field.closest(AUTO_ZONE_SELECTOR) && hasLabel(field, anchor || field)));
    const label = labelOf(field, anchor).replace(/[:*]+\s*$/, '').trim();
    if (!label && !custom) return null;
    // `data-required` sur un conteneur : rend obligatoires les champs qu'il contient (listes react-select, dont le champ caché n'a pas `required`).
    const mandatory = field.required || field.getAttribute('aria-required') === 'true' || !!field.closest('[data-required]');
    return { text: custom || `À renseigner : ${label}.`, requirement: mandatory ? 'required' : (inGuideZone ? 'optional' : ''), reason: '' };
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

                // Champs FACULTATIFS encore vides (formulaires de rapport seulement : dans une candidature, l'exigence dépend du poste). Seuls les champs du
                // catalogue sont concernés ; ceux en lecture seule ou déjà marqués en rouge sont ignorés.
                const known = version < 50 ? VERSION_FIELDS[version] : null;
                const optionalMarked = new Set();
                if (known) {
                    const optionalGroups = new Map();
                    zone.querySelectorAll('input[name], textarea[name], select[name]').forEach((field) => {
                        if (!known[field.name] || required.has(field.name) || (SKIP_TYPES.has(field.type) && field.type !== 'hidden') || field.readOnly || field.disabled) return;
                        const entry = optionalGroups.get(field.name) || { fields: [], filled: false };
                        entry.fields.push(field);
                        if (String(field.value || '').trim() !== '') entry.filled = true;
                        optionalGroups.set(field.name, entry);
                    });
                    optionalGroups.forEach((entry) => {
                        if (entry.filled) return;
                        entry.fields.forEach((field) => {
                            let target = field;
                            if (field.type === 'hidden') {
                                const container = field.closest('[class*="-container"]');
                                target = container ? (container.querySelector('[class*="-control"]') || container) : null;
                            }
                            if (target && !marked.has(target)) optionalMarked.add(target);
                        });
                    });
                }
                zone.querySelectorAll('[data-opt-empty]').forEach((el) => { if (!optionalMarked.has(el)) el.removeAttribute('data-opt-empty'); });
                optionalMarked.forEach((el) => { if (el.getAttribute('data-opt-empty') !== '1') el.setAttribute('data-opt-empty', '1'); });
            });
        };
        // ── Zones balisées `data-guide-zone` (fenêtres autres que les formulaires de rapport) ──
        // ROUGE = champ `required` encore vide ; BLEU = champ facultatif encore vide. Un champ rempli, en lecture seule, désactivé, ou placé dans
        // `data-no-mark` (barres de recherche, filtres…) n'est jamais marqué. Les listes déroulantes (react-select) doivent porter un `name`.
        const refreshGuideZones = () => {
            const marked = new Set();
            const explicit = Array.from(document.querySelectorAll('[data-guide-zone]'));
            // Toute fenêtre est une zone « automatique » : mêmes couleurs partout, sans balisage. Dans celle-ci seuls les champs ÉTIQUETÉS sont marqués
            // (une barre de recherche ou un filtre n'a pas d'étiquette) ; une zone balisée marque tous ses champs.
            const auto = Array.from(document.querySelectorAll(AUTO_ZONE_SELECTOR)).filter((zone) => !zone.closest('[data-guide-zone]') && !zone.closest('[data-form-zone]'));
            const zones = [...explicit.map((zone) => ({ zone, auto: false })), ...auto.map((zone) => ({ zone, auto: true }))];
            zones.forEach(({ zone, auto: isAuto }) => {
                const groups = new Map();
                const handledSelects = new Set();
                let anonymous = 0;
                const add = (key, target, filled, required) => {
                    const entry = groups.get(key) || { targets: [], filled: false, required: false };
                    entry.targets.push(target);
                    if (filled) entry.filled = true;
                    if (required) entry.required = true;
                    groups.set(key, entry);
                };
                zone.querySelectorAll('input, textarea, select').forEach((field) => {
                    if (field.closest('[data-no-mark]')) return;
                    if (isAuto && (field.closest('[data-guide-zone]') || field.closest('[data-form-zone]') || field.closest('table') || field.closest('.dropdown-menu'))) return;
                    // Liste déroulante react-select : un seul repère par liste (sa zone de saisie interne n'est pas le champ).
                    const container = selectContainerOf(field);
                    if (container) {
                        if (handledSelects.has(container)) return;
                        handledSelects.add(container);
                        const control = container.querySelector('[class*="-control"]');
                        if (!control || /--is-disabled/.test(control.className)) return;
                        if (isAuto && !hasLabel(field, container)) return;
                        const hidden = container.querySelector('input[type="hidden"]');
                        const filled = !!container.querySelector('[class*="-singleValue"], [class*="-multiValue"]') || !!(hidden && String(hidden.value || '').trim() !== '');
                        add(hidden && hidden.name ? `select:${hidden.name}` : `__anonyme${anonymous++}`, control, filled, !!container.closest('[data-required]') || !!(hidden && hidden.required));
                        return;
                    }
                    if ((SKIP_TYPES.has(field.type) && field.type !== 'hidden') || field.type === 'hidden' || field.readOnly || field.disabled) return;
                    if (isAuto && !hasLabel(field, field)) return;
                    add(field.name || `__anonyme${anonymous++}`, field, String(field.value || '').trim() !== '',
                        field.required || field.getAttribute('aria-required') === 'true' || !!field.closest('[data-required]'));
                });
                const red = new Set();
                const blue = new Set();
                groups.forEach((entry) => {
                    if (entry.filled) return;
                    entry.targets.forEach((target) => (entry.required ? red : blue).add(target));
                });
                // Nettoyage : seulement ce qui appartient à CETTE zone (pas aux zones balisées qu'elle contient).
                const owns = (el) => !isAuto || (!el.closest('[data-guide-zone]') && !el.closest('[data-form-zone]'));
                zone.querySelectorAll('[data-req-empty]').forEach((el) => { if (owns(el) && !red.has(el)) el.removeAttribute('data-req-empty'); });
                zone.querySelectorAll('[data-opt-empty]').forEach((el) => { if (owns(el) && !blue.has(el)) el.removeAttribute('data-opt-empty'); });
                red.forEach((el) => { marked.add(el); if (el.getAttribute('data-req-empty') !== '1') el.setAttribute('data-req-empty', '1'); });
                blue.forEach((el) => { marked.add(el); if (el.getAttribute('data-opt-empty') !== '1') el.setAttribute('data-opt-empty', '1'); });
            });
        };
        // ── Champs d'identité verrouillés (`data-self-lock="champ1,champ2"` posé sur le formulaire par ForMyselfBanner) ──
        // Texte : lecture seule ; listes et cases : désactivées. Le verrou est retiré dès que l'attribut disparaît.
        const refreshSelfLocks = () => {
            document.querySelectorAll('[data-form-zone]').forEach((zone) => {
                const names = new Set((zone.getAttribute('data-self-lock') || '').split(',').filter(Boolean));
                zone.querySelectorAll('input, select, textarea').forEach((field) => {
                    const shouldLock = !!field.name && names.has(field.name);
                    const locked = field.getAttribute('data-self-locked') === '1';
                    const needsDisable = field.tagName === 'SELECT' || field.type === 'radio' || field.type === 'checkbox';
                    if (shouldLock && !locked) {
                        field.setAttribute('data-self-locked', '1');
                        if (needsDisable) { field.setAttribute('data-self-disabled', '1'); field.disabled = true; } else field.readOnly = true;
                    } else if (!shouldLock && locked) {
                        field.removeAttribute('data-self-locked');
                        if (field.hasAttribute('data-self-disabled')) { field.removeAttribute('data-self-disabled'); field.disabled = false; } else field.readOnly = false;
                    }
                });
            });
        };
        const scheduleMarks = () => { if (!raf) raf = requestAnimationFrame(() => { refreshSelfLocks(); refreshMarks(); refreshGuideZones(); }); };

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
        const poll = setInterval(() => { if (!document.hidden && (document.querySelector('[data-form-zone]') || document.querySelector('[data-guide-zone]'))) scheduleMarks(); }, 1000);
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
