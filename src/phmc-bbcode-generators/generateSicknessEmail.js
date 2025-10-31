// src/phmc-bbcode-generators/generateSicknessEmail.js

const generateSicknessEmail = (formData) => {
    const {
        emailPurpose, // 'Sickness Note' or 'Illness Confirmation'
        emailRecipient, // Name of the person/entity receiving the email
        patientName, // Name of the patient
        dateOfVisit, // Date patient was seen at PHMC
        sicknessStartDate, // Start date of sickness (for Sickness Note)
        sicknessEndDate, // End date of sickness (for Sickness Note)
        reasonForSickness, // Brief reason for sickness (for Sickness Note)
        illnessCondition, // Diagnosed illness/condition (for Illness Confirmation)
        confirmationPurpose, // Purpose of confirmation (for Illness Confirmation)
        phmcEmployee, // The PHMC employee sending the email
        phmcRank, // Rank of the PHMC employee
        phmcEmployeeDepartment, // Department of the PHMC employee
        phmcEmployeeSignatureImage, // Signature image URL
        attachedReportSummary,
    } = formData;

    let subject = '';
    let emailBody = '';

    const formattedDateOfVisit = dateOfVisit ? new Date(dateOfVisit).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A';

    if (emailPurpose === 'Sickness Note') {
        subject = `RE: Certificat médical pour ${patientName || 'Patient'}`;
        emailBody = `Cher(ère) ${emailRecipient || 'Destinataire'},

Ce courriel sert de certificat médical pour ${patientName || 'le patient'} du ${sicknessStartDate || 'N/A'} au ${sicknessEndDate || 'N/A'}.

${patientName || 'Le patient'} a été vu au Pillbox Hill Medical Center le ${formattedDateOfVisit} et a reçu conseil de se reposer en raison de ${reasonForSickness || 'une condition médicale'}.

Nous anticipons que ${patientName || 'il/elle'} pourra reprendre ses activités normales après la période spécifiée.

N'hésitez pas à nous contacter si vous avez besoin d'informations supplémentaires.`;
    } else if (emailPurpose === 'Illness Confirmation') {
        subject = `RE: Confirmation de maladie pour ${patientName || 'Patient'}`;
        emailBody = `Cher(ère) ${emailRecipient || 'Destinataire'},

Ce courriel confirme que ${patientName || 'le patient'} a été vu au Pillbox Hill Medical Center le ${formattedDateOfVisit}.

${patientName || 'Le patient'} a été diagnostiqué avec ${illnessCondition || 'une condition médicale'}. Cette confirmation est fournie pour ${confirmationPurpose || 'ses dossiers'}.

N'hésitez pas à nous contacter si vous avez besoin d'informations supplémentaires.`;
    } else {
        subject = 'Courriel PHMC - Objet manquant';
        emailBody = 'Veuillez sélectionner un objet de courriel (Certificat médical ou Confirmation de maladie).';
    }
    const reportSection = attachedReportSummary
        ? `\n\n[b]Résumé du rapport médical joint:[/b]\n[altspoiler=Résumé du rapport médical][quote]${attachedReportSummary}[/quote][/altspoiler]`
        : '';

    const signatureBBCode = phmcEmployeeSignatureImage ? `[img]${phmcEmployeeSignatureImage.trim()}[/img]` : '';

    const bbCode = `[divbox=na][br][/br][imageleft]https://i.ibb.co/nMgfpMcv/phmc-curve.png[/imageleft] [b][size=110]Centre Médical Pillbox Hill[/size][/b] 
[center][/center][br][/br]
[center][size=130][/center][/size]
[center][size=150][b]${subject}[/b][/size][/center]

[hr][/hr][br][/br][list=none]
${emailBody}

${reportSection}

Respectueusement soumis,
${signatureBBCode} 
[/list][hr][/hr][list=none]
[b][size=105]${phmcEmployee || 'Employé PHMC'}[/size][/b]
[size=85]${phmcRank || 'N/A'}
[/size]

[b]Centre Médical Pillbox Hill[/b]
[size=85]Elgin Avenue/Strawberry Avenue, Pillbox Hill, Los Santos, SA
Téléphone: 50056
Courriel: [url=https://phmc.gta.world/ucp.php?i=pm&mode=compose&g=40]info@phmc.health[/url]
Site web: [url=https://phmc.gta.world/index.php]www.phmc.health[/url]

Suivez-nous sur Facebrowser: [url=https://face.gta.world/pages/PHMC?ref=qs]Centre Médical Pillbox Hill[/url][/size]

[size=70][i]Le contenu de ce message et de toute pièce jointe est confidentiel. Ils sont destinés uniquement au(x) destinataire(s) nommé(s). Si vous avez reçu ce courriel par erreur, veuillez en informer l'expéditeur immédiatement et ne pas divulguer le contenu à quiconque ni en faire de copies.[/i][/size][/divbox]`;

    return bbCode;
};

export default generateSicknessEmail;
