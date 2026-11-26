import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';

const mockSet = jest.fn(() => Promise.resolve());
let mockModeValue = null;
jest.mock('../../firebase', () => ({ database: {}, auth: { currentUser: null } }));
jest.mock('firebase/database', () => ({
    ref: (db, path) => ({ path }),
    set: (...args) => mockSet(...args),
    onValue: (reference, callback) => {
        callback({ val: () => (reference.path === 'adminSettings/siteMode' ? mockModeValue : null) });
        return () => {};
    },
}));
jest.mock('../../utils/activityLog', () => ({ logAdminAction: () => {} }));

const { normalizeSiteMode, siteModeLabel } = require('../../constants/siteMode');
const { SiteConfigProvider, useSiteMode } = require('../../contexts/SiteConfigContext');
const SiteModeSwitch = require('./SiteModeSwitch').default;

describe('version du site', () => {
    beforeEach(() => { mockModeValue = null; try { localStorage.clear(); } catch (error) { /* */ } });

    test('toute valeur absente ou inconnue = version GTA World', () => {
        expect(normalizeSiteMode(undefined)).toBe('gtaw');
        expect(normalizeSiteMode('autre')).toBe('gtaw');
        expect(normalizeSiteMode('classique')).toBe('classique');
        expect(siteModeLabel('classique')).toBe('Version PHMC classique');
    });

    test('useSiteMode suit adminSettings/siteMode', () => {
        const Probe = () => { const { siteMode, isClassic, isGtaw } = useSiteMode(); return <div>{`${siteMode}-${isClassic}-${isGtaw}`}</div>; };
        const { unmount } = render(<SiteConfigProvider><Probe /></SiteConfigProvider>);
        expect(screen.getByText('gtaw-false-true')).toBeTruthy();
        unmount();
        mockModeValue = { mode: 'classique' };
        render(<SiteConfigProvider><Probe /></SiteConfigProvider>);
        expect(screen.getByText('classique-true-false')).toBeTruthy();
    });

    test('la bascule demande une confirmation puis enregistre la version choisie', async () => {
        render(<SiteConfigProvider><SiteModeSwitch currentUser={{ email: 'admin@test' }} showInAppNotification={() => {}} /></SiteConfigProvider>);
        expect(screen.getByText('Active')).toBeTruthy();
        fireEvent.click(screen.getByText('Passer à cette version'));
        expect(mockSet).not.toHaveBeenCalled();
        await act(async () => { fireEvent.click(screen.getByText('Confirmer')); });
        expect(mockSet).toHaveBeenCalledWith({ path: 'adminSettings/siteMode' }, expect.objectContaining({ mode: 'classique', majPar: 'admin@test' }));
    });
});
