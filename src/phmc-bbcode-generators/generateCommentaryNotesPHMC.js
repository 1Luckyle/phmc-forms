import { checkbox, sectionBanner } from './shared/bbStyles';
import { allNoteDepartments } from '../constants/clinicalOptions';
import { titleLabel } from '../utils/patientIdentity';
// Placeholder utilisé pour les informations attendues mais non renseignées,
// afin que ça ressorte clairement dans le document généré (plutôt qu'un blanc
// silencieux qui pourrait passer pour un bug d'affichage).
const NOT_FILLED = 'Non renseigné';

const generateCommentaryNotePHMC = (formData) => {
                const {
                    phmcEmployee = NOT_FILLED,
                    date = NOT_FILLED,
                    patientNotes = NOT_FILLED,
                    patientName = NOT_FILLED,
                    patientID = '',
                } = formData;

                let bbCode = `[divbox=white][table][tr][td][center][br][/br][br][/br][b]Notes de service[/b]

PATIENT: ${[titleLabel(formData.patientTitle), patientName].filter(Boolean).join(' ')}${patientID ? ` (ID: ${patientID})` : ''}

Date: ${date}

[/center][td][center][img]https://phmc-tools.com/img/phmc.png[/img][/center][/table][/divbox]
${sectionBanner(`Note de commentaire`)}
[table][tr][td][left][list=none][u]Identifiants de l'employé: [/u][br][/br]
${phmcEmployee}
[br][/br]
[u]Notes du patient: [/u]
${patientNotes}
[br][/br]
[u]Département: [/u][br][/br]
${allNoteDepartments().map(([value, label]) => `${checkbox(formData.departmentLarge === value)} ${label}`).join('\n')}
[br][/br][/left]
[/table]
`
                return bbCode;
                };
export default generateCommentaryNotePHMC;