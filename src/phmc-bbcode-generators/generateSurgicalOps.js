// Placeholder utilisé pour les informations attendues mais non renseignées,
// afin que ça ressorte clairement dans le document généré (plutôt qu'un blanc
// silencieux qui pourrait passer pour un bug d'affichage). Le personnel
// supplémentaire est explicitement optionnel ("laisser vide si aucun") et
// garde une chaîne vide.
import { buildPatientContextBBCode } from './shared/patientContext';

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

[/center][td][center][img]https://i.ibb.co/0pgw9hHm/phmc.png[/img][/center][td][center][br][/br][br][/br][size=100][b]CENTRE MÉDICAL PILLBOX HILL[/b]
ELGIN AVE. / STRAWBERRY AVE.
BP 742
LOS SANTOS, SAN ANDREAS
T: 50056[/size][/center][/table][/divbox]
[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Personnel[/b][/color][/center][/divboxcolor]
[table][tr][td]Chirurgien principal[/td][td]
${phmcEmployee}
[/td][/tr]
[tr][td]Personnel supplémentaire [i](laisser vide si aucun)[/i][/td][td]
${extraStaff}
[/td][/tr][/table]
${buildPatientContextBBCode(formData)}[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Enquête chirurgicale[/b][/color][/center][/divboxcolor]
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
[cb${formData.patientConsentOption === 'Yes' ? 'c' : ''}] Oui
[cb${formData.patientConsentOption === 'No' ? 'c' : ''}] Non


[/td][/tr]

[tr][td]Des complications médicales sont-elles survenues pendant la chirurgie?[/td][td]
[cb${formData.patientComplicationOptions === 'Yes' ? 'c' : ''}] Oui
[cb${formData.patientComplicationOptions === 'No' ? 'c' : ''}] Non
${formData.patientComplicationOptions === 'Yes' && formData.patientComplicationsYes ? `[br][/br][i]Détails :[/i] ${formData.patientComplicationsYes}` : ''}
[/td][/tr]

[tr][td]La procédure a-t-elle été complétée avec succès et a-t-elle abouti au résultat clinique souhaité?[/td][td]
[cb${formData.procedureGoodOptions === 'Yes' ? 'c' : ''}] Oui
[cb${formData.procedureGoodOptions === 'No' ? 'c' : ''}] Non
${formData.procedureGoodOptions === 'No' && formData.procedureGoodNo ? `[br][/br][i]Détails :[/i] ${formData.procedureGoodNo}` : ''}
[/td][/tr]
[/table]

[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Rapport post-anesthésie[/b][/color][/center][/divboxcolor]
[table]

[tr][td]Type et dosage d'anesthésie administrée[/td][td] ${patientSummaryConsultation}
[/td][/tr]

[tr][td]Détails d'anesthésie post-opératoire[/td][td]${patientAddress}
[/td][/tr]

[/table]

[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Résumé de la procédure chirurgicale[/b][/color][/center][/divboxcolor]
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