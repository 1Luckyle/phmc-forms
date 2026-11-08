import { staffPaymentLine } from '../utils/patientBilling';
import { getPrice } from '../utils/pricing';
import { isMinorPatient } from '../utils/minors';
import { frDay } from '../utils/reportTitle';
import { titleLabel, toFrenchGender } from '../utils/patientIdentity';
import { getCitiesSnapshot } from '../utils/cities';
import withoutBlanks from './shared/withoutBlanks';
import { checkbox, sectionBanner } from './shared/bbStyles';
// Placeholder utilisé pour les informations attendues mais non renseignées,
// afin que ça ressorte clairement dans le document généré (plutôt qu'un blanc
// silencieux qui pourrait passer pour un bug d'affichage). Les champs
// explicitement facultatifs (ex: deuxième prénom) ou qui ne sont pertinents que
// si une autre case "Autre" est cochée gardent une chaîne vide.
const NOT_FILLED = 'Non renseigné';

// Mise en page alignée sur les dossiers médicaux (Basique, Avancé) : bandeau d'en-tête, bandeaux de section, tableaux à deux colonnes, cases [cb] / [cbc].
const generateMedicalRecordRelease = (formData) => {
    const {
        patientFirstName = NOT_FILLED,
        patientLastName = NOT_FILLED,
        patientID = NOT_FILLED,
        patientPH = NOT_FILLED,
        patientDateOfBirth = NOT_FILLED,
        patientAddress = NOT_FILLED,
        patientEmail = NOT_FILLED,
        phmcEmployee = NOT_FILLED,
        StupidDateFrom = NOT_FILLED,
        StupidDateTo = NOT_FILLED,
        paymentProofPhotos,
        MedicalRecordsRelease,
        payNow,
    } = withoutBlanks(formData);
    const patientMiddleName = String(formData.patientMiddleName || '').trim();
    const patientMedInfoReleaseOther = String(formData.patientMedInfoReleaseOther || '').trim();
    const patientMedInfoFormatOther = String(formData.patientMedInfoFormatOther || '').trim();
    const MedicalRecordsReleaseOther = String(formData.MedicalRecordsReleaseOther || '').trim();
    const SubmitDate = formData.SubmitDate || new Date().toISOString().slice(0, 10);

    const calculateCost = () => {
        const selectedCount = MedicalRecordsRelease?.length || 0;
        if (selectedCount === 0) {
            return 0;
        }
        const costPerItem = getPrice('divulgationParElement');
        return selectedCount * costPerItem;
    };
    const approximateCost = calculateCost();
    const firstPaymentProofUrl = (paymentProofPhotos || '').split(',')[0].trim();
    const patientFullName = `${patientFirstName || ''} ${patientMiddleName || ''} ${patientLastName || ''}`.replace(/\s+/g, ' ').trim(); // Combine and clean up spaces

    // Ville et code postal : le code est enregistré, la ville s'en déduit d'après la liste des villes tenue par les admins.
    const zip = String(formData.patientZIP || '').trim();
    const city = zip ? (getCitiesSnapshot().find((entry) => String(entry.cp).toLowerCase() === zip.toLowerCase()) || null) : null;
    const cityName = String(formData.patientZIPCity || '').trim() || (city ? city.nom : '');
    const cityLine = zip || cityName ? `${cityName ? `${cityName}${zip ? ' — ' : ''}` : ''}${zip}` : NOT_FILLED;

    // Patient mineur : l'autorisation est signée par son représentant légal (sauf mineur émancipé, qui signe lui-même).
    const minor = isMinorPatient({ birthDate: formData.patientDateOfBirth, titleIsMinor: formData.patientTitle === 'Mineur' });
    const emancipated = minor && !!formData.patientEmancipated;
    const guardianName = String(formData.guardianName || '').trim() || NOT_FILLED;
    const guardianRelation = String(formData.guardianRelation || '').trim() || NOT_FILLED;
    const needsGuardian = minor && !emancipated;
    const guardianTable = needsGuardian
        ? `\n[table][tr][td] Représentant légal: ${guardianName} [/td][td] Lien avec le patient: ${guardianRelation}\n[/table]`
        : (emancipated ? '\n[table][tr][td] Mineur émancipé : le patient signe lui-même cette autorisation.\n[/table]' : '');
    const guardianParagraph = needsGuardian
        ? `[b]Patient mineur.[/b] La présente autorisation est signée par ${guardianName}, ${guardianRelation} de ${patientFullName}, qui agit en son nom : les mentions « je soussigné(e) » ci-dessous s'entendent du représentant légal.\n\n`
        : '';
    const signerLine = needsGuardian ? `${guardianName} — ${guardianRelation} de ${patientFullName} (mineur)` : patientFullName;

    // Rapports retenus dans la liste des rapports disponibles : titre, date et médecin responsable (jamais leur contenu).
    const retained = (Array.isArray(formData.releaseReports) ? formData.releaseReports : []).filter((item) => item && item.t);
    const retainedRows = retained.map((item) => `[tr][td] ${item.t} [/td][td] ${item.ts ? new Date(Number(item.ts)).toLocaleDateString('fr-FR') : NOT_FILLED} [/td][td] ${item.a || NOT_FILLED}`);
    const retainedBlock = retained.length > 0
        ? `\n${sectionBanner('Rapports retenus', { size: 115 })}\n[table]\n${retainedRows.join('\n')}\n[/table]`
        : '';

    const purpose = formData.CarePurposeMedicalInformationRelease;
    const format = formData.PurposeMedicalInformationReleaseFormat;
    const has = (key) => !!MedicalRecordsRelease?.includes(key);

    let paymentLine = '';
    if (formData.filledByStaff && approximateCost > 0) {
        paymentLine = staffPaymentLine(24, formData);
    } else if ((payNow === true || payNow === 'true') && approximateCost > 0) {
        paymentLine = `Je soussigné(e), ${patientFullName || 'le soussigné'}, joins ce paiement de ${approximateCost.toLocaleString()}$ pour les frais de divulgation des dossiers médicaux. ${firstPaymentProofUrl ? `[url=${firstPaymentProofUrl}]Image jointe[/url]` : '[i]Aucune preuve de paiement fournie[/i]'}`;
    } else {
        paymentLine = 'Aucune preuve de paiement fournie';
    }

    return `[table][tr][td][center][br][/br][br][/br][b]Informations du patient[/b]

[size=110]PATIENT ${patientID}

${patientFullName || NOT_FILLED}
[/size]

[/center][td][center][img]https://phmc-tools.com/img/phmc.png[/img][img]https://phmc-tools.com/img/phmcpaletobaylogo.png[/img]
[b][size=150]AUTORISATION DE DIVULGATION DES INFORMATIONS MÉDICALES[/size][/b][/center][/table]
${sectionBanner(`Informations générales`, { size: 115 })}
[table][tr][td] Titre: ${titleLabel(formData.patientTitle) || NOT_FILLED}[/td][td] Prénom (Deuxième Prénom) & Nom: ${patientFullName || NOT_FILLED}
[tr][td] Date de naissance: ${frDay(patientDateOfBirth)} [/td][td] Genre à l'état civil: ${toFrenchGender(formData.patientGender) || NOT_FILLED}
[tr][td] Adresse: ${patientAddress} [/td][td] Ville et code postal: ${cityLine}
[/table]${guardianTable}
${sectionBanner(`Coordonnées`, { size: 115 })}
[table][tr][td] Numéro de téléphone: ${patientPH} [/td][td] Email: ${patientEmail}
[/table]
${sectionBanner(`Informations de divulgation`, { size: 115 })}
[table][tr][td] Motif de la divulgation: [/td][td] ${checkbox(purpose === 'Further Treatment')} Traitement ultérieur / Suite de soins ${checkbox(purpose === 'Personal')} Usage personnel ${checkbox(purpose === 'Attorney')} Avocat / Client ${checkbox(purpose === 'Other')} Autre${patientMedInfoReleaseOther ? `: ${patientMedInfoReleaseOther}` : ''}
[tr][td] Format de divulgation: [/td][td] ${checkbox(format === 'CopyofRecords')} Copie du dossier à récupérer ${checkbox(format === 'VerbalRelease')} Divulgation verbale (ex: conversation téléphonique) ${checkbox(format === 'ElectronicRelease')} Divulgation électronique (envoyée par courriel) ${checkbox(format === 'Other')} Autre${patientMedInfoFormatOther ? `: ${patientMedInfoFormatOther}` : ''}
[tr][td] Période concernée: [/td][td] Du ${frDay(StupidDateFrom)} au ${frDay(StupidDateTo)}
[tr][td] Praticien consulté: [/td][td] ${phmcEmployee}
[/table]
${sectionBanner(`Dossiers médicaux à divulguer`, { size: 115 })}
[table][tr][td] ${checkbox(has('ERVisit'))} [b]Visite aux urgences[/b] (Notes des urgences, notes d'évolution, consultations, notes de procédure, résultats de tests)
[tr][td] ${checkbox(has('HospitalStay'))} [b]Séjour hospitalier[/b] (Anamnèse et examen physique, notes d'évolution, consultations, rapports opératoires, résumé de sortie, résultats de tests)
[tr][td] ${checkbox(has('Outpatient'))} [b]Chirurgie/Procédure ambulatoire[/b] (Anamnèse et examen physique, notes d'évolution, consultations, notes de procédure, résultats de tests)
[tr][td] ${checkbox(has('OfficeClinic'))} [b]Visite à la clinique, au cabinet ou soins immédiats[/b] (Notes de bureau, notes d'évolution, notes de procédure, résultats de tests)
[tr][td] ${checkbox(has('PsychologyVisits'))} [b]Visites de psychologie[/b] (Notes de bureau, notes d'évolution, notes de procédure, résultats d'évaluation)
[tr][td] ${checkbox(has('Other'))} [b]Autres dossiers[/b]${MedicalRecordsReleaseOther ? `: ${MedicalRecordsReleaseOther}` : ''}
[/table]${retainedBlock}
${sectionBanner(`Autorisation de divulgation des informations`, { size: 115 })}
[divbox=transparent][list=none]${guardianParagraph}Je soussigné(e), ${patientFullName}, autorise par la présente le Pillbox Hill Medical Center à divulguer mes informations de santé individuellement identifiables. Je comprends que cette autorisation est volontaire et que je peux refuser de signer cette autorisation. Je comprends également que mes soins de santé ne seront pas affectés si je ne signe pas ce formulaire.

Je soussigné(e), ${patientFullName}, comprends que si le destinataire autorisé à recevoir les informations n'est pas une entité couverte, les informations divulguées peuvent ne plus être protégées par les réglementations fédérales et étatiques sur la vie privée.

Je soussigné(e), ${patientFullName}, comprends en outre que je peux révoquer cette autorisation à tout moment en avisant par écrit l'établissement du Pillbox Hill Medical Center où cette autorisation est signée. Je comprends également que la révocation doit être signée et datée d'une date postérieure à celle figurant sur cette autorisation. La révocation n'affectera pas les divulgations effectuées avant la réception de la révocation écrite.

Je soussigné(e), ${patientFullName}, comprends que le dossier peut ne pas être complet s'il s'agit d'une visite récente, et qu'une documentation supplémentaire pourrait être ajoutée après la soumission de cette demande.

En tapant mon nom ci-dessous, je soussigné(e), ${patientFullName}, certifie que ces informations peuvent être utilisées dans le but de traiter ma demande d'autorisation de divulgation de dossiers médicaux. Je considère ceci comme ma signature électronique pour cette demande.[/list][/divbox]
${sectionBanner(`Signature`, { size: 115 })}
[table][tr][td] Signature${needsGuardian ? ' du représentant légal' : ''}: [i][u]${signerLine}[/u][/i] [/td][td] Date: ${frDay(SubmitDate)}
[/table]
${sectionBanner(`Paiement`, { size: 115 })}
[table][tr][td] ${formData.filledByStaff ? 'Paiement à régler par le patient :' : 'Veuillez joindre une confirmation non modifiée de votre paiement.'}[/td][td]
${paymentLine}
[/table]`;
};
export default generateMedicalRecordRelease;
