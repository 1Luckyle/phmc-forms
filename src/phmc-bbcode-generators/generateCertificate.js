import { frDay } from '../utils/reportTitle';
import { placeWithCity } from '../utils/places';
import { withTitle } from '../utils/patientIdentity';
import { sectionBanner, dmecHeader, infoTable, paragraph } from './shared/bbStyles';
// Placeholder utilisé pour les informations attendues mais non renseignées,
// afin que ça ressorte clairement dans le document généré (plutôt qu'un blanc
// silencieux qui pourrait passer pour un bug d'affichage).
const NOT_FILLED = 'Non renseigné';

// Certificat de décès (version 8) : en-tête à deux cellules, attestation, renseignements du défunt en tableau, signatures.
const generateCertificate = (formData) => {
    const {
        decedentName = NOT_FILLED,
        patientAge = NOT_FILLED,
        probableCauseOfDeath,
        patientDateOfBirth,
        dateofdeath,
        TimeofDeath,
        witnessName,
        coronerEmployee = NOT_FILLED,
        date = NOT_FILLED,
    } = formData;
    const patientId = String(formData.patientID || '').trim() || 'Non applicable';

    const blocks = [
        dmecHeader({
            label: 'Informations du défunt',
            name: withTitle(formData.decedentTitle, decedentName),
            detail: `ID Patient : ${patientId}`,
            title: 'CERTIFICAT DE DÉCÈS',
            subtitle: 'Département de Pathologie et de Médecine Légale',
        }),
        sectionBanner('Attestation', { size: 115 }),
        paragraph(`Je soussigné(e), [b]${coronerEmployee}[/b], au nom du Département de Pathologie et de Médecine Légale du Pillbox Hill Medical Center, dans l'État de San Andreas, documente, enregistre, scelle et certifie par la présente le décès de [b]${decedentName}[/b]. Je confirme que les informations suivantes sont exactes au meilleur de mes capacités:`),
        sectionBanner('Renseignements sur le défunt', { size: 115 }),
        infoTable([
            [['Prénom (Deuxième Prénom) & Nom', withTitle(formData.decedentTitle, decedentName) || 'INSÉRER LE PRÉNOM (DEUXIÈME PRÉNOM) & NOM DU DÉFUNT ICI'], ['ID Patient', patientId]],
            [['Âge', patientAge], ['Date de naissance', frDay(patientDateOfBirth) || 'INSÉRER LA DATE DE NAISSANCE ICI']],
            [['Date du décès', frDay(dateofdeath) || 'INSÉRER LA DATE DU DÉCÈS ICI'], ['Heure du décès', TimeofDeath || 'INSÉRER L\'HEURE DU DÉCÈS ICI']],
            [['Lieu du décès', placeWithCity(formData.placeOfDeath, formData.placeOfDeathZip) || 'INSÉRER LE LIEU DU DÉCÈS ICI']],
            [['Cause du décès', probableCauseOfDeath || 'INSÉRER LA CAUSE DU DÉCÈS ICI']],
        ]),
        sectionBanner('Signatures', { size: 115 }),
        infoTable([
            [['Signature du médecin légiste', `[i][u]${coronerEmployee}[/u][/i]`], ['Signature du témoin', `[i][u]${withTitle(formData.witnessTitle, witnessName) || 'INSÉRER LE PRÉNOM (DEUXIÈME PRÉNOM) & NOM DU TÉMOIN ICI'}[/u][/i]`]],
            [['Date d\'émission du certificat', frDay(date)]],
        ]),
        '[center][size=85]Note: Ceci est la copie originale du certificat de décès. Des copies supplémentaires peuvent être demandées moyennant des frais additionnels.[/size][/center]',
    ];

    return blocks.filter(Boolean).join('\n');
};
export default generateCertificate;
