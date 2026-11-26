// src/components/Auth/DiscordAccountPanel.js
//
// Connexion / création de compte de la VERSION CLASSIQUE du site (sans GTA World), affichée par le guide de configuration à la place des
// écrans GTA World : étape Civil / Candidat (kind = 'civil') et étape Personnel PHMC / DMEC (kind = 'staff').
//   1. « Continuer avec Discord » : Discord ne sert qu'à prouver qui est le joueur (portée « identify » : ni adresse mail, ni rôle).
//   2. Les PERSONNAGES de ce compte Discord s'affichent (functions/discordCore.js) : se connecter à un compte existant, créer le compte
//      Civil d'un personnage (libre), ou demander un compte du personnel (validé par un admin). « Nouveau personnage » ajoute un nom.
//   3. Chaque personnage garde son ID patient pour toujours (même après la suppression de son compte) et reçoit une adresse fictive
//      prenom.nom@phmc.health, qui ne reçoit rien : les notifications passent par le site.
import React, { useEffect, useState } from 'react';
import { Button, Form } from 'react-bootstrap';
import Select from 'react-select';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '../../firebase';
import ZipCityField from '../ZipCityField';
import { clearDeletedMark } from '../../utils/deletedAccounts';
import { DOCTOR_RANKS, TITLE_PREFIXES } from '../../constants/ranks';
import {
    buildDiscordAuthUrl, postJson, DISCORD_URLS, readDiscordResult, clearDiscordResult, isDiscordResultFresh,
} from '../../utils/discordOAuth';

