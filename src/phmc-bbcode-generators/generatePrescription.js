// src/phmc-bbcode-generators/generatePrescription.js
//
// ORDONNANCE comme document à part entière : même en-tête que les rapports de soins, un tableau (médicament, posologie, début, durée) et le pied de page du centre. Elle se construit à partir des
// médicaments de l'assistant cochés « sur l'ordonnance » ; le rapport qui la porte la garde en ligne (voir careExtras.prescriptionBBCode), et ce document sert à la copier, la télécharger ou l'exporter
// seule (PDF, image…), depuis le formulaire comme depuis un rapport enregistré.
import { careHeader, sectionBanner, withPhmcFooter, escapeBbText } from './shared/bbStyles';
import { signedLine } from './shared/patientContext';
import { prescriptionParts } from '../clinical/engine';
import { frDay } from '../utils/reportTitle';
import { isPbcVersion } from '../utils/formAccess';
import { CARE_VISIT_LABELS } from '../utils/careVisitSummary';

const entriesOf = (formData) => (Array.isArray(formData && formData.clinicalMeds) ? formData.clinicalMeds : []);

/** Lignes d'ordonnance exploitables : [{ name, posology, note, start, days, end }]. */
export const prescriptionRows = (formData) => (formData && formData.careDeceased === 'Yes' ? [] : entriesOf(formData)).filter((entry) => entry && entry.prescribed).map(prescriptionParts).filter(Boolean);

export const hasPrescription = (formData) => prescriptionRows(formData).length > 0;

const text = (value) => String(value ?? '').trim();

/** Titre du document, dans la forme des titres de rapports : « [PHMC-2752] Ordonnance - 11/11/2026 ». */
export const prescriptionTitle = (formData = {}) => `${text(formData.patientID) ? `[${text(formData.patientID)}] ` : ''}Ordonnance${frDay(text(formData.date)) ? ` - ${frDay(text(formData.date))}` : ''}`;

const durationCell = (row) => {
    if (!row.days) return '—';
    return `${row.days} jour${row.days > 1 ? 's' : ''}${row.end ? ` (jusqu'au ${frDay(row.end)})` : ''}`;
};

/** BBCode de l'ordonnance ; '' quand aucun médicament n'est sur l'ordonnance. `version` : formulaire d'origine (logo, pied de page et libellé du rapport associé). */
const generatePrescription = (formData = {}, version = 19) => {
    const rows = prescriptionRows(formData);
    if (!rows.length) return '';
    const date = frDay(text(formData.date));
    const header = careHeader({
        title: 'Ordonnance',
        pbc: isPbcVersion(version),
        lines: `PATIENT: ${escapeBbText(text(formData.patientName)) || 'N/A'}\nID PATIENT: ${text(formData.patientID) || 'N/A'}\n\nDate: ${date || 'N/A'}\n\nPrescripteur: ${escapeBbText(signedLine(formData))}`,
    });
    const body = rows.map((row) => `[tr][td] [b]${escapeBbText(row.name)}[/b]${row.note ? `\n[i]${escapeBbText(row.note)}[/i]` : ''} [/td][td] ${escapeBbText(row.posology)} [/td][td] ${row.start ? frDay(row.start) : '—'} [/td][td] ${durationCell(row)} [/td]`).join('\n');
    const label = CARE_VISIT_LABELS[Number(version)];
    const text1 = `${header}
${sectionBanner('Traitement prescrit')}
[table]
[tr][td] [b]Médicament[/b] [/td][td] [b]Posologie[/b] [/td][td] [b]Début[/b] [/td][td] [b]Durée[/b] [/td]
${body}
[/table]${label ? `\n[center][i]Ordonnance remise à la suite de : ${label}${date ? ` du ${date}` : ''}.[/i][/center]` : ''}`;
    return withPhmcFooter(text1, version);
};

export default generatePrescription;

/** Ordonnance d'un rapport enregistré ({ data, bbCodeVersion }) : { bbCode, title } ou null s'il n'en porte pas. */
export const prescriptionOfReport = (report) => {
    const data = report && report.data;
    if (!data || !hasPrescription(data)) return null;
    const version = Number(report.bbCodeVersion) || 19;
    const bbCode = generatePrescription(data, version);
    return bbCode ? { bbCode, title: prescriptionTitle(data) } : null;
};
