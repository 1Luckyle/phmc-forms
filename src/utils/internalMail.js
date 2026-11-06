// src/utils/internalMail.js
//
// Messagerie interne du personnel (formulaire « PHMC Email Interne » devenu une vraie messagerie dans le site).
//
// Stockage (Firebase Realtime Database) :
//   messagesInternes/{id}   le message, IMMUABLE : { deUid, deNom, objet, corps (BBCode), creeLe, dest:{uid:nom}, acces:{uid:true}, fil, reponseA? }
//                           lisible par l'expéditeur et les destinataires (acces) ; seuls ces comptes peuvent retirer LEUR accès (= supprimer leur copie) ;
//                           quand le dernier accès est retiré, le message disparaît. Les admins le lisent seulement si l'interrupteur debug
//                           adminSettings/debugMessagerieAdmin est activé.
//   messagerie/{uid}/{id}   l'entrée de la boîte de chaque personne : { role:'recu'|'envoye', lu, le, objet, de, apercu, fil, nb }
//                           (les infos d'aperçu sont recopiées pour lister une boîte sans relire tous les messages).
//
// Règles de fond (appliquées aussi par database.rules.json, pas seulement ici) :
//   • on ne crée un message qu'en SON nom (deUid = soi) et il est réservé au personnel ;
//   • un message ne se modifie jamais après envoi ;
//   • le corps est du BBCode (le site sait en faire l'aperçu, le PDF, l'image PNG, le HTML) mais l'éditeur est visuel : le BBCode n'est montré
//     que si l'accès BBCode est activé sur le site.
import { ref, push, set, get, update, onValue, query, limitToLast } from 'firebase/database';
import { database, auth } from '../firebase';
import { loadStaffMembers } from './staffAdmin';
import { notifyUser } from './notifications';

export const MAIL_LIMITS = { subject: 160, body: 20000, recipients: 30, preview: 200, name: 120 };
export const MAILBOX_PAGE = 200;

const clean = (value, max) => String(value ?? '').trim().slice(0, max);

// ───────────── Éditeur visuel -> BBCode ─────────────

// Un « [mot] » du texte saisi ne doit pas devenir une balise BBCode : on remplace ces crochets par des crochets pleine largeur.
const escapeBbText = (text) => String(text || '').replace(/\[(\/?[a-z*][^\]\n]{0,60})\]/gi, '［$1］');