const box = { backgroundColor: '#1a1a1a', color: '#fff', border: '1px solid #444' };
const card = { display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', backgroundColor: '#2a2a2a', border: '1px solid #444', borderRadius: '8px', padding: '12px 14px', color: '#fff' };
const muted = { fontSize: '0.85em', color: '#ccc' };
const selectStyles = {
    control: (base) => ({ ...base, backgroundColor: '#1a1a1a', borderColor: '#444', color: '#fff' }),
    menu: (base) => ({ ...base, backgroundColor: '#2a2a2a', zIndex: 1051 }),
    option: (base, state) => ({ ...base, backgroundColor: state.isFocused ? '#1f2937' : '#2a2a2a', color: '#fff' }),
    singleValue: (base) => ({ ...base, color: '#fff' }),
    input: (base) => ({ ...base, color: '#fff' }),
    placeholder: (base) => ({ ...base, color: '#9aa7b4' }),
};
const ACCOUNT_LABEL = { civilian: 'Compte Civil', phmc: 'Personnel PHMC', coroner: 'Personnel DMEC' };
const CIVIL_REQUIRED = { dateOfBirth: 'date de naissance', gender: 'genre', address: 'adresse', zip: 'code postal', phone: 'téléphone' };
const emptyCivil = { middleName: '', dateOfBirth: '', gender: '', address: '', zip: '', phone: '', discord: '' };
const emptyStaff = { middleName: '', address: '', zip: '', discord: '', phNumber: '', rank: '', badge: '' };

const DiscordAccountPanel = ({
    kind = 'civil', userType = null, isCoroner = false, rankOptions = [], showNotification = () => {},
    onAuthenticated = () => {}, onStaffRequested = () => {},
}) => {
    const [session, setSession] = useState(null);
    const [screen, setScreen] = useState('start');
    const [target, setTarget] = useState(null); // { persoId } ou { nouveau: { firstName, lastName } }, et le nom affiché
    const [newName, setNewName] = useState({ firstName: '', lastName: '' });
    const [civil, setCivil] = useState(emptyCivil);
    const [staff, setStaff] = useState(emptyStaff);
    const [titlePrefix, setTitlePrefix] = useState('');
    const [busy, setBusy] = useState(false);
    const [created, setCreated] = useState(null);
    const [requested, setRequested] = useState(null);

    // Retour de Discord : le résultat de l'échange attend dans la session du navigateur.
    useEffect(() => {
        const result = readDiscordResult();
        if (!result) return;
        if (result.error) {
            clearDiscordResult();
            showNotification(`Connexion Discord : ${result.error}`, 'error');
            return;
        }
        if (isDiscordResultFresh(result)) {
            setSession(result);
            setScreen('list');
            setCivil((prev) => ({ ...prev, discord: prev.discord || result.discordUsername || '' }));
            setStaff((prev) => ({ ...prev, discord: prev.discord || result.discordUsername || '' }));
        } else {
            clearDiscordResult();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const startDiscord = () => {
        try {
            window.location.href = buildDiscordAuthUrl({ type: 'onboarding', userType });
        } catch (error) {
            showNotification(error.message || 'Impossible de démarrer la connexion avec Discord.', 'error');
        }
    };

    const expired = () => {
        clearDiscordResult();
        setSession(null);
        setScreen('start');
        showNotification('Votre session Discord a expiré : reconnectez-vous avec Discord.', 'warning');
    };
    const ensureFresh = () => {
        if (isDiscordResultFresh(session)) return true;
        expired();
        return false;
    };

    const login = async (character) => {
        setBusy(true);
        try {
            await signInWithCustomToken(auth, character.account.customToken);
            clearDiscordResult();
            showNotification('Connecté avec succès !', 'success');
            onAuthenticated();
        } catch (error) {
            console.error('Connexion Discord :', error);
            showNotification('Connexion impossible (lien expiré) : reconnectez-vous avec Discord.', 'error');
            expired();
        } finally {
            setBusy(false);
        }
    };

    const choose = (character, next) => {
        if (!ensureFresh()) return;
        setTarget({ persoId: character.id, label: `${character.firstName} ${character.lastName}`.trim(), patientID: character.patientID });
        setScreen(next);
    };

    const confirmNewCharacter = () => {
        const firstName = newName.firstName.trim();
        const lastName = newName.lastName.trim();
        if (!firstName || !lastName) { showNotification('Renseignez le prénom et le nom du personnage.', 'warning'); return; }
        if (!ensureFresh()) return;
        setTarget({ nouveau: { firstName, lastName }, label: `${firstName} ${lastName}` });
        setScreen(kind === 'staff' ? 'staffForm' : 'civilForm');
    };

    const characterPayload = () => (target.persoId ? { persoId: target.persoId } : { nouveau: target.nouveau });

    const missingCivil = Object.keys(CIVIL_REQUIRED).filter((field) => !String(civil[field] || '').trim());
    const createCivil = async () => {
        if (missingCivil.length) { showNotification(`Renseignez : ${missingCivil.map((field) => CIVIL_REQUIRED[field]).join(', ')}.`, 'warning'); return; }
        if (!ensureFresh()) return;
        setBusy(true);
        try {
            const data = await postJson(DISCORD_URLS.createCivil, { ticket: session.ticket, ...characterPayload(), profile: civil });
            await signInWithCustomToken(auth, data.customToken);
            await clearDeletedMark(data.patientID).catch(() => {});
            clearDiscordResult();
            setCreated(data);
            setScreen('created');
            showNotification('Compte Civil créé avec succès !', 'success');
        } catch (error) {
            if (error.status === 401) { expired(); return; }
            showNotification(error.message || 'Création du compte impossible.', 'error');
        } finally {
            setBusy(false);
        }
    };

    const selectedRank = rankOptions.find((rank) => rank.value === staff.rank);
    const badgePrefix = (selectedRank && selectedRank.badgePrefix) || (isCoroner ? 'CO' : 'MD');
    // Grade de médecin : titre « Dr. » / « Pr. » ajouté au prénom de la demande (comme TitlePrefixPicker du formulaire GTA World).
    const isDoctorRank = DOCTOR_RANKS.includes(staff.rank);
    const effectiveTitle = isDoctorRank ? titlePrefix : '';
    const requestStaff = async () => {
        const missing = [['discord', 'Discord'], ['phNumber', 'téléphone'], ['rank', 'fonction']].filter(([field]) => !String(staff[field] || '').trim()).map(([, label]) => label);
        if (!/^\d{4,5}$/.test(staff.badge)) missing.push('badge (4 ou 5 chiffres)');
        if (missing.length) { showNotification(`Renseignez : ${missing.join(', ')}.`, 'warning'); return; }
        if (!ensureFresh()) return;
        setBusy(true);
        try {
            const data = await postJson(DISCORD_URLS.requestStaff, {
                ticket: session.ticket, ...characterPayload(), isCoroner,
                ...(effectiveTitle ? { titlePrefix: effectiveTitle } : {}),
                request: { ...staff, badge: `${badgePrefix}-${staff.badge}` },
            });
            setRequested(data);
            setTarget((prev) => ({ ...prev, persoId: data.persoId, nouveau: undefined, patientID: data.patientID }));
            setScreen('requested');
            onStaffRequested(data);
            showNotification('Demande envoyée ! Un administrateur doit la valider.', 'info', 9000);
        } catch (error) {
            if (error.status === 401) { expired(); return; }
            showNotification(error.message || 'Envoi de la demande impossible.', 'error');
        } finally {
            setBusy(false);
        }
    };

    if (screen === 'start' || !session) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '15px' }}>
                <button type="button" onClick={startDiscord} style={{ ...card, border: '1px solid #5865F2', cursor: 'pointer', textAlign: 'left', padding: '15px' }}>
                    <i className="fab fa-discord" style={{ fontSize: '1.5rem', color: '#5865F2' }}></i>
                    <span>
                        <strong style={{ display: 'block' }}>Continuer avec Discord</strong>
                        <span style={muted}>
                            {kind === 'staff'
                                ? 'Connexion, ou demande de compte du personnel validée par un administrateur.'
                                : 'Connexion ou création de votre compte, selon votre personnage.'}
                            {' '}Discord sert seulement à vous reconnaître : aucune adresse mail n'est demandée.
                        </span>
                    </span>
                </button>
            </div>
        );
    }

    if (screen === 'created' && created) {
        return (
            <div>
                <div style={{ marginBottom: '15px', color: '#3fb950' }}><i className="fas fa-check-circle me-2"></i>Votre compte Civil a été créé.</div>
                <Form.Group className="mb-3">
                    <Form.Label>Votre ID patient</Form.Label>
                    <Form.Control type="text" value={created.patientID || ''} disabled style={box} />
                    <div style={{ ...muted, marginTop: 4 }}>Il vous sera demandé sur les formulaires médicaux et les candidatures. Il reste le vôtre, même si vous supprimez un jour votre compte.</div>
                </Form.Group>
                <Form.Group className="mb-3">
                    <Form.Label>Votre adresse</Form.Label>
                    <Form.Control type="text" value={created.email || ''} disabled style={box} />
                    <div style={{ ...muted, marginTop: 4 }}>Adresse fictive du PHMC : elle ne reçoit rien, vos notifications arrivent sur le site.</div>
                </Form.Group>
                <div className="d-flex justify-content-end"><Button variant="primary" onClick={onAuthenticated}>Continuer</Button></div>
            </div>
        );
    }

    if (screen === 'requested' && requested) {
        return (
            <div>
                <div style={{ marginBottom: '12px', color: '#3fb950' }}><i className="fas fa-check-circle me-2"></i>Demande envoyée pour <strong>{target?.label}</strong>.</div>
                <p style={muted}>
                    Un administrateur doit la valider ; il vous donnera votre grade et vos accès. Vous vous connecterez ensuite avec Discord.
                    {!requested.hasCivil && ' En attendant, un compte Civil vous donne déjà accès à vos dossiers : il deviendra votre compte du personnel à la validation.'}
                </p>
                {!requested.hasCivil && (
                    <div className="d-flex justify-content-end">
                        <Button variant="outline-primary" onClick={() => setScreen('civilForm')}>Créer mon compte Civil en attendant</Button>
                    </div>
                )}
            </div>
        );
    }

    if (screen === 'newCharacter') {
        return (
            <Form onSubmit={(event) => { event.preventDefault(); confirmNewCharacter(); }}>
                <p style={muted}>Le prénom et le nom de votre personnage : ils ne pourront plus être modifiés que par un administrateur.</p>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <Form.Control placeholder="Prénom *" value={newName.firstName} maxLength={40} onChange={(event) => setNewName((prev) => ({ ...prev, firstName: event.target.value }))} style={box} className="mb-3" />
                    <Form.Control placeholder="Nom *" value={newName.lastName} maxLength={40} onChange={(event) => setNewName((prev) => ({ ...prev, lastName: event.target.value }))} style={box} className="mb-3" />
                </div>
                <div className="d-flex gap-2 justify-content-end">
                    <Button variant="outline-secondary" onClick={() => setScreen('list')}>Retour</Button>
                    <Button variant="primary" type="submit">Continuer</Button>
                </div>
            </Form>
        );
    }

    if (screen === 'civilForm' && target) {
        const field = (name, label, props = {}) => (
            <Form.Group className="mb-3" style={{ flex: 1 }}>
                <Form.Label>{label}</Form.Label>
                <Form.Control name={name} value={civil[name]} onChange={(event) => setCivil((prev) => ({ ...prev, [name]: event.target.value }))} style={box} {...props} />
            </Form.Group>
        );
        return (
            <Form>
                <div style={{ marginBottom: '15px', color: '#5865F2' }}><i className="fab fa-discord me-2"></i>Compte Civil de <strong>{target.label}</strong>{target.patientID ? ` · ${target.patientID}` : ''}</div>
                {field('middleName', 'Deuxième prénom')}
                <div style={{ display: 'flex', gap: '10px' }}>
                    {field('dateOfBirth', 'Date de naissance', { type: 'date' })}
                    <Form.Group className="mb-3" style={{ flex: 1 }}>
                        <Form.Label>Genre à l'état civil</Form.Label>
                        <Form.Select value={civil.gender} onChange={(event) => setCivil((prev) => ({ ...prev, gender: event.target.value }))} style={box}>
                            <option value="" disabled>Sélectionner…</option>
                            <option value="Male">Homme</option>
                            <option value="Female">Femme</option>
                            <option value="Other">Autre</option>
                        </Form.Select>
                    </Form.Group>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <div style={{ flex: 2 }}>{field('address', 'Adresse')}</div>
                    <Form.Group className="mb-3" style={{ flex: 1 }}>
                        <Form.Label>Ville / code postal</Form.Label>
                        <ZipCityField zip={civil.zip} onZipChange={(zip) => setCivil((prev) => ({ ...prev, zip }))} style={box} placeholder="" />
                    </Form.Group>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    {field('phone', 'Téléphone')}
                    {field('discord', 'Discord')}
                </div>
                {missingCivil.length > 0 && <div style={{ ...muted, marginBottom: 12 }}>Il reste à renseigner : {missingCivil.map((name) => CIVIL_REQUIRED[name]).join(', ')}.</div>}
                <div className="d-flex gap-2 justify-content-end">
                    <Button variant="outline-secondary" onClick={() => setScreen(requested ? 'requested' : 'list')} disabled={busy}>Retour</Button>
                    <Button variant="primary" onClick={createCivil} disabled={busy}>{busy ? 'Création…' : 'Créer mon compte'}</Button>
                </div>
            </Form>
        );
    }

    if (screen === 'staffForm' && target) {
        const field = (name, placeholder, props = {}) => (
            <Form.Control name={name} value={staff[name]} placeholder={placeholder} onChange={(event) => setStaff((prev) => ({ ...prev, [name]: event.target.value }))} style={box} className="mb-3" {...props} />
        );
        return (
            <Form>
                <div style={{ marginBottom: '15px', color: '#5865F2' }}><i className="fab fa-discord me-2"></i>Demande de compte {isCoroner ? 'du DMEC' : 'du personnel PHMC'} pour <strong>{effectiveTitle ? `${effectiveTitle} ` : ''}{target.label}</strong></div>
                {field('middleName', 'Deuxième prénom')}
                <div style={{ display: 'flex', gap: '10px' }}>
                    <div style={{ flex: 2 }}>{field('address', 'Adresse')}</div>
                    <div style={{ flex: 1 }} className="mb-3"><ZipCityField zip={staff.zip} onZipChange={(zip) => setStaff((prev) => ({ ...prev, zip }))} placeholder="Code postal" style={box} /></div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    {field('discord', 'Discord *')}
                    {field('phNumber', 'Numéro de téléphone *')}
                </div>
                <div className="mb-3">
                    <Select options={rankOptions} value={selectedRank || null} onChange={(option) => setStaff((prev) => ({ ...prev, rank: option ? option.value : '' }))} placeholder="Fonction *" styles={selectStyles} />
                </div>
                {isDoctorRank && (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '15px' }}>
                        <span style={muted}>Titre :</span>
                        {TITLE_PREFIXES.map((title) => (
                            <Button
                                key={title} size="sm" variant={titlePrefix === title ? 'primary' : 'outline-secondary'} aria-pressed={titlePrefix === title}
                                onClick={() => setTitlePrefix((prev) => (prev === title ? '' : title))}
                            >
                                {title}
                            </Button>
                        ))}
                    </div>
                )}
                <div className="mb-3" style={{ display: 'flex' }}>
                    <span style={{ backgroundColor: '#1f2937', color: '#c9d1d9', border: '1px solid #444', borderRight: 'none', padding: '8px 10px', borderRadius: '4px 0 0 4px', fontSize: '0.9em', display: 'flex', alignItems: 'center' }}>{badgePrefix}-</span>
                    <Form.Control value={staff.badge} placeholder="Badge : 4 ou 5 chiffres *" maxLength={5} onChange={(event) => setStaff((prev) => ({ ...prev, badge: event.target.value.replace(/\D/g, '').slice(0, 5) }))} style={{ ...box, borderRadius: '0 4px 4px 0' }} />
                </div>
                <div style={{ ...muted, marginBottom: 12 }}>Un administrateur valide la demande et attribue le grade et les accès. Aucun mot de passe : vous vous connecterez avec Discord.</div>
                <div className="d-flex gap-2 justify-content-end">
                    <Button variant="outline-secondary" onClick={() => setScreen('list')} disabled={busy}>Retour</Button>
                    <Button variant="primary" onClick={requestStaff} disabled={busy}>{busy ? 'Envoi…' : 'Envoyer la demande'}</Button>
                </div>
            </Form>
        );
    }

    // Liste des personnages du compte Discord.
    const characters = session.characters || [];
    return (
        <div>
            <div style={{ ...muted, marginBottom: 10 }}>
                <i className="fab fa-discord me-1" style={{ color: '#5865F2' }}></i>
                Connecté avec Discord{session.discordUsername ? <> : <strong>{session.discordUsername}</strong></> : ''}.
                {characters.length ? ' Choisissez votre personnage :' : ' Aucun personnage pour l\'instant : créez le vôtre.'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '12px' }}>
                {characters.map((character) => {
                    const canRequest = kind === 'staff' && !character.pending && (!character.account || character.account.type === 'civilian');
                    return (
                        <div key={character.id} style={card}>
                            <i className={`fas ${character.account && character.account.type !== 'civilian' ? 'fa-user-md' : 'fa-id-card'}`} style={{ fontSize: '1.2rem' }}></i>
                            <span style={{ flex: 1, minWidth: 160 }}>
                                <strong style={{ display: 'block' }}>{character.firstName} {character.lastName}</strong>
                                <span style={muted}>
                                    {character.patientID}
                                    {character.account ? ` · ${ACCOUNT_LABEL[character.account.type] || 'Compte'}` : ' · Pas encore de compte'}
                                    {character.pending ? ' · Demande du personnel en attente' : ''}
                                </span>
                            </span>
                            {character.account && <Button size="sm" variant="success" disabled={busy} onClick={() => login(character)}>Se connecter</Button>}
                            {kind === 'civil' && !character.account && <Button size="sm" variant="primary" disabled={busy} onClick={() => choose(character, 'civilForm')}>Créer le compte Civil</Button>}
                            {canRequest && <Button size="sm" variant="outline-primary" disabled={busy} onClick={() => choose(character, 'staffForm')}>Demander un compte du personnel</Button>}
                        </div>
                    );
                })}
            </div>
            <div className="d-flex gap-2 justify-content-between flex-wrap">
                <Button variant="outline-secondary" size="sm" onClick={() => { clearDiscordResult(); setSession(null); setScreen('start'); }}>Changer de compte Discord</Button>
                <Button variant="outline-primary" size="sm" onClick={() => { setNewName({ firstName: '', lastName: '' }); setScreen('newCharacter'); }}>
                    <i className="fas fa-plus me-1"></i>Nouveau personnage
                </Button>
            </div>
        </div>
    );
};

export default DiscordAccountPanel;
