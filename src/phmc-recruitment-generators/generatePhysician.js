// src/phmc-recruitment-generators/generatePhysician.js
const generatePhysician = (formData) => {
    const {
        // Section 1: Personal Information
        recruitmentPosition,
        applicantTitleAndFullName,
        applicantGenderOtherText, // Used if genderOther is true
        applicantAddress,
        applicantContactDetails,
        applicantMedicalConditions,

        // Section 2: Educational Background
        applicantSchoolName,
        applicantEnrollmentTerm,
        applicantMajor,
        applicantLanguages,

        // Section 3: Employment History
        applicantPrevEmployment,
        applicantPrevDuties,
        applicantPrevDismissalReason,

        // Section 4: Motivational Letter
        applicantMotivationLetter,

        // Section 5: OOC Information
        oocUcpName,
        oocForumName,
        oocDiscord,
        oocTimezone,
        oocMedicalExperience,
        oocAdminRecordLink,
        oocStatsLink,
        charBackground,

        // --- This will now come from formData, injected by App.js ---
        positionDetailsData, // Changed from phmcRecruitmentPositionDetails

        // --- Checkbox boolean fields from formData ---
        // Gender
        genderMale,
        genderFemale,
        genderOther,
        // Location
        locationPHMC,
        locationPBC,
        // Citizenship
        citizenUS,
        citizenPermanent,
        citizenNone,
        // Education
        eduHighSchool,
        eduCertificate,
        eduDiploma,
        eduAssociate,
        eduBachelor,
        eduMaster,
        eduDoctorate,
        applicantDOB,
        // Additional fields
        applicantBirthPlace

    } = formData;

    // Use the positionDetailsMap from formData (now using positionDetailsData)
    const positionDetailsMap = positionDetailsData || {}; // Changed variable name

    // Determine the dynamic display name and URL
    let dynamicDisplayPosition = "NOM DU POSTE (À DÉFINIR)";
    let dynamicJobPostingUrl = ""; // Default employment forum [Changer l'URL par défaut de l'emploi]

    if (formData.recruitmentPosition && Object.keys(positionDetailsMap).length > 0) {
        const selectedPositionKey = formData.recruitmentPosition;
        if (positionDetailsMap[selectedPositionKey]) {
            dynamicDisplayPosition = positionDetailsMap[selectedPositionKey].displayName;
            dynamicJobPostingUrl = positionDetailsMap[selectedPositionKey].url;
        } else {
            dynamicDisplayPosition = selectedPositionKey;
            // Updated console warning to reflect the new variable name
            console.warn(`Position "${selectedPositionKey}" not found in positionDetailsData from Firebase. Using default URL.`);
        }
    } else if (formData.recruitmentPosition) {
        dynamicDisplayPosition = formData.recruitmentPosition;
        // Updated console warning
        console.warn(`positionDetailsData is empty or not provided. Using default URL for "${formData.recruitmentPosition}".`);
    }

    let bbCode = `[imageleft]https://i.ibb.co/nMgfpMcv/phmc-curve.png[/imageleft] [b][size=110]Pillbox Hill Medical Center[/size][/b] 
Centre de Carrières [center][/center]
[center]Candidature pour:[/center]
[center][size=150][b]${dynamicDisplayPosition}[/b][/size][/center]
[divboxcolor=black][url=${dynamicJobPostingUrl}][color=#FF0000]>[/color] [color=#FFFFFF]Retour à l'offre d'emploi[/color][/url][/divboxcolor]
[br][/br]
[divbox=na][list=none][b][size=110][color=#FF0000]1[/color].  Informations Personnelles[/size][/b][/list]
[hr][/hr]
[list=none][b][color=#FF0000]1.1[/color]  Titre & Nom Complet:[/b] [i]${applicantTitleAndFullName || 'RÉPONSE'}[/i]
[b][color=#FF0000]1.2[/color]  Genre:[/b] [i](ajoutez un c, le cas échéant comme ceci cb[color=#FF0000][u][b]c[/b][/u][/color]) [/i]
[list=none][cb${genderMale ? 'c' : ''}] Homme
[cb${genderFemale ? 'c' : ''}] Femme
[cb${genderOther ? 'c' : ''}] Autre: ${genderOther && applicantGenderOtherText ? applicantGenderOtherText : ''}
[/list]
[b][color=#FF0000]1.3[/color] Date & Lieu de Naissance:[/b] [i]${applicantDOB || 'JJ/MMM/AAAA'} à ${applicantBirthPlace || 'Lieu de Naissance'}[/i]
[b][color=#FF0000]1.4[/color]  Adresse:[/b] [i]${applicantAddress || 'RÉPONSE'}[/i]
[b][color=#FF0000]1.5[/color]  Coordonnées:[/b] [i]${applicantContactDetails || 'RÉPONSE'}[/i]
[b][color=#FF0000]1.6[/color]  Lieu d'Emploi Souhaité:[/b] [color=#FF0000][u][b]LES POSTES SONT UNIQUEMENT OUVERT SUR LE PHMC DE LOS SANTOS[/b][/u][/color]
[list=none][cbc${locationPHMC ? 'c' : ''}] Pillbox Hill Medical Center(Ville de Los Santos)
[cb${locationPBC ? 'c' : ''}] Clinique PHMC de Paleto Bay (Paleto Bay)
[/list]
[b][color=#FF0000]1.7[/color] Avez-vous été diagnostiqué avec une condition médicale?:[/b] [i]${applicantMedicalConditions || 'RÉPONSE'}[/i]
[b][color=#FF0000]1.8[/color]  Citoyenneté:[/b]
[list=none][cb${citizenUS ? 'c' : ''}] Citoyen des États-Unis
[cb${citizenPermanent ? 'c' : ''}] Résident permanent et demande de citoyenneté en cours
[cb${citizenNone ? 'c' : ''}] Aucun des deux
[br][/br][/list][/list][/divbox]
[br][/br]
[divbox=na][list=none][b][size=110][color=#FF0000]2[/color].  Formation Académique[/size][/b][/list]
[hr][/hr]
[list=none][b][color=#FF0000]2.1[/color] Niveau d'Études le Plus Élevé:[/b]
[list=none]
[cb${eduHighSchool ? 'c' : ''}] Diplôme d’Études Secondaires (High School Diploma)
[cb${eduCertificate ? 'c' : ''}] Certificat (Sous-licence ou Professionnel/Technique)
[cb${eduDiploma ? 'c' : ''}] Diplôme (Sous-licence ou Professionnel/Technique)
[cb${eduAssociate ? 'c' : ''}] Diplôme d’Associé (Associate Degree)
[cb${eduBachelor ? 'c' : ''}] Licence/Baccalauréat (Bachelor’s Degree)
[cb${eduMaster ? 'c' : ''}] Master (Master’s Degree)
[cb${eduDoctorate ? 'c' : ''}] Doctorat (PhD)
[/list]
[b][color=#FF0000]2.2[/color] Établissement Fréquenté:[/b] 
[list=none][color=#FF0000][b]2.2.1[/color] Nom de l'Établissement:[/b]  [i]${applicantSchoolName || 'RÉPONSE'}[/i]
[color=#FF0000][b]2.2.2[/color] Période de Scolarité:[/b]  [i]${applicantEnrollmentTerm || 'jj/mm/aaaa au jj/mm/aaaa'}[/i]
[color=#FF0000][b]2.2.3[/color] Spécialisation:[/b] [i]${applicantMajor || 'RÉPONSE'}[/i]
[/list]
[b][color=#FF0000]2.3[/color] Langues Supplémentaires:[/b] [i]${applicantLanguages || 'RÉPONSE'}[/i][/list]
[br][/br][/divbox]
[divbox=na][list=none][b][size=110][color=#FF0000]3[/color].  Expérience Professionnelle[/size][/b][/list]
[hr][/hr]
[list=none][b][color=#FF0000]3.1[/color] Emploi Précédent:[/b] [i]${applicantPrevEmployment || 'POSTE chez ENTREPRISE du jj/mm/aaaa au jj/mm/aaaa'}[/i]
[b][color=#FF0000]3.2[/color] Responsabilités:[/b] [i]${applicantPrevDuties || 'RÉPONSE'}[/i]
[b][color=#FF0000]3.3[/color] Motif de Départ:[/b] [i]${applicantPrevDismissalReason || 'RÉPONSE'}[/i][/list]
[br][/br][/divbox]
[divbox=na][list=none][b][size=110][color=#FF0000]4[/color].  Lettre de Motivation[/size][/b][/list]
[hr][/hr]
[list=none][b][color=#FF0000]4.1[/color] Décrivez pourquoi vous souhaitez nous rejoindre, pourquoi nous devrions vous choisir plutôt qu'une autre personne, et pourquoi les qualités requises pour ce poste vous correspondent:[/b]
[quote][i]${applicantMotivationLetter || 'RÉPONSE ICI'}[/i][/quote][/list]
[br][/br][/divbox]
[divbox=na][list=none][b][size=110][color=#FF0000]5[/color].  (( Informations Hors Roleplay ))[/size][/b][/list]
[hr][/hr]
[list=none][b][color=#FF0000]5.1[/color] Nom d'Utilisateur UCP:[/b] [i]${oocUcpName || 'RÉPONSE'}[/i]
[b][color=#FF0000]5.2[/color] Nom sur le Forum GTA:W:[/b] [i]${oocForumName || 'RÉPONSE'}[/i]
[b][color=#FF0000]5.3[/color] Nom Discord:[/b] [i]${oocDiscord || 'RÉPONSE'}[/i]
[b][color=#FF0000]5.4[/color] Fuseau Horaire:[/b] [i]${oocTimezone || 'RÉPONSE'}[/i]
[b][color=#FF0000]5.5[/color] Avez-vous une expérience médicale réelle ou avez-vous déjà joué dans des factions médicales par le passé?:[/b] [i]${oocMedicalExperience || 'RÉPONSE'}[/i]
[b][color=#FF0000]5.6[/color] Capture d'écran [u]non modifiée[/u] de votre dossier administratif:[/b]
[list=none][altspoiler=Dossier Administratif][img]${oocAdminRecordLink || 'LIEN'}[/img][/altspoiler][/list]
[b][color=#FF0000]5.7[/color] Capture d'écran des statistiques de votre personnage (/stats) avec lequel vous postulez:[/b] 
[list=none][altspoiler=Statistiques][img]${oocStatsLink || 'LIEN'}[/img][/altspoiler][/list]
[b][color=#FF0000]5.8[/color] Background du personnage (Bref résumé):[/b]
[quote][i]${charBackground || 'RÉPONSE ICI'}[/i][/quote][/list][/divbox]
[divboxcolor=black][center][url=][color=#FF0000]>[/color] [color=#FFFFFF]Faculté Médicale[/url] |[/color]  [url=][color=#FF0000]>[/color] [color=#FFFFFF]Informations sur l'Emploi[/url] |[/color] [url=][color=#FF0000]>[/color]  [color=#FFFFFF]Guide des Visiteurs[/color][/url][/center][/divboxcolor]`
    return bbCode;
};
export default generatePhysician;