const FONT_SIZE_PERCENT = { 1: 70, 2: 85, 3: 100, 4: 115, 5: 150, 6: 200, 7: 300 };
const safeUrl = (url) => (/^https?:\/\//i.test(String(url || '').trim()) ? String(url).trim() : '');
const normalizeColorValue = (value) => {
    const v = String(value || '').trim().toLowerCase();
    if (/^#[0-9a-f]{6}$/.test(v) || /^#[0-9a-f]{3}$/.test(v)) return v;
    const rgb = v.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (rgb) return `#${[rgb[1], rgb[2], rgb[3]].map((n) => Math.min(255, Number(n)).toString(16).padStart(2, '0')).join('')}`;
    return '';
};

const BLOCK_TAGS = new Set(['DIV', 'P', 'LI', 'UL', 'OL', 'BLOCKQUOTE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HR', 'TABLE', 'TR']);

// Convertit le contenu d'un élément contentEditable en BBCode (balises prises en charge par utils/bbcodeToHtml.js uniquement).
export const htmlToBbcode = (root) => {
    const walk = (node) => {
        if (node.nodeType === 3) return escapeBbText(node.nodeValue.replace(/ /g, ' '));
        if (node.nodeType !== 1) return '';
        const tag = node.tagName;
        const inner = () => Array.from(node.childNodes).map(walk).join('');
        switch (tag) {
            case 'BR': return '\n';
            case 'B': case 'STRONG': { const t = inner(); return t ? `[b]${t}[/b]` : ''; }
            case 'I': case 'EM': { const t = inner(); return t ? `[i]${t}[/i]` : ''; }
            case 'U': { const t = inner(); return t ? `[u]${t}[/u]` : ''; }
            case 'S': case 'STRIKE': case 'DEL': { const t = inner(); return t ? `[s]${t}[/s]` : ''; }
            case 'FONT': {
                let t = inner();
                if (!t) return '';
                const color = normalizeColorValue(node.getAttribute('color'));
                const size = FONT_SIZE_PERCENT[node.getAttribute('size')];
                if (size && size !== 100) t = `[size=${size}]${t}[/size]`;
                if (color) t = `[color=${color}]${t}[/color]`;
                return t;
            }
            case 'SPAN': {
                let t = inner();
                if (!t) return '';
                const style = node.style || {};
                const color = normalizeColorValue(style.color);
                if (color) t = `[color=${color}]${t}[/color]`;
                if (/bold|[6-9]00/.test(style.fontWeight || '')) t = `[b]${t}[/b]`;
                if ((style.fontStyle || '') === 'italic') t = `[i]${t}[/i]`;
                if (/underline/.test(style.textDecoration || style.textDecorationLine || '')) t = `[u]${t}[/u]`;
                return t;
            }
            case 'A': {
                const t = inner();
                const url = safeUrl(node.getAttribute('href'));
                return url ? `[url=${url}]${t || url}[/url]` : t;
            }
            case 'IMG': {
                const url = safeUrl(node.getAttribute('src'));
                return url ? `[img]${url}[/img]` : '';
            }
            case 'HR': return '\n[hr][/hr]\n';
            case 'UL': case 'OL': {
                const items = Array.from(node.children).filter((child) => child.tagName === 'LI')
                    .map((li) => `[*]${Array.from(li.childNodes).map(walk).join('').trim()}`).join('\n');
                return `\n[list${tag === 'OL' ? '=1' : ''}]\n${items}\n[/list]\n`;
            }
            case 'BLOCKQUOTE': return `\n[quote]${inner().trim()}[/quote]\n`;
            case 'H1': case 'H2': case 'H3': case 'H4': case 'H5': case 'H6': return `\n[b][size=130]${inner().trim()}[/size][/b]\n`;
            default: {
                const t = inner();
                // Un bloc (div, p…) commence et finit sur sa propre ligne ; le saut final d'un bloc terminé par <br> n'est pas doublé.
                if (BLOCK_TAGS.has(tag)) return `\n${t.replace(/\n$/, '')}\n`;
                return t;
            }
        }
    };
    return Array.from(root.childNodes).map(walk).join('').replace(/\n{3,}/g, '\n\n').replace(/^\n+|\n+$/g, '').trim();
};

// Texte brut d'un BBCode (aperçu de la liste, « Copier le texte »).
export const bbcodeToPlainText = (bbcode) => String(bbcode || '')
    .replace(/\[\*\]/g, '• ')
    // Les images deviennent « [image] » APRÈS le retrait des balises (sinon ce marqueur serait pris pour une balise et effacé).
    .replace(/\[(?:img)\][^[]*\[\/img\]/gi, 'image')
    .replace(/\[url=([^\]]*)\]([^[]*)\[\/url\]/gi, '$2 ($1)')
    .replace(/\[\/?[a-z*][^\]]*\]/gi, '')
    .replace(/image/g, '[image]')
    .replace(/［/g, '[').replace(/］/g, ']')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const formatDateFr = (ms) => {
    const date = new Date(Number(ms) || Date.now());
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} à ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
export { formatDateFr };

// Document complet d'un message (en-tête + corps) : il sert à l'aperçu, au PDF, à l'image PNG et au HTML.
export const messageToBbcode = (message, { fromName } = {}) => {
    const dest = Object.values(message?.dest || {}).join(', ');
    return `[size=130][b]${escapeBbText(message?.objet || '(sans objet)')}[/b][/size]
[b]De :[/b] ${escapeBbText(fromName || message?.deNom || 'Inconnu')}
[b]À :[/b] ${escapeBbText(dest || '—')}
[b]Le :[/b] ${formatDateFr(message?.creeLe)}
[hr][/hr]
${message?.corps || ''}`;
};

// ───────────── Destinataires ─────────────

// Annuaire des comptes joignables : une fiche du personnel AVEC un compte (uid). Soi-même exclu.
export const loadMailDirectory = async () => {
    const members = await loadStaffMembers();
    const byUid = {};
    members.forEach((member) => {
        if (!member.uid) return;
        byUid[member.uid] = {
            uid: member.uid,
            name: member.displayName || member.name,
            rank: member.rank || member.category || '',
            families: member.families || [],
        };
    });
    return byUid;
};

// ───────────── Envoi ─────────────

export const validateMailDraft = ({ objet, corps, destinataires }) => {
    const problems = [];
    if (!clean(objet, MAIL_LIMITS.subject)) problems.push('Indiquez l\'objet du message.');
    if (!Array.isArray(destinataires) || destinataires.length === 0) problems.push('Choisissez au moins un destinataire.');
    else if (destinataires.length > MAIL_LIMITS.recipients) problems.push(`Au plus ${MAIL_LIMITS.recipients} destinataires.`);
    if (!String(corps || '').trim()) problems.push('Le message est vide.');
    else if (String(corps).length > MAIL_LIMITS.body) problems.push(`Message trop long (${MAIL_LIMITS.body} caractères au plus, mise en forme comprise).`);
    return problems;
};

// destinataires : [{ uid, nom }]. fromName : le nom affiché de l'expéditeur (soi). Retourne l'id du message.
export const sendInternalMail = async ({ objet, corps, destinataires, fromName, reponseA = '', fil = '' }) => {
    const user = auth.currentUser;
    if (!user) throw new Error('Connectez-vous pour envoyer un message.');
    const unique = [];
    (destinataires || []).forEach((entry) => {
        if (entry && entry.uid && entry.uid !== user.uid && !unique.some((u) => u.uid === entry.uid)) unique.push(entry);
    });
    const problems = validateMailDraft({ objet, corps, destinataires: unique });
    if (problems.length) throw new Error(problems[0]);

    const id = push(ref(database, 'messagesInternes')).key;
    const le = Date.now();
    const subject = clean(objet, MAIL_LIMITS.subject);
    const senderName = clean(fromName || user.email, MAIL_LIMITS.name);
    const dest = {};
    unique.forEach((entry) => { dest[entry.uid] = clean(entry.nom, MAIL_LIMITS.name) || 'Destinataire'; });
    const acces = { [user.uid]: true };
    unique.forEach((entry) => { acces[entry.uid] = true; });
    const threadId = clean(fil, 60) || id;

    // 1) le message ; 2) la boîte de l'expéditeur ; 3) celles des destinataires (les règles exigent que le message existe déjà).
    await set(ref(database, `messagesInternes/${id}`), {
        deUid: user.uid, deNom: senderName, objet: subject, corps: String(corps), creeLe: le, dest, acces, fil: threadId,
        ...(reponseA ? { reponseA: clean(reponseA, 60) } : {}),
    });
    const base = { le, objet: subject, de: senderName, apercu: clean(bbcodeToPlainText(corps).replace(/\s+/g, ' '), MAIL_LIMITS.preview), fil: threadId };
    await set(ref(database, `messagerie/${user.uid}/${id}`), { ...base, role: 'envoye', lu: true, nb: unique.length });
    const failed = [];
    await Promise.all(unique.map((entry) => set(ref(database, `messagerie/${entry.uid}/${id}`), { ...base, role: 'recu', lu: false })
        .catch(() => failed.push(entry.nom || entry.uid))));
    // Notification (cloche) : au mieux, elle ne fait jamais échouer l'envoi.
    await Promise.all(unique.map((entry) => notifyUser(entry.uid, {
        type: 'message', titre: `Nouveau message de ${senderName}`, texte: subject, lien: { cible: 'messagerie', id },
    })));
    return { id, failed };
};

// ───────────── Lecture / état ─────────────

export const loadInternalMail = async (id) => {
    const snapshot = await get(ref(database, `messagesInternes/${id}`));
    return snapshot.exists() ? { id, ...snapshot.val() } : null;
};

export const setMailRead = (uid, id, read = true) => update(ref(database, `messagerie/${uid}/${id}`), { lu: !!read });

// Supprime SA copie : on retire sa boîte et son accès. Dès que plus personne n'a accès, le message est illisible pour tous et la tâche
// quotidienne du serveur (internalMailCleanup) l'efface définitivement (les règles ne permettent pas au dernier détenteur de le faire).
export const deleteMyMailCopy = async (uid, id) => {
    await update(ref(database), {
        [`messagerie/${uid}/${id}`]: null,
        [`messagesInternes/${id}/acces/${uid}`]: null,
    });
};

// Boîte de la personne, en direct : onData({ items: [{ id, role, lu, le, objet, de, apercu, fil, nb }], unread }), du plus récent au plus ancien.
export const subscribeMailbox = (uid, onData) => {
    if (!uid) { onData({ items: [], unread: 0 }); return () => {}; }
    return onValue(query(ref(database, `messagerie/${uid}`), limitToLast(MAILBOX_PAGE)), (snapshot) => {
        const value = snapshot.val() || {};
        const items = Object.entries(value).filter(([, entry]) => entry && entry.role)
            .map(([id, entry]) => ({ id, ...entry, le: Number(entry.le) || 0 }))
            .sort((a, b) => b.le - a.le);
        onData({ items, unread: items.filter((item) => item.role === 'recu' && !item.lu).length });
    }, () => onData({ items: [], unread: 0 }));
};

// Debug admin (interrupteur adminSettings/debugMessagerieAdmin) : tous les messages. Les règles refusent la lecture si l'interrupteur est coupé.
export const loadAllInternalMails = async () => {
    const snapshot = await get(ref(database, 'messagesInternes'));
    if (!snapshot.exists()) return [];
    return Object.entries(snapshot.val()).map(([id, message]) => ({ id, ...message })).sort((a, b) => (b.creeLe || 0) - (a.creeLe || 0));
};
