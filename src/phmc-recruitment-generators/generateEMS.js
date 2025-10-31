const generateEMS = (formData) => {
    const {
        // Section 1: Informations personnelles
        recruitmentPosition,
        applicantTitleAndFullName,
        applicantGenderOtherText,
        applicantDOBAndPlace,
        applicantAddress,
        applicantContactDetails,
        applicantMedicalConditions,

        // Section 2: Parcours éducatif
        applicantSchoolName,
        applicantEnrollmentTerm,
        applicantMajor,
        applicantLanguages,

        // Section 3: Historique d'emploi (Utilisé pour Ambulancier & Technicien médical d'urgence)
        applicantPrevEmployment,
        applicantPrevDuties,
        applicantPrevDismissalReason,

        // Section 4: Lettre de motivation (Utilisée pour Ambulancier & Technicien médical d'urgence)
        applicantMotivationLetter,

        // Section 5: Informations HRP
        oocUcpName,
        oocForumName,
        oocDiscord,
        oocTimezone,
        oocMedicalExperience, // Utilisé dans toutes les sections HRP maintenant
        oocAdminRecordLink,
        oocStatsLink,
        charBackground,
        // Genre
        genderMale,
        genderFemale,
        genderOther,
        // Citoyenneté
        citizenUS,
        citizenPermanent,
        citizenNone,
        // Éducation
        eduHighSchool,
        eduCertificate,
        eduDiploma,
        eduAssociate,
        eduBachelor,
        eduMaster,
        eduDoctorate,

        // Détails de poste spécifiques EMS depuis formData
        //positionDetailsData, // MODIFIÉ: Changé de emsPositionDetailsData
        selectOptions,

        // Champs pour les EMS non-Ambulancier/non-Technicien médical d'urgence (structure originale pour Section 3)
        emsLicenseLink,
        emsPartTimeReason,
        oocOtherFactionDfpLfm,

    } = formData;

    // Utiliser les détails de poste spécifiques EMS
    const positionDetailsMap = selectOptions?.emsPositionDetailsData || {};
    console.log("DEBUG: positionDetailsMap in generateEMS.js:", positionDetailsMap);

    let dynamicDisplayPosition = "Position (Veuillez sélectionner)";
    let dynamicJobPostingUrl = "https://phmc.gta.world/viewforum.php?f=168";

    if (recruitmentPosition && Object.keys(positionDetailsMap).length > 0) {
        const selectedPositionKey = recruitmentPosition.toUpperCase();
        if (positionDetailsMap[selectedPositionKey]) {
            console.log(`positionDetailsMap[${selectedPositionKey}]`, positionDetailsMap[selectedPositionKey]);
            dynamicDisplayPosition = positionDetailsMap[selectedPositionKey].displayName || selectedPositionKey;
            dynamicJobPostingUrl = positionDetailsMap[selectedPositionKey].url || dynamicJobPostingUrl;
        } else {
            dynamicDisplayPosition = selectedPositionKey;
            // Ce console.warn fera maintenant correctement référence au nom de la source de données
            console.warn(`Position EMS "${selectedPositionKey}" non trouvée dans positionDetailsMap. Utilisation de l'URL par défaut.`);
        }
    } else if (recruitmentPosition) {
        dynamicDisplayPosition = recruitmentPosition;
        // Ce console.warn fera maintenant correctement référence au nom de la source de données
        console.warn(`positionDetailsMap est vide ou non fourni. Utilisation de l'URL par défaut pour "${recruitmentPosition}".`);
    }

    const eduCheck = (field) => field ? 'c' : '';
    let sections3onwardsBBCode = '';

    // ... le reste de votre logique generateEMS.js reste identique ...
    // (commonSections3And4, blocs if/else if pour Ambulancier, Technicien médical d'urgence, Stagiaire technicien médical d'urgence, Autre EMS)

    const commonSections3And4 = `[divbox=na][list=none][b][size=110][color=#FF0000]3[/color].  Historique d'emploi[/size][/b][/list]
[hr][/hr]
[list=none][b][color=#FF0000]3.1[/color] Emploi précédent:[/b] [i]${applicantPrevEmployment || 'POSTE chez ENTREPRISE entre JJ/MMM/AAAA et JJ/MMM/AAAA'}[/i]
[b][color=#FF0000]3.2[/color] Fonctions:[/b] [i]${applicantPrevDuties || 'RÉPONSE'}[/i]
[b][color=#FF0000]3.3[/color] Raison du licenciement:[/b] [i]${applicantPrevDismissalReason || 'RÉPONSE'}[/i][/list]
[br][/br][/divbox]
[divbox=na][list=none][b][size=110][color=#FF0000]4[/color].  Lettre de motivation[/size][/b][/list]
[hr][/hr]
[list=none][b][color=#FF0000]4.1[/color] Soumettez votre lettre de motivation, décrivant pourquoi vous souhaitez nous rejoindre, pourquoi nous devrions vous choisir plutôt que quelqu'un d'autre, et pourquoi les qualités requises pour ce poste vous correspondent :[/b] i[/i]
[quote][i]${applicantMotivationLetter || 'RÉPONSE ICI'}[/i][/quote][/list]
[br][/br][/divbox]`;

    if (recruitmentPosition === "Paramedic") {
        sections3onwardsBBCode = commonSections3And4 +
`[divbox=na][list=none][b][size=110][color=#FF0000]5[/color].  (( Informations hors personnage ))[/size][/b][/list]
[hr][/hr]
[list=none][b][color=#FF0000]5.1[/color] Nom d'utilisateur du panneau de contrôle utilisateur (UCP):[/b] [i]${oocUcpName || 'RÉPONSE'}[/i]
[b][color=#FF0000]5.2[/color] Nom du compte forum GTA:W:[/b] [i]${oocForumName || 'RÉPONSE'}[/i]
[b][color=#FF0000]5.3[/color] Nom Discord:[/b] [i]${oocDiscord || 'RÉPONSE'}[/i]
[b][color=#FF0000]5.4[/color] Fuseau horaire:[/b] [i]${oocTimezone || 'RÉPONSE'}[/i]
[b][color=#FF0000]5.5[/color] Avez-vous une expérience médicale réelle ou avez-vous fait du roleplay dans des factions médicales par le passé ?:[/b] [i]${oocMedicalExperience || 'RÉPONSE'}[/i]
[b][color=#FF0000]5.6[/color] Capture d'écran [u]non éditée[/u] de votre dossier administrateur avec la date et l'heure actuelles affichées:[/b]
[list=none][altspoiler=Dossier administrateur][img]${oocAdminRecordLink || 'LIEN'}[/img][/altspoiler][/list]
[b][color=#FF0000]5.7[/color] Fournissez une capture d'écran des statistiques de votre personnage (/stats) avec lequel vous postulez:[/b] 
[list=none][altspoiler=Statistiques][img]${oocStatsLink || 'LIEN'}[/img][/altspoiler][/list]
[b][color=#FF0000]5.8[/color] Fournissez l'histoire de votre personnage:[/b]
[quote][i]${charBackground || 'RÉPONSE ICI'}[/i][/quote][/list][/divbox]`;
    } else if (recruitmentPosition === "EMT") { // Technicien médical d'urgence régulier
        const oocFieldsBBCode = `[b][color=#FF0000]5.1[/color] Nom d'utilisateur du panneau de contrôle utilisateur (UCP):[/b] [i]${oocUcpName || 'RÉPONSE'}[/i]
[b][color=#FF0000]5.2[/color] Capture d'écran [u]non éditée[/u] de votre dossier administrateur:[/b]
[list=none][altspoiler=Dossier administrateur][img]${oocAdminRecordLink || 'LIEN'}[/img][/altspoiler][/list]
[b][color=#FF0000]5.3[/color] Nom du compte forum GTA:W:[/b] [i]${oocForumName || 'RÉPONSE'}[/i]
[b][color=#FF0000]5.4[/color] Nom Discord:[/b] [i]${oocDiscord || 'RÉPONSE'}[/i]
[b][color=#FF0000]5.5[/color] Fuseau horaire:[/b] [i]${oocTimezone || 'RÉPONSE'}[/i]
[b][color=#FF0000]5.6[/color] Avez-vous une expérience médicale réelle ou avez-vous fait du roleplay dans des factions médicales par le passé ?:[/b] [i]${oocMedicalExperience || 'RÉPONSE'}[/i]
[b][color=#FF0000]5.7[/color] Fournissez une capture d'écran des statistiques de votre personnage (/stats) avec lequel vous postulez:[/b] 
[list=none][altspoiler=Statistiques][img]${oocStatsLink || 'LIEN'}[/img][/altspoiler][/list]
[b][color=#FF0000]5.8[/color] Fournissez l'histoire de votre personnage:[/b]
[quote][i]${charBackground || 'RÉPONSE ICI'}[/i][/quote]`;

        sections3onwardsBBCode = commonSections3And4 +
    `[divbox=na][list=none][b][size=110][color=#FF0000]5[/color].  (( Informations hors personnage ))[/size][/b][/list]
[hr][/hr]
[list=none]${oocFieldsBBCode}[/list][/divbox]`;
    } else if (recruitmentPosition === "EMT Trainee") { // Stagiaire technicien médical d'urgence - HRP commence à la section 4
        sections3onwardsBBCode = `[divbox=na][list=none][b][size=110][color=#FF0000]4[/color].  (( Informations hors personnage ))[/size][/b][/list]
[hr][/hr]
[list=none][b][color=#FF0000]4.1[/color] Nom d'utilisateur du panneau de contrôle utilisateur (UCP):[/b] [i]${oocUcpName || 'RÉPONSE'}[/i]
[b][color=#FF0000]4.2[/color] Nom du compte forum GTA:W:[/b] [i]${oocForumName || 'RÉPONSE'}[/i]
[b][color=#FF0000]4.3[/color] Nom Discord:[/b] [i]${oocDiscord || 'RÉPONSE'}[/i]
[b][color=#FF0000]4.4[/color] Fuseau horaire:[/b] [i]${oocTimezone || 'RÉPONSE'}[/i]
[b][color=#FF0000]4.5[/color] Avez-vous une expérience médicale réelle ou avez-vous fait du roleplay dans des factions médicales par le passé ?:[/b] [i]${oocMedicalExperience || 'RÉPONSE'}[/i]
[b][color=#FF0000]4.6[/color] Capture d'écran [u]non éditée[/u] de votre dossier administrateur avec la date et l'heure actuelles affichées:[/b]
[list=none][altspoiler=Dossier administrateur][img]${oocAdminRecordLink || 'LIEN'}[/img][/altspoiler][/list]
[b][color=#FF0000]4.7[/color] Fournissez une capture d'écran des statistiques de votre personnage (/stats) avec lequel vous postulez:[/b] 
[list=none][altspoiler=Statistiques][img]${oocStatsLink || 'LIEN'}[/img][/altspoiler][/list]
[b][color=#FF0000]4.8[/color] Si vous faites partie d'une autre faction officielle, veuillez poster un lien vers votre demande DFP de la part de [b]Pillbox Hill Medical Center[/b] [u]et[/u] de votre faction actuelle. Si vous utilisez le même personnage, les autorisations du LFM doivent être acquises et fournies également:[/b] [i]${oocOtherFactionDfpLfm || 'RÉPONSE'}[/i]
[b][color=#FF0000]4.9[/color] Fournissez l'histoire de votre personnage:[/b]
[quote][i]${charBackground || 'RÉPONSE ICI'}[/i][/quote][/list][/divbox]`;
    } else { // Autres rôles EMS (par exemple, programme à temps partiel)
        const section3Licensing = `[divbox=na][list=none][b][size=110][color=#FF0000]3[/color].  Informations sur les licences et la demande[/size][/b][/list]
[hr][/hr]
[list=none][b][color=#FF0000]3.1[/color] Fournissez une copie de votre licence de technicien médical d'urgence (( /licenses )):[/b] [i]${emsLicenseLink || 'RÉPONSE/LIEN'}[/i]
[b][color=#FF0000]3.2[/color][/color] Veuillez écrire un court paragraphe expliquant pourquoi vous pensez que vous devriez obtenir une place dans notre programme à temps partiel:
[quote][i]${emsPartTimeReason || 'RÉPONSE ICI'}[/i][/quote][/list]
[br][/br][/divbox]`;

        // HRP pour "Autre EMS" commence également à la section 4
        const section4OOC_OtherEMS = `[divbox=na][list=none][b][size=110][color=#FF0000]4[/color].  (( Informations hors personnage ))[/size][/b][/list]
[hr][/hr]
[list=none][b][color=#FF0000]4.1[/color] Nom d'utilisateur du panneau de contrôle utilisateur (UCP):[/b] [i]${oocUcpName || 'RÉPONSE'}[/i]
[b][color=#FF0000]4.2[/color] Nom du compte forum GTA:W:[/b] [i]${oocForumName || 'RÉPONSE'}[/i]
[b][color=#FF0000]4.3[/color] Nom Discord:[/b] [i]${oocDiscord || 'RÉPONSE'}[/i]
[b][color=#FF0000]4.4[/color] Fuseau horaire:[/b] [i]${oocTimezone || 'RÉPONSE'}[/i]
[b][color=#FF0000]4.5[/color] Avez-vous une expérience médicale réelle ou avez-vous fait du roleplay dans des factions médicales par le passé ?:[/b] [i]${oocMedicalExperience || 'RÉPONSE'}[/i]
[b][color=#FF0000]4.6[/color] Capture d'écran [u]non éditée[/u] de votre dossier administrateur avec la date et l'heure actuelles affichées:[/b]
[list=none][altspoiler=Dossier administrateur][img]${oocAdminRecordLink || 'LIEN'}[/img][/altspoiler][/list]
[b][color=#FF0000]4.7[/color] Fournissez une capture d'écran des statistiques de votre personnage (/stats) avec lequel vous postulez:[/b] 
[list=none][altspoiler=Statistiques][img]${oocStatsLink || 'LIEN'}[/img][/altspoiler][/list]
[b][color=#FF0000]4.8[/color] Si vous faites partie d'une autre faction officielle, veuillez poster un lien vers votre demande DFP de la part de [b]Pillbox Hill Medical Center[/b] [u]et[/u] de votre faction actuelle. Si vous utilisez le même personnage, les autorisations du LFM doivent être acquises et fournies également:[/b] [i]${oocOtherFactionDfpLfm || 'RÉPONSE'}[/i]
[b][color=#FF0000]4.9[/color] Fournissez l'histoire de votre personnage:[/b]
[quote][i]${charBackground || 'RÉPONSE ICI'}[/i][/quote][/list][/divbox]`;
        sections3onwardsBBCode = section3Licensing + section4OOC_OtherEMS;
    }
    
    let bbCode = `[imageleft]https://i.ibb.co/nMgfpMcv/phmc-curve.png[/imageleft] [b][size=110]Centre médical de Pillbox Hill[/size][/b] 
Centre de carrière [center][/center]
[center]Candidature pour:[/center]
[center][size=150][b]${dynamicDisplayPosition}[/b][/size][/center]
[divboxcolor=black][url=${dynamicJobPostingUrl}][color=#FF0000]>[/color] [color=#FFFFFF]Retour à l'offre d'emploi[/color][/url][/divboxcolor]
[br][/br]
[divbox=na][list=none][b][size=110][color=#FF0000]1[/color].  Informations personnelles[/size][/b][/list]
[hr][/hr]
[list=none][b][color=#FF0000]1.1[/color]  Titre et nom complet:[/b] [i]${applicantTitleAndFullName || 'RÉPONSE'}[/i]
[b][color=#FF0000]1.2[/color]  Genre:[/b] [i](ajoutez un c, le cas échéant comme ceci cb[color=#FF0000][u][b]c[/b][/u][/color]) [/i]
[list=none][cb${genderMale ? 'c' : ''}] Homme
[cb${genderFemale ? 'c' : ''}] Femme
[cb${genderOther ? 'c' : ''}] Autre: ${genderOther && applicantGenderOtherText ? applicantGenderOtherText : ''}
[/list]
[b][color=#FF0000]1.3[/color] Date et lieu de naissance:[/b] [i]${applicantDOBAndPlace || 'JJ/MMM/AAAA à VILLE'}[/i]
[b][color=#FF0000]1.4[/color]  Adresse:[/b] [i]${applicantAddress || 'RÉPONSE'}[/i]
[b][color=#FF0000]1.5[/color]  Coordonnées:[/b] [i]${applicantContactDetails || 'RÉPONSE'}[/i]
[b][color=#FF0000]1.6[/color] Avez-vous été diagnostiqué avec une condition médicale, des allergies, ou vous a-t-on prescrit des médicaments:[/b] [i]${applicantMedicalConditions || 'RÉPONSE'}[/i]
[b][color=#FF0000]1.7[/color]  Citoyenneté:[/b] [i](ajoutez un c, le cas échéant comme ceci cb[color=#FF0000][u][b]c[/b][/u][/color]) [/i]
[list=none][cb${citizenUS ? 'c' : ''}] Citoyen des États-Unis
[cb${citizenPermanent ? 'c' : ''}] Statut de résident permanent et demande de citoyenneté américaine déposée
[cb${citizenNone ? 'c' : ''}] Aucune des réponses ci-dessus
[br][/br][/list][/list][/divbox]
[br][/br]
[divbox=na][list=none][b][size=110][color=#FF0000]2[/color].  Parcours éducatif[/size][/b][/list]
[hr][/hr]
[list=none][b][color=#FF0000]2.1[/color] Niveau d'éducation le plus élevé:[/b] [i](ajoutez un c, le cas échéant comme ceci cb[color=#FF0000][u][b]c[/b][/u][/color]) [/i]
[list=none]
[cb${eduCheck(eduHighSchool)}] Diplôme d'études secondaires
[cb${eduCheck(eduCertificate)}] Certificat (Inférieur au baccalauréat ou professionnel)
[cb${eduCheck(eduDiploma)}] Diplôme (Inférieur au baccalauréat ou professionnel)
[cb${eduCheck(eduAssociate)}] Diplôme d'associé
[cb${eduCheck(eduBachelor)}] Licence
[cb${eduCheck(eduMaster)}] Master
[cb${eduCheck(eduDoctorate)}] Doctorat
[/list]
[b][color=#FF0000]2.2[/color] Établissement fréquenté:[/b] 
[list=none][color=#FF0000][b]2.2.1[/color] Nom de l'établissement:[/b]  [i]${applicantSchoolName || 'RÉPONSE'}[/i]
[color=#FF0000][b]2.2.2[/color] Période d'inscription:[/b]  [i]${applicantEnrollmentTerm || 'JJ/MMM/AAAA à JJ/MMM/AAAA'}[/i]
[color=#FF0000][b]2.2.3[/color] Domaine d'études principal:[/b] [i]${applicantMajor || 'RÉPONSE'}[/i]
[/list]
[b][color=#FF0000]2.3[/color] Langues supplémentaires:[/b] [i]${applicantLanguages || 'RÉPONSE'}[/i][/list]
[br][/br][/divbox]
${sections3onwardsBBCode}
[divboxcolor=black][center][url=https://phmc.gta.world/viewforum.php?f=168][color=#FF0000]>[/color] [color=#FFFFFF]Services médicaux d'urgence[/url] |[/color]  [url=https://phmc.gta.world/viewtopic.php?t=14][color=#FF0000]>[/color] [color=#FFFFFF]Informations sur l'emploi[/url] |[/color] [url=https://phmc.gta.world/viewforum.php?f=111][color=#FF0000]>[/color]  [color=#FFFFFF]Directives pour les visiteurs[/color][/url][/center][/divboxcolor]`;

    return bbCode;
};
export default generateEMS;
