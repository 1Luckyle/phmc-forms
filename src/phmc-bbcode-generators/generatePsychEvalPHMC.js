const generatePsychEvalPHMC = (formData) => {
    const {
        patientID,
        date,
        phmcRank,
        lastName,
        patientChiefComplaint,
        patientTriggers,
        patientStress,
        patientTreatment,
        patientFamily,
        patientJobRisks,
        patientMedicalRecord,
        patientAllergies,
        patientChronicDiseases,
        patientVisitReason,
        patientSymptoms,
        patientCondition,
        patientDrugs,
        patientDrugsUsage,
        patientMental,
        patientJob,
        patientFam,
        patientLegal,
        patientRelationship,
        patientFindings,
        patientTreatmentPlan,
        patientSafety,
        patientFollowUp,
        patientTreatmentMedicine,
        patientDiagnosis,
        patientTherapy,
        patientRiskAssessment,
        patientTherapyMedicine,
    } = formData;

    let bbCode = `[divbox=white][table][tr][td][center][br][/br][br][/br][b]Notes de session[/b]
PATIENT ${patientID}
Date: ${date}
Signé: ${phmcRank} ${lastName}
[/center][td][center][img]https://i.ibb.co/0pgw9hHm/phmc.png[/img][/center][td][center][br][/br][br][/br][size=100][b]CENTRE MÉDICAL PILLBOX HILL[/b]
ELGIN AVE. / STRAWBERRY AVE.
BP 742
LOS SANTOS, SAN ANDREAS
T: 50056[/size][/center][/table][/divbox]

[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Anamnèse[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none][u]Plainte principale: [/u][br][/br]
${patientChiefComplaint}
[br][/br]
[u]Département assigné: [/u][br][/br]
[cbc] Santé mentale
[br][/br][/list][/td][/tr][/table]

[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Problème présenté[/b][/color][/center][/divboxcolor]
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

[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Examen de l'état mental (EEM)[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none]
[u]Apparence: [/u][br][/br]
[cb${formData.Appearance === 'Good' ? 'c' : ''}] Soigné [cb${formData.Appearance === 'Disheveled' ? 'c' : ''}] Négligé [cb${formData.Appearance === 'Inappropriate' ? 'c' : ''}] Inapproprié
[br][/br]
[u]Comportement: [/u][br][/br]
[cb${formData.Behavior === 'Cooperative' ? 'c' : ''}] Coopératif [cb${formData.Behavior === 'Agitated' ? 'c' : ''}] Agité [cb${formData.Behavior === 'Withdrawn' ? 'c' : ''}] Replié
[br][/br]
[u]Élocution: [/u][br][/br]
[cb${formData.Speech === 'Normal' ? 'c' : ''}] Normale [cb${formData.Speech === 'Pressured' ? 'c' : ''}] Pressée [cb${formData.Speech === 'Slurred' ? 'c' : ''}] Indistincte [cbcb${formData.Speech === 'Slow' ? 'c' : ''}] Lente
[br][/br]
[u]Humeur: [/u][br][/br]
[cb${formData.Mood === 'Euthymic' ? 'c' : ''}] Euthymique [cb${formData.Mood === 'Depressed' ? 'c' : ''}] Déprimé [cb${formData.Mood === 'Anxious' ? 'c' : ''}] Anxieux [cb${formData.Mood === 'Angry' ? 'c' : ''}] Colérique
[br][/br]
[u]Affect: [/u][br][/br]
[cb${formData.Affect === 'Congruent' ? 'c' : ''}] Congruent [cb${formData.Affect === 'Flat' ? 'c' : ''}] Émoussé [cb${formData.Affect === 'Inappropriate' ? 'c' : ''}] Inapproprié
[br][/br]
[u]Processus de pensée: [/u][br][/br]
[cb${formData.ThoughtProcess === 'Logical' ? 'c' : ''}] Logique [cb${formData.ThoughtProcess === 'Organized' ? 'c' : ''}] Organisé [cb${formData.ThoughtProcess === 'Tangential' ? 'c' : ''}] Tangentiel [cb${formData.ThoughtProcess === 'Disorganized' ? 'c' : ''}] Désorganisé
[br][/br]
[u]Contenu de la pensée: [/u][br][/br]
[cb${formData.ThoughtContent === 'Nodelusions' ? 'c' : ''}] Pas de délires [cb${formData.ThoughtContent === 'Delusions' ? 'c' : ''}] Délires [cb${formData.ThoughtContent === 'Hallucinations' ? 'c' : ''}] Hallucinations [cb${formData.ThoughtContent === 'Suicidal' ? 'c' : ''}] Pensées suicidaires [cb${formData.ThoughtContent === 'Homicidal' ? 'c' : ''}] Pensées homicidaires
[br][/br]
[u]Perspicacité et jugement: [/u][br][/br]
[cb${formData.Insight === 'Intact' ? 'c' : ''}] Intact [cb${formData.Insight === 'Limited' ? 'c' : ''}] Limité [cb${formData.Insight === 'Poor' ? 'c' : ''}] Pauvre
[br][/br]
[u]Cognition: [/u][br][/br]
[cb${formData.Cognition === 'Oriented' ? 'c' : ''}] Orienté dans le temps, l'espace, la personne [cb${formData.Cognition === 'Memory' ? 'c' : ''}] Mémoire intacte [cb${formData.Cognition === 'Attention' ? 'c' : ''}] Attention intacte
[/list][/td][/tr][/table]

[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Antécédents psychiatriques[/b][/color][/center][/divboxcolor]
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

[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Antécédents médicaux[/b][/color][/center][/divboxcolor]
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

[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Antécédents de consommation de substances[/b][/color][/center][/divboxcolor]
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

[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Antécédents psychosociaux[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none]
[u]Enfance et contexte familial: [/u][br][/br]
${patientFam}
[br][/br]
[u]Parcours éducatif et professionnel: [/u][br][/br]
${patientJob}
[br][/br]
[u]Relations et système de soutien: [/u][br][/br]
${patientRelationship}
[br][/br]
[u]Problèmes juridiques: [/u][br][/br]
${patientLegal}
[/list][/td][/tr][/table]

[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Évaluation des risques[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none]
[cb${formData.Risk === 'Suicidal' ? 'c' : ''}] Idées ou tentatives suicidaires [cb${formData.Risk === 'Homicidal' ? 'c' : ''}] Pensées homicidaires ou comportement violent [cb${formData.Risk === 'Self' ? 'c' : ''}] Automutilation ou danger pour autrui
[br][/br]
[u]Détails: [/u][br][/br]
${patientRiskAssessment}
[/list][/td][/tr][/table]

[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Constatations[/b][/color][/center][/divboxcolor]
[table][tr][td][list=none]
Notes: ${patientFindings}
[/list][/td][/tr][/table]

[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Diagnostic de sortie[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none]
[u]Diagnostic primaire: [/u][br][/br]
${patientDiagnosis}
[/list][/td][/tr][/table]

[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Thérapie[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none][u]Admission: [/u][br][/br]
[cb${formData.admission === 'Yes' ? 'c' : ''}] Oui [cb${formData.admission === 'No' ? 'c' : ''}] Non
[br][/br]
[u]Plan de traitement: [/u][br][/br]
${patientTreatmentPlan}
[br][/br]
[u]Médicaments: [/u][br][/br]
${patientTherapyMedicine}
[br][/br]
[u]Suivi: [/u][br][/br]
[cb${formData.followup === 'AsNeeded' ? 'c' : ''}] Au besoin [cb${formData.followup === 'Recommended' ? 'c' : ''}] Recommandé

[/list][/td][/tr][/table]

[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Plan de traitement/Recommandations[/b][/color][/center][/divboxcolor]
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