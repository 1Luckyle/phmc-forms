import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import MissingFieldsBlock from './MissingFieldsBlock';
import CctvRequestWebhookModal from './Admin/CctvRequestWebhookModal';
import EmsAmaModal from './EmsAmaModal';
import generateHipaaNotice, { HIPAA_TITLE } from '../phmc-bbcode-generators/generateHipaaNotice';
import { PHMC_FOOTER_MARK, PBC_FOOTER_MARK } from '../phmc-bbcode-generators/shared/bbStyles';

jest.mock('../firebase', () => ({ database: {}, auth: {} }));
jest.mock('firebase/database', () => ({
    ref: () => ({}), get: () => Promise.resolve({ exists: () => false, val: () => null }), set: () => Promise.resolve(),
    update: () => Promise.resolve(), push: () => ({ key: 'k' }), onValue: () => () => {}, query: () => ({}), orderByChild: () => ({}), equalTo: () => ({}), limitToLast: () => ({}),
}));
jest.mock('../contexts/SiteConfigContext', () => ({ useSiteConfig: () => ({ pbcEnabled: true, bbcodeEnabled: true }) }));
jest.mock('../contexts/EmployeeAuthContext', () => ({
    useEmployeeAuth: () => ({ currentEmployee: { uid: 'u1', email: 'a@b.c' }, canUseAma: true, staffName: 'Rose Callahan', isAdmin: false }),
}));
jest.mock('../utils/staffAdmin', () => ({ loadStaffMembers: () => Promise.resolve([]), rankLabel: () => '' }));
jest.mock('../utils/patientRecords', () => ({
    normalizePatientId: (value) => String(value || '').trim(), writeIndexEntry: () => Promise.resolve(), comprehensiveSanitize: (value) => String(value || ''), listIndexedPatientIds: () => Promise.resolve([]),
}));
jest.mock('../utils/userCreations', () => ({ loadUserCreations: () => Promise.resolve({}) }));
jest.mock('../utils/patientSignatures', () => ({ loadPatientSignature: () => Promise.resolve(null), ensurePatientSignature: () => Promise.resolve({}) }));
jest.mock('../utils/activityLog', () => ({ logActivity: () => {} }));
jest.mock('../utils/lockdownGuard', () => ({ isLockdownOn: () => false, LOCK_MESSAGE: '' }));
jest.mock('../utils/deathReports', () => ({ loadDeathLock: () => Promise.resolve(false), DEATH_LOCK_MESSAGE: '' }));
jest.mock('./SignatureCreator', () => () => null);
jest.mock('./ReportExpansion', () => ({ ReportPreviewFrame: ({ title }) => <div data-testid="preview">{title}</div> }));
jest.mock('./notificationService', () => ({ copyToClipboard: () => {} }));
jest.mock('../utils/reportDocumentExport', () => ({ exportReportDocument: () => {}, PDF_EXPORT_LABEL: 'PDF' }));
jest.mock('../utils/reportExport', () => ({ downloadBbCodeAsHtml: () => {}, COPY_BBCODE_HINT: '', DOWNLOAD_HTML_HINT: '' }));

describe('bloc « ce qui reste à renseigner »', () => {
    test('liste les champs manquants, ou annonce que tout est renseigné', () => {
        const { rerender } = render(<MissingFieldsBlock missing={['Agent demandeur', 'Raison de la demande']} title="À renseigner :" okText="Tout est bon." />);
        expect(screen.getByText('À renseigner :')).toBeInTheDocument();
        expect(screen.getByText('Agent demandeur')).toBeInTheDocument();
        expect(screen.getByText('Raison de la demande')).toBeInTheDocument();
        rerender(<MissingFieldsBlock missing={[]} okText="Tout est bon." />);
        expect(screen.getByText('Tout est bon.')).toBeInTheDocument();
        expect(screen.queryByText('Agent demandeur')).toBeNull();
    });
});

describe('demande de vidéosurveillance : le bloc remplace la notification', () => {
    beforeEach(() => {
        const root = document.createElement('div');
        root.id = 'modal-root';
        document.body.appendChild(root);
    });
    afterEach(() => { document.getElementById('modal-root')?.remove(); });

    test('le bloc liste les champs obligatoires vides ; un envoi incomplet ne déclenche aucune notification', () => {
        const showNotification = jest.fn();
        const onSubmit = jest.fn();
        render(<CctvRequestWebhookModal show onHide={() => {}} onSubmit={onSubmit} showNotification={showNotification} />);
        const block = within(document.querySelector('.missing-fields-block'));
        expect(block.getByText('À renseigner pour envoyer la demande :')).toBeInTheDocument();
        ['Agent demandeur', 'Département demandeur', "Nom d'utilisateur Discord", 'Raison de la demande'].forEach((label) => expect(block.getByText(label)).toBeInTheDocument());
        fireEvent.click(screen.getByRole('button', { name: /Envoyer la demande/ }));
        expect(showNotification).not.toHaveBeenCalled();
        expect(onSubmit).not.toHaveBeenCalled();
    });
});

describe('AMA : bloc des champs à renseigner et onglet H.I.P.A.A.', () => {
    test('avis H.I.P.A.A. : texte, établissement et pied de page', () => {
        const phmc = generateHipaaNotice({ etablissement: 'phmc', date: '19/11/2026' });
        expect(phmc).toContain(HIPAA_TITLE);
        expect(phmc).toContain('Vos droits');
        expect(phmc).toContain('Pillbox Hill Medical Center (PHMC)');
        expect(phmc).toContain(PHMC_FOOTER_MARK);
        expect(phmc).not.toContain(PBC_FOOTER_MARK);
        const pbc = generateHipaaNotice({ etablissement: 'pbc' });
        expect(pbc).toContain('phmcpaletobaylogo');
        expect(pbc).toContain(PBC_FOOTER_MARK);
        expect(pbc).not.toContain(PHMC_FOOTER_MARK);
    });

    test('le formulaire liste ce qui manque et le bouton reste bloqué ; l’onglet donne l’avis', async () => {
        render(<EmsAmaModal show onHide={() => {}} showNotification={jest.fn()} uploadImageDetailed={jest.fn()} />);
        expect(await screen.findByText("À renseigner pour enregistrer l'AMA :")).toBeInTheDocument();
        expect(screen.getByText('Patient (choisir un patient ou taper son ID)')).toBeInTheDocument();
        expect(screen.getByText('Nom du patient (imprimé)')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Signer et enregistrer l'AMA/ })).toBeDisabled();

        fireEvent.click(screen.getByRole('tab', { name: /Avis H\.I\.P\.A\.A\./ }));
        await waitFor(() => expect(screen.getByTestId('preview')).toHaveTextContent(HIPAA_TITLE));
        expect(screen.getByRole('button', { name: /PDF/ })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Signer et enregistrer l'AMA/ })).toBeNull();

        fireEvent.click(screen.getByRole('tab', { name: /Refus de soins \(AMA\)/ }));
        expect(await screen.findByText("À renseigner pour enregistrer l'AMA :")).toBeInTheDocument();
    });
});
