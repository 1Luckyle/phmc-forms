// src/components/Auth/GtawCharacterPicker.js
//
// Sélecteur de personnage GTA World "intelligent", partagé entre le parcours
// Personnel PHMC/DMEC (création de compte dans OnboardingModal) et le parcours
// Civil : selon le nombre de personnages du compte GTA World et leur statut
// d'inscription (gtawResolutions, calculé côté serveur dans
// exchangeAuthCodeForToken — voir functions/index.js), il saute directement à
// la bonne action (connexion ou création) quand c'est sans ambiguïté, et
// n'affiche une liste de choix que lorsque l'utilisateur a réellement plusieurs
// personnages parmi lesquels choisir :
//   0 personnage            → onNoCharacters()
//   1 personnage inscrit    → onLogin(customToken, ...) directement
//   1 personnage disponible → onCreate(character) directement
//   1 personnage en attente → onPending(character) directement
//   2+ personnages          → liste où chaque entrée déclenche la bonne action
import { useEffect, useRef } from 'react';

const GtawCharacterPicker = ({
    characters,
    gtawResolutions = {},
    onLogin,
    onCreate,
    onPending = () => {},
    onNoCharacters = () => {},
}) => {
    const hasAutoResolvedRef = useRef(false);

    useEffect(() => {
        if (hasAutoResolvedRef.current) return;
        if (!characters) return;

        if (characters.length === 0) {
            hasAutoResolvedRef.current = true;
            onNoCharacters();
            return;
        }

        if (characters.length === 1) {
            hasAutoResolvedRef.current = true;
            const character = characters[0];
            const resolution = gtawResolutions[String(character.id)];
            if (resolution?.registered && resolution.customToken) {
                onLogin(resolution.customToken, { character, resolution });
            } else if (resolution?.pending) {
                onPending(character);
            } else {
                onCreate(character);
            }
        }
        // 2+ personnages : on laisse le rendu ci-dessous afficher la liste ;
        // aucune action automatique tant que l'utilisateur n'a pas choisi.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [characters]);

    if (!characters || characters.length <= 1) {
        // Rien à afficher : soit la résolution automatique ci-dessus est en
        // cours, soit elle a déjà redirigé vers onLogin/onCreate/onPending/onNoCharacters.
        return null;
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '15px' }}>
            {characters.map((character) => {
                const resolution = gtawResolutions[String(character.id)];
                const isRegistered = !!(resolution?.registered && resolution.customToken);
                const isPending = !!resolution?.pending;

                let borderColor = '#444';
                let badgeColor = '#ffc107';
                let badgeText = 'Pas de compte — créer';
                if (isRegistered) {
                    borderColor = '#2e7d32';
                    badgeColor = '#66bb6a';
                    badgeText = 'Compte existant — connexion';
                } else if (isPending) {
                    borderColor = '#5c1f1f';
                    badgeColor = '#ff6b6b';
                    badgeText = 'Demande en attente';
                }

                return (
                    <button
                        key={character.id}
                        type="button"
                        disabled={isPending}
                        onClick={() => {
                            if (isRegistered) {
                                onLogin(resolution.customToken, { character, resolution });
                            } else if (!isPending) {
                                onCreate(character);
                            }
                        }}
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            backgroundColor: '#2a2a2a',
                            border: `1px solid ${borderColor}`,
                            borderRadius: '8px', padding: '12px 15px',
                            color: isPending ? '#888' : '#fff',
                            cursor: isPending ? 'not-allowed' : 'pointer',
                            opacity: isPending ? 0.6 : 1,
                            textAlign: 'left'
                        }}
                    >
                        <span>
                            <i className="fas fa-user" style={{ marginRight: '10px' }}></i>
                            {character.firstname} {character.lastname}
                        </span>
                        <span style={{
                            fontSize: '0.75em',
                            color: badgeColor,
                            border: `1px solid ${badgeColor}`,
                            borderRadius: '4px', padding: '2px 6px', whiteSpace: 'nowrap'
                        }}>
                            {badgeText}
                        </span>
                    </button>
                );
            })}
        </div>
    );
};

export default GtawCharacterPicker;
