// Placeholder utilisé pour les informations attendues mais non renseignées,
// afin que ça ressorte clairement dans le document généré (plutôt qu'un blanc
// silencieux qui pourrait passer pour un bug d'affichage). Le personnel
// supplémentaire est explicitement optionnel ("laisser vide si aucun") et
// garde une chaîne vide.
import { buildPatientContextBBCode } from './shared/patientContext';
import { checkbox, phmcHeaderEnd, sectionBanner } from './shared/bbStyles';

const NOT_FILLED = 'Non renseigné';

const ANESTHESIA_LABELS = {
    General: 'Anesthésie générale',
    Regional: 'Anesthésie locorégionale / péridurale',
    Local: 'Anesthésie locale',
    Sedation: 'Sédation',
    None: 'Aucune anesthésie',
};

const generateSurgicalOps = (formData) => {
    const {
        phmcEmployee = NOT_FILLED,
        extraStaff = '',
        patientName = NOT_FILLED,
        patientID = '',
        patientSummaryConsultation = NOT_FILLED,
        patientAddress = NOT_FILLED,
        phmcRank = NOT_FILLED,
        date = NOT_FILLED,
        patientSummary = NOT_FILLED,
        lastName = NOT_FILLED,
        surgeryProcedures = NOT_FILLED
    } = formData;
    const extraStaffNames = Array.isArray(extraStaff) ? extraStaff.join(', ') : extraStaff;

    let bbCode = `[divbox=white][table][tr][td][center][br][/br][br][/br][b]RAPPORT CHIRURGICAL[/b]

PATIENT ${patientName}${patientID ? ` (ID: ${patientID})` : ''}

Date: ${date}
Signé: ${phmcRank} ${lastName}

${phmcHeaderEnd()}
${sectionBanner(`Personnel`)}
[table][tr][td]Chirurgien principal[/td][td]
${phmcEmployee}
[/td][/tr]
[tr][td]Personnel supplémentaire [i](laisser vide si aucun)[/i][/td][td]
${extraStaff}
[/td][/tr][/table]
${buildPatientContextBBCode(formData)}${sectionBanner(`Enquête chirurgicale`)}
[table]

[tr][td]Diagnostic pré-opératoire[/td][td]
${formData.surgeryPreOpDiagnosis || NOT_FILLED}
[/td][/tr]

[tr][td]Nom de la procédure[/td][td]
${surgeryProcedures}
[/td][/tr]

[tr][td]Anesthésie / durée / pertes sanguines[/td][td]
${ANESTHESIA_LABELS[formData.surgeryAnesthesiaType] || NOT_FILLED} | ${formData.surgeryDuration ? `${formData.surgeryDuration} min` : 'Durée non renseignée'} | ${formData.surgeryBloodLoss ? `${formData.surgeryBloodLoss} mL` : 'Pertes non renseignées'}
[/td][/tr]

[tr][td]Le patient ou sa famille a-t-il donné son consentement, ou avait-il une blessure potentiellement mortelle ou grave nécessitant une intervention chirurgicale immédiate?[/td][td]
${checkbox(formData.patientConsentOption === 'Yes')} Oui
${checkbox(formData.patientConsentOption === 'No')} Non


[/td][/tr]

[tr][td]Des complications médicales sont-elles survenues pendant la chirurgie?[/td][td]
${checkbox(formData.patientComplicationOptions === 'Yes')} Oui
${checkbox(formData.patientComplicationOptions === 'No')} Non
${formData.patientComplicationOptions === 'Yes' && formData.patientComplicationsYes ? `[br][/br][i]Détails :[/i] ${formData.patientComplicationsYes}` : ''}
[/td][/tr]

[tr][td]La procédure a-t-elle été complétée avec succès et a-t-elle abouti au résultat clinique souhaité?[/td][td]
${checkbox(formData.procedureGoodOptions === 'Yes')} Oui
${checkbox(formData.procedureGoodOptions === 'No')} Non
${formData.procedureGoodOptions === 'No' && formData.procedureGoodNo ? `[br][/br][i]Détails :[/i] ${formData.procedureGoodNo}` : ''}
[/td][/tr]
[/table]

${sectionBanner(`Rapport post-anesthésie`)}
[table]

[tr][td]Type et dosage d'anesthésie administrée[/td][td] ${patientSummaryConsultation}
[/td][/tr]

[tr][td]Détails d'anesthésie post-opératoire[/td][td]${patientAddress}
[/td][/tr]

[/table]

${sectionBanner(`Résumé de la procédure chirurgicale`)}
[table]

[tr][td]
${patientSummary}
[/td][/tr]
${formData.surgeryPostOpInstructions ? `
[tr][td][b]Consignes post-opératoires et suivi[/b][br][/br]
${formData.surgeryPostOpInstructions}
[/td][/tr]` : ''}
[/table]`;

    return bbCode;
};

export default generateSurgicalOps;