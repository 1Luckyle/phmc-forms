import { BB_COLORS, checkbox, sectionBanner } from './shared/bbStyles';
import { titleLabel } from '../utils/patientIdentity';
// Placeholder utilisé pour les informations attendues mais non renseignées,
// afin que ça ressorte clairement dans le document généré (plutôt qu'un blanc
// silencieux qui pourrait passer pour un bug d'affichage).
const NOT_FILLED = 'Non renseigné';

const generateCommentaryNotePBC = (formData) => {
    const {
        phmcEmployee = NOT_FILLED,
        date = NOT_FILLED,
        patientName = NOT_FILLED,
        patientID = '',
        patientNotes = NOT_FILLED
    } = formData;

    let bbCode = `[divbox=white][table][tr][td][center][br][/br][br][/br][b]Notes de service[/b]

PATIENT: ${[titleLabel(formData.patientTitle), patientName].filter(Boolean).join(' ')}${patientID ? ` (ID: ${patientID})` : ''}

Date: ${date}

[/center][td][center][img]https://phmc-tools.com/img/phmcpaletobaylogo.png[/img][/center][/table][/divbox]
${sectionBanner(`Note de commentaire`, { accent: BB_COLORS.blue })}
[table][tr][td][left][list=none][u]Identifiants de l'employé: [/u][br][/br]
${phmcEmployee}
[br][/br]
[u]Notes du patient: [/u]
${patientNotes}
[br][/br]
[u]Département: [/u][br][/br]
${checkbox(formData.departmentLarge === 'EmergencyMedicine')} Service de Médecine d'Urgence
${checkbox(formData.departmentLarge === 'InternalMedicine')} Service de Médecine Interne
${checkbox(formData.departmentLarge === 'Surgical')} Département Chirurgical
${checkbox(formData.departmentLarge === 'Midwifery')} Service de Maternité-Obstétrique
${checkbox(formData.departmentLarge === 'PhysicalTherapy')} Service de Thérapie Physique
${checkbox(formData.departmentLarge === 'Dentistry')} Service de Dentisterie
${checkbox(formData.departmentLarge === 'MentalHealth')} Service de Psychiatrie / Psychologie
${checkbox(formData.departmentLarge === 'Administration')} Administration / Direction
[br][/br][/left]
[/table]
    `
                    return bbCode;
                    };

export default generateCommentaryNotePBC;