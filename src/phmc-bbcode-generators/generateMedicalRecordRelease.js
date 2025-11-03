const generateMedicalRecordRelease = (formData) => {
    const {
        patientFirstName,
        patientMiddleName,
        patientLastName,
        patientPH,
        patientDateOfBirth,
        patientAddress,
        patientZIP,
        patientEmail,
        patientMedInfoReleaseOther,
        phmcEmployee,
        MedicalRecordsReleaseOther,
        patientMedInfoFormatOther,
        StupidDateFrom,
        StupidDateTo,
        SubmitDate,
        paymentProofPhotos,
        MedicalRecordsRelease,
        payNow,
    } = formData;

    const calculateCost = () => {
        const selectedCount = MedicalRecordsRelease?.length || 0;
        if (selectedCount === 0) {
            return 0;
        }
        const costPerItem = 5000;
        return selectedCount * costPerItem;
    };
    const approximateCost = calculateCost();
    const firstPaymentProofUrl = (paymentProofPhotos || '').split(',')[0].trim();
    const patientFullName = `${patientFirstName || ''} ${patientMiddleName || ''} ${patientLastName || ''}`.replace(/\s+/g, ' ').trim(); // Combine and clean up spaces

    let bbCode = `[divbox=white] [center] [img]https://i.ibb.co/0pgw9hHm/phmc.png[/img] [/center] [/divbox]
[divbox=white]
[br][/br][color=#800000][size=150][b]I. INFORMATIONS DU PATIENT[/b][/size][/color][hr][/hr]
[list=none][b]Titre:[/b] [i](sélectionnez-en un)[/i]
[list=none][${formData.patientTitle === 'Mineur' ? 'x' : ''}] Mineur
[*][${formData.patientTitle === 'Mr' ? 'x' : ''}] M.
[*][${formData.patientTitle === 'Mrs' ? 'x' : ''}] Mme
[*][${formData.patientTitle === 'Ms' ? 'x' : ''}] Mlle
[*][${formData.patientTitle === 'Other' ? 'x' : ''}] Autre[/list]
[b]Prénom:[/b]
[i]${patientFirstName}[/i][br][/br]
[b]Deuxième prénom:[/b] [i](optionnel)[/i]
[i]${patientMiddleName}[/i][br][/br]
[b]Nom de famille:[/b]
[i]${patientLastName}[/i][br][/br]
[b]Genre à l'état civil :[/b] [i](sélectionnez-en un)[/i]
[list=none]
[*][${formData.patientGender === 'Male' ? 'X' : ''}] Masculin
[*][${formData.patientGender === 'Female' ? 'X' : ''}] Féminin[/list]
[b]Date de naissance:[/b]
[i]${patientDateOfBirth}[/i][br][/br]
[b]Adresse:[/b]
[i]${patientAddress}[/i][br][/br]
[b]Code postal:[/b]
[i]${patientZIP}[/i][br][/br][/list]
[br][/br][color=#800000][size=150][b]II. COORDONNÉES[/b][/size][/color][hr][/hr]
[list=none]
[b]Type de téléphone:[/b] [i](sélectionnez-en un)[/i]
[list=none]
[*][${formData.patientPhoneType === 'Mobile' ? 'X' : ''}] Mobile
[*][${formData.patientPhoneType === 'Home' ? 'X' : ''}] Domicile
[*][${formData.patientPhoneType === 'Work' ? 'X' : ''}] Travail
[*][${formData.patientPhoneType === 'Other' ? 'X' : ''}] Autre[/list][b]Numéro de téléphone:[/b]
[i]${patientPH}[/i][br][/br]
[b]Courriel:[/b]
[i]${patientEmail}[/i][br][/br][/list]
[br][/br][color=#800000][size=150][b]III. INFORMATIONS DE DIVULGATION[/b][/size][/color][hr][/hr]
[list=none][b]Motif de la divulgation des informations médicales:[/b]
[list=none]
[*][${formData.CarePurposeMedicalInformationRelease === 'Further Treatment' ? 'X' : ''}] Traitement ultérieur / Suite de soins
[*][${formData.CarePurposeMedicalInformationRelease === 'Personal' ? 'X' : ''}] Usage personnel
[*][${formData.CarePurposeMedicalInformationRelease === 'Attorney' ? 'X' : ''}] Avocat / Client
[*][${formData.CarePurposeMedicalInformationRelease === 'Other' ? 'X' : ''}] Autre: ${patientMedInfoReleaseOther}[/list][/list]
[list=none][b]Format de divulgation des informations médicales:[/b]
[list=none]
[*][${formData.PurposeMedicalInformationReleaseFormat === 'CopyofRecords' ? 'X' : ''}] Copie du dossier à récupérer
[*][${formData.PurposeMedicalInformationReleaseFormat === 'VerbalRelease' ? 'X' : ''}] Divulgation verbale (ex: conversation téléphonique)
[*][${formData.PurposeMedicalInformationReleaseFormat === 'ElectronicRelease' ? 'X' : ''}] Divulgation électronique (envoyée par courriel)
[*][${formData.PurposeMedicalInformationReleaseFormat === 'Other' ? 'X' : ''}] Autre: ${patientMedInfoFormatOther}[/list][/list]
[list=none][b]Période concernée:[/b]
[i]J'autorise la divulgation des informations couvrant la ou les période(s) de traitement:[/i]
[list=none]
[*][b]Du:[/b] [i]${StupidDateFrom}[/i]    
[*][b]Au:[/b] [i]${StupidDateTo}[/i][/list][/list]
[list=none][b]Dossiers médicaux à divulguer:[/b] [i](cochez tout ce qui s'applique)[/i]
[list=none]
[*][${formData.MedicalRecordsRelease?.includes('ERVisit') ? 'X' : ''}] [b]Visite aux urgences[/b] (Notes des urgences, notes d'évolution, consultations, notes de procédure, résultats de tests)
[*][${formData.MedicalRecordsRelease?.includes('HospitalStay') ? 'X' : ''}] [b]Séjour hospitalier[/b] (Anamnèse et examen physique, notes d'évolution, consultations, rapports opératoires, résumé de sortie, résultats de tests)
[*][${formData.MedicalRecordsRelease?.includes('Outpatient') ? 'X' : ''}] [b]Chirurgie/Procédure ambulatoire[/b] (Anamnèse et examen physique, notes d'évolution, consultations, notes de procédure, résultats de tests)
[*][${formData.MedicalRecordsRelease?.includes('OfficeClinic') ? 'X' : ''}] [b]Visite à la clinique, au cabinet ou soins immédiats[/b] (Notes de bureau, notes d'évolution, notes de procédure, résultats de tests)
[*][${formData.MedicalRecordsRelease?.includes('PsychologyVisits') ? 'X' : ''}] [b]Visites de psychologie[/b] (Notes de bureau, notes d'évolution, notes de procédure, résultats d'évaluation)
[*][${formData.MedicalRecordsRelease?.includes('Other') ? 'X' : ''}] [b]Autres dossiers:[/b] ${MedicalRecordsReleaseOther}[/list][/list]
[list=none][b]Nom du praticien consulté:[/b]
[i]${phmcEmployee}[/i]
[br][/br][/list]
[color=#800000][size=150][b]IV. AUTORISATION DE DIVULGATION DES INFORMATIONS[/b][/size][/color][hr][/hr][br][/br]
[list=none]Je soussigné(e), ${patientFirstName} ${patientMiddleName} ${patientLastName}, autorise par la présente le Pillbox Hill Medical Center à divulguer mes informations de santé individuellement identifiables. Je comprends que cette autorisation est volontaire et que je peux refuser de signer cette autorisation. Je comprends également que mes soins de santé ne seront pas affectés si je ne signe pas ce formulaire.

Je soussigné(e), ${patientFirstName} ${patientMiddleName} ${patientLastName}, comprends que si le destinataire autorisé à recevoir les informations n'est pas une entité couverte, les informations divulguées peuvent ne plus être protégées par les réglementations fédérales et étatiques sur la vie privée.

Je soussigné(e), ${patientFirstName} ${patientMiddleName} ${patientLastName}, comprends en outre que je peux révoquer cette autorisation à tout moment en avisant par écrit l'établissement du Pillbox Hill Medical Center où cette autorisation est signée. Je comprends également que la révocation doit être signée et datée d'une date postérieure à celle figurant sur cette autorisation. La révocation n'affectera pas les divulgations effectuées avant la réception de la révocation écrite.

Je soussigné(e), ${patientFirstName} ${patientMiddleName} ${patientLastName}, comprends que le dossier peut ne pas être complet s'il s'agit d'une visite récente, et qu'une documentation supplémentaire pourrait être ajoutée après la soumission de cette demande.

En tapant mon nom ci-dessous, je soussigné(e), ${patientFirstName} ${patientMiddleName} ${patientLastName}, certifie que ces informations peuvent être utilisées dans le but de traiter ma demande d'autorisation de divulgation de dossiers médicaux. Je considère ceci comme ma signature électronique pour cette demande.
[br][/br]
[/list]
[list=none][b]Signature:[/b] 
[i]${patientFirstName} ${patientMiddleName} ${patientLastName}[/i][br][/br]
[b]Date:[/b]
[i]${SubmitDate}[/i]
${(payNow === true || payNow === 'true') && approximateCost > 0 ? `
    Je soussigné(e), ${patientFullName || 'le soussigné'}, joins ce paiement de ${approximateCost.toLocaleString()}$ pour les frais de divulgation des dossiers médicaux. ${firstPaymentProofUrl ? `[url=${firstPaymentProofUrl}]Image jointe[/url]` : '[i][/i]'}` : ''}
[/list]
    [/divbox]`; // <-- Moved the closing divbox tag here
    return bbCode;
};
export default generateMedicalRecordRelease;