// src/components/Contracts/sideMenu.js
//
// Menus « Nouveau document » (contrats) et « Nouvel accord » (accords commerciaux) : ils s'ouvrent sur le CÔTÉ du bouton (droite, sinon gauche) et non dessous, où la fin de la liste sortait de l'écran.
// À utiliser avec <Dropdown drop="end"> et <Dropdown.Menu className="contracts-menu" popperConfig={SIDE_MENU_POPPER}> ; la hauteur du menu est limitée et défile (Contracts.css).
export const SIDE_MENU_POPPER = {
    strategy: 'fixed',
    modifiers: [
        { name: 'flip', options: { fallbackPlacements: ['left-start', 'bottom-start', 'top-start'] } },
        { name: 'preventOverflow', options: { padding: 8, altAxis: true } },
    ],
};
