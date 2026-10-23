import { buildPatientContextBBCode } from './shared/patientContext';
import { checkbox, phmcHeaderEnd, sectionBanner } from './shared/bbStyles';
// Placeholder utilisé pour les informations attendues mais non renseignées,
// afin que ça ressorte clairement dans le document généré (plutôt qu'un blanc
// silencieux qui pourrait passer pour un bug d'affichage).
const NOT_FILLED = 'Non renseigné';

const generatePsychEvalPHMC = (formData) => {
    const {
        patientName = NOT_FILLED,
        patientID = '',
        date = NOT_FILLED,
        phmcRank = NOT_FILLED,
        lastName = NOT_FILLED,
        patientChiefComplaint = NOT_FILLED,
        patientTriggers = NOT_FILLED,
        patientStress = NOT_FILLED,
        patientTreatment = NOT_FILLED,
        patientFamily = NOT_FILLED,
        patientJobRisks = NOT_FILLED,
        patientMedicalRecord = NOT_FILLED,
        patientAllergies = NOT_FILLED,
        patientChronicDiseases = NOT_FILLED,
        patientVisitReason = NOT_FILLED,
        patientSymptoms = NOT_FILLED,
        patientCondition = NOT_FILLED,
        patientDrugs = NOT_FILLED,
        patientDrugsUsage = NOT_FILLED,
        patientMental = NOT_FILLED,
        patientJob = NOT_FILLED,
        patientFam = NOT_FILLED,
        patientLegal = NOT_FILLED,
        patientRelationship = NOT_FILLED,
        patientFindings = NOT_FILLED,
        patientTreatmentPlan = NOT_FILLED,
        patientSafety = NOT_FILLED,
        patientFollowUp = NOT_FILLED,
        patientTreatmentMedicine = NOT_FILLED,
        patientDiagnosis = NOT_FILLED,
        patientTherapy = NOT_FILLED,
        patientRiskAssessment = NOT_FILLED,
        patientTherapyMedicine = NOT_FILLED,
    } = formData;

    let bbCode = `[divbox=white][table][tr][td][center][br][/br][br][/br][b]Notes de session[/b]
PATIENT ${patientName}${patientID ? ` (ID: ${patientID})` : ''}
Date: ${date}
Signé: ${phmcRank} ${lastName}
${phmcHeaderEnd()}

${buildPatientContextBBCode(formData, { accentColor: '#FF0000', showHistory: false })}${sectionBanner(`Anamnèse`)}
[table][tr][td][left][list=none][u]Plainte principale: [/u][br][/br]
${patientChiefComplaint}
[br][/br]
[u]Département assigné: [/u][br][/br]
[cbc] Santé mentale
[br][/br][/list][/td][/tr][/table]

${sectionBanner(`Problème présenté`)}
[table][tr][td][left][list=none][u]Description du problème (ex: anxiété, dépression, psychose): [/u][br][/br]
${patientVisitReason}
[br][/br]
[u]Apparition et durée des symptômes: [/u][br][/br]
${patientSymptoms}
[br][/br]
[u]Déclencheurs ou facteurs de stress: [/u][br][/br]
${patientTriggers}
[br][/br]
[u]Impact sur la vie quotidienne: [/u][br][/br]
${patientStress}
[/list][/td][/tr][/table]

${sectionBanner(`Examen de l'état mental (EEM)`)}
[table][tr][td][left][list=none]
[u]Apparence: [/u][br][/br]
${checkbox(formData.Appearance === 'Good')} Soigné ${checkbox(formData.Appearance === 'Disheveled')} Négligé ${checkbox(formData.Appearance === 'Inappropriate')} Inapproprié
[br][/br]
[u]Comportement: [/u][br][/br]
${checkbox(formData.Behavior === 'Cooperative')} Coopératif ${checkbox(formData.Behavior === 'Agitated')} Agité ${checkbox(formData.Behavior === 'Withdrawn')} Replié
[br][/br]
[u]Élocution: [/u][br][/br]
${checkbox(formData.Speech === 'Normal')} Normale ${checkbox(formData.Speech === 'Pressured')} Pressée ${checkbox(formData.Speech === 'Slurred')} Indistincte ${checkbox(formData.Speech === 'Slow')} Lente
[br][/br]
[u]Humeur: [/u][br][/br]
${checkbox(formData.Mood === 'Euthymic')} Euthymique ${checkbox(formData.Mood === 'Depressed')} Déprimé ${checkbox(formData.Mood === 'Anxious')} Anxieux ${checkbox(formData.Mood === 'Angry')} Colérique
[br][/br]
[u]Aspect: [/u][br][/br]
${checkbox(formData.Affect === 'Congruent')} Congruent ${checkbox(formData.Affect === 'Flat')} Émoussé ${checkbox(formData.Affect === 'Inappropriate')} Inapproprié
[br][/br]
[u]Processus de pensée: [/u][br][/br]
${checkbox(formData.ThoughtProcess === 'Logical')} Logique ${checkbox(formData.ThoughtProcess === 'Organized')} Organisé ${checkbox(formData.ThoughtProcess === 'Tangential')} Tangentiel ${checkbox(formData.ThoughtProcess === 'Disorganized')} Désorganisé
[br][/br]
[u]Contenu de la pensée: [/u][br][/br]
${checkbox(formData.ThoughtContent === 'Nodelusions')} Pas de délires ${checkbox(formData.ThoughtContent === 'Delusions')} Délires ${checkbox(formData.ThoughtContent === 'Hallucinations')} Hallucinations ${checkbox(formData.ThoughtContent === 'Suicidal')} Pensées suicidaires ${checkbox(formData.ThoughtContent === 'Homicidal')} Pensées homicidaires
[br][/br]
[u]Perspicacité et jugement: [/u][br][/br]
${checkbox(formData.Insight === 'Intact')} Intact ${checkbox(formData.Insight === 'Limited')} Limité ${checkbox(formData.Insight === 'Poor')} Pauvre
[br][/br]
[u]Cognition: [/u][br][/br]
${checkbox(formData.Cognition === 'Oriented')} Orienté dans le temps, l'espace, la personne ${checkbox(formData.Cognition === 'Memory')} Mémoire intacte ${checkbox(formData.Cognition === 'Attention')} Attention intacte
[/list][/td][/tr][/table]

${sectionBanner(`Antécédents psychiatriques`)}
[table][tr][td][left][list=none]
[u]Diagnostics et traitements psychiatriques passés: [/u][br][/br]
${patientTreatment}
[br][/br]
[u]Hospitalisations: [/u][br][/br]
${patientMedicalRecord}
[br][/br]
[u]Antécédents psychiatriques familiaux: [/u][br][/br]
${patientFamily}
[br][/br]
[u]Antécédents d'automutilation ou de tentatives de suicide: [/u][br][/br]
${patientJobRisks}
[/list][/td][/tr][/table]

${sectionBanner(`Antécédents médicaux`)}
[table][tr][td][left][list=none]
[u]Conditions médicales actuelles et passées: [/u][br][/br]
${patientCondition}
[br][/br]
[u]Médicaments (y compris psychiatriques et non psychiatriques): [/u][br][/br]
${patientChronicDiseases}
[br][/br]
[u]Allergies: [/u][br][/br]
${patientAllergies}
[/list][/td][/tr][/table]

${sectionBanner(`Antécédents de consommation de substances`)}
[table][tr][td][left][list=none]
[u]Utilisation d'alcool, drogues, nicotine et autres substances: [/u][br][/br]
${patientDrugs}
[br][/br]
[u]Fréquence et durée d'utilisation: [/u][br][/br]
${patientDrugsUsage}
[br][/br]
[u]Impact sur la santé mentale: [/u][br][/br]
${patientMental}
[/list][/td][/tr][/table]

${sectionBanner(`Antécédents psychosociaux`)}
[table][tr][td][left][list=none]
[u]Enfance et contexte familial: [/u][br][/br]
${patientFam}
[br][/br]
[u]Parcours éducatif et professionnel: [/u][br][/br]
${patientJob}
[br][/br]
[u]Relations et système de soutien social: [/u][br][/br]
${patientRelationship}
[br][/br]
[u]Problèmes juridiques: [/u][br][/br]
${patientLegal}
[/list][/td][/tr][/table]

${sectionBanner(`Évaluation des risques`)}
[table][tr][td][left][list=none]
${checkbox(formData.Risk === 'Suicidal')} Idées ou tentatives suicidaires ${checkbox(formData.Risk === 'Homicidal')} Pensées homicidaires ou comportement violent ${checkbox(formData.Risk === 'Self')} Automutilation ou danger pour autrui
[br][/br]
[u]Détails: [/u][br][/br]
${patientRiskAssessment}
[/list][/td][/tr][/table]

${sectionBanner(`Constatations`)}
[table][tr][td][list=none]
Notes: ${patientFindings}
[/list][/td][/tr][/table]

${sectionBanner(`Diagnostic de sortie`)}
[table][tr][td][left][list=none]
[u]Diagnostic primaire: [/u][br][/br]
${patientDiagnosis}
[/list][/td][/tr][/table]

${sectionBanner(`Thérapie`)}
[table][tr][td][left][list=none][u]Admission: [/u][br][/br]
${checkbox(formData.admission === 'Yes')} Oui ${checkbox(formData.admission === 'No')} Non
[br][/br]
[u]Plan de traitement: [/u][br][/br]
${patientTreatmentPlan}
[br][/br]
[u]Médicaments: [/u][br][/br]
${patientTherapyMedicine}
[br][/br]
[u]Suivi: [/u][br][/br]
${checkbox(formData.followup === 'AsNeeded')} Au besoin ${checkbox(formData.followup === 'Recommended')} Recommandé ${checkbox(formData.followup === 'Electiveprocedure')} Procédure élective (Non-urgent / Non-planifié)

[/list][/td][/tr][/table]

${sectionBanner(`Plan de traitement/Recommandations`)}
[table][tr][td][left][list=none]
[u]Médicaments: [/u][br][/br]
${patientTreatmentMedicine}
[br][/br]
[u]Thérapie (ex: TCC, TCD): [/u][br][/br]
${patientTherapy}
[br][/br]
[u]Rendez-vous de suivi: [/u][br][/br]
${patientFollowUp}
[br][/br]
[u]Planification de la sécurité (si à risque): [/u][br][/br]
${patientSafety}
[/list][/td][/tr][/table]`
    return bbCode;
    };
export default generatePsychEvalPHMC;