// src/phmc-bbcode-generators/generateSicknessEmail.js
//
// Certificat de Maladie (formulaire 35) : courriel médical envoyé hors du site (employeur, école, assurance…). Mise en page des courriels du DMEC : logo, bandeau noir, tableau
// « étiquette : valeur », texte, puis signature de la personne qui l'a rempli et pied de page commun des courriels (shared/bbStyles.js). Le texte vient de utils/medicalCertificates.js.
import { toEmployerSafeSummary } from '../utils/employerSummary';
import { buildCertificateContent, frDate } from '../utils/medicalCertificates';
import { sectionBanner, infoTable, paragraph, staffSignatureBlock, mailFooter, PHMC_LOGO } from './shared/bbStyles';

const generateSicknessEmail = (formData) => {
    const f = formData || {};
    const content = buildCertificateContent(f);

    // Le certificat part chez un tiers : seul un résumé SIMPLIFIÉ d'un rapport accepté est joint
    // (filet de sécurité : un rapport complet, ancien brouillon ou contenu non reconnu n'est jamais imprimé).
    const safeReportSummary = toEmployerSafeSummary(f.attachedReportSummary, { patientName: f.patientName });
    const reportSection = safeReportSummary
        ? `[altspoiler=Résumé simplifié du rapport médical joint][quote]${safeReportSummary}[/quote][/altspoiler]`
        : '';

    // Signataire : la personne qui remplit le courriel (nom, rôle, service, signature). Anciens courriels : l'employé choisi et l'image de signature collée.
    const signer = f.signer && f.signer.name ? f.signer : { name: f.phmcEmployee || 'Employé PHMC', rank: f.phmcRank || '', signatureUrl: f.phmcEmployeeSignatureImage || '' };

    const patientLine = [f.patientName, f.patientID ? `(${f.patientID})` : ''].filter(Boolean).join(' ') || 'N/A';
    const table = infoTable([
        [['Destinataire', f.emailRecipient || 'N/A'], ['Expéditeur', signer.name]],
        [['Objet', content.subject]],
        [['Patient', patientLine], ...(f.dateOfVisit ? [['Consultation', frDate(f.dateOfVisit)]] : [])],
        ...content.rows.map((row) => [row]),
    ]);

    return `[divbox=white][center][img]${PHMC_LOGO}[/img][/center][/divbox]
${sectionBanner('Courrier médical du Pillbox Hill Medical Center', { size: 115 })}
${table}
${paragraph(content.paragraphs.join('\n\n'))}${reportSection ? `\n${reportSection}` : ''}
[br][/br]
${staffSignatureBlock(signer)}
${mailFooter()}`;
};

export default generateSicknessEmail;
