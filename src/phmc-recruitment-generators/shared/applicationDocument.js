// src/phmc-recruitment-generators/shared/applicationDocument.js
//
// Document (BBCode / aperçu) commun aux six candidatures, dans le même style que les autres formulaires du site : en-tête à deux cellules, bandeaux de rubrique noirs,
// champs en « étiquette : valeur ». Plus de numérotation rouge, de cases à cocher vides ni de bandeau de liens : les choix (niveau d'études, citoyenneté…) sont écrits
// en toutes lettres, l'expérience professionnelle en une fiche par emploi. Le pied de page du centre est ajouté, comme pour tous les rapports, par withPhmcFooter.
import { careHeader, sectionBanner, escapeBbText, pbcFooter } from '../../phmc-bbcode-generators/shared/bbStyles';
import { placeWithCity } from '../../utils/places';
import {
    applicantDisplayName, applicantAge, locationLabel, jobsOf, jobPeriod, enrollmentPeriod, timezoneLabel, frDate, licenseOf,
} from '../../utils/applicationForm';

const NOT_FILLED = 'Non renseigné';
const LICENSE_IMG_WIDTH = 320;
const safe = (value) => escapeBbText(String(value ?? '').trim());
const line = (label, value) => `[u]${label} :[/u] ${safe(value) || NOT_FILLED}`;
const block = (lines) => `[table][tr][td][left][list=none]${lines.join('\n')}[/list][/left][/td][/tr][/table]`;
const extra = (label, value) => (String(value ?? '').trim() ? [line(label, value)] : []);

const jobBlock = (job, index) => {
    const title = [safe(job.role), safe(job.company)].filter(Boolean).join(' chez ') || NOT_FILLED;
    const period = jobPeriod(job);
    return [
        `[b]Emploi ${index + 1} — ${title}[/b]${period ? ` ([i]${period}[/i])` : ''}`,
        line('Responsabilités', job.duties),
        ...(job.left ? extra('Motif du départ', job.leaveReason) : []),
    ].join('\n');
};

/**
 * formData : les réponses du formulaire (+ positionDetailsData : postes de la catégorie, injectés par MainApp) ; options.categoryLabel : « Médecine »…
 */
const generateApplicationDocument = (formData, { categoryLabel = '' } = {}) => {
    const f = formData || {};
    const positions = f.positionDetailsData || {};
    const position = f.recruitmentPosition ? (positions[f.recruitmentPosition]?.nom || f.recruitmentPosition) : 'Poste non choisi';
    const name = applicantDisplayName(f);
    const age = applicantAge(f);
    const place = placeWithCity(f.applicantAddress, f.applicantZIP, f.applicantZIPCity);
    const languages = Array.isArray(f.applicantLanguages) ? f.applicantLanguages.join(', ') : f.applicantLanguages;
    const jobs = jobsOf(f);
    const license = licenseOf(f);
    const pbc = f.applicantLocation === 'PBC';   // candidature à la clinique de Paleto Bay : logo et coordonnées de la clinique
    const hasPartTime = !!f.emsPartTimeReason;
    const hasHrpExtras = !!(f.oocOtherCharLicenseProof || f.dfpSanFireLink || f.dfpPhmcLink || f.dfpLegalFactionLink);

    const identity = block([
        line('ID patient', f.patientID),
        line('Titre et nom', name),
        line('Date de naissance', f.applicantDOB ? `${frDate(f.applicantDOB)}${age !== null ? ` (${age} an${age > 1 ? 's' : ''})` : ''}` : ''),
        line('Adresse du domicile', place),
        line('Téléphone', f.applicantPhone),
        line('Courriel', f.applicantEmail),
        line('Citoyenneté', f.applicantCitizenship),
        line("Lieu d'emploi souhaité", locationLabel(f.applicantLocation)),
    ]);

    const education = block([
        line("Niveau d'études", f.applicantEducationLevel),
        line('Établissement', f.applicantSchoolName),
        line('Période de scolarité', enrollmentPeriod(f)),
        line('Domaine principal', f.applicantMajor),
        line('Langues supplémentaires', languages),
    ]);

    let experience = '';
    if (jobs.length > 0) experience = `${sectionBanner('Expérience professionnelle')}\n${block([jobs.map(jobBlock).join('\n[br][/br]\n')])}\n`;
    else if (f.applicantNoExperience) experience = `${sectionBanner('Expérience professionnelle')}\n${block(["Aucune expérience professionnelle à présenter."])}\n`;
    // Licences : une capture par image (réduite à l'affichage, voir [img=largeur]) ; programme à temps partiel (autres rôles EMS) en dessous.
    const licences = license
        ? `${sectionBanner('Licence')}\n[table][tr][td][center][img=${LICENSE_IMG_WIDTH}]${license}[/img][/center][/td][/tr][/table]\n`
        : '';
    const partTime = hasPartTime ? `${sectionBanner('Programme à temps partiel')}\n${block([line('Motivation', f.emsPartTimeReason)])}\n` : '';

    const hrp = block([
        line('Nom Discord', f.oocDiscord),
        line('Fuseau horaire', timezoneLabel(f.oocTimezone)),
        ...extra('Expérience médicale réelle ou RP médical passé', f.oocMedicalExperience),
        ...(hasHrpExtras ? [
            line('Licence BLS/ALS sur un autre personnage', f.oocOtherCharLicenseProof),
            line('Preuve de DFP SAN FIRE', f.dfpSanFireLink),
            line('Preuve de DFP PHMC', f.dfpPhmcLink),
            line('Preuve de DFP Legal Faction Management', f.dfpLegalFactionLink),
        ] : []),
    ]);

    const document = `${careHeader({ title: 'Candidature', pbc, lines: `CANDIDAT : ${safe(name) || NOT_FILLED}${f.patientID ? ` (ID : ${safe(f.patientID)})` : ''}\nPoste : ${safe(position)}${categoryLabel ? `\nCentre de Carrières — ${categoryLabel}` : '\nCentre de Carrières'}` })}
${sectionBanner('Identité')}
${identity}
${sectionBanner('Formation')}
${education}
${experience}${licences}${partTime}${sectionBanner('(( Informations hors personnage ))')}
${hrp}
`;
    // Le pied de page standard (PHMC) est ajouté ensuite par withPhmcFooter ; pour la clinique de Paleto Bay, on pose ici le sien (il reconnaît sa marque et n'ajoute rien).
    return pbc ? `${document.replace(/\s+$/, '')}\n${pbcFooter()}` : document;
};

export default generateApplicationDocument;
