const generatePsych = (formData) => {
    const {
        // Section 1: Informations personnelles
        recruitmentPosition,
        applicantTitleAndFullName,
        applicantGenderOtherText, // Utilisé si genderOther est vrai
        applicantDOBAndPlace,
        applicantAddress,
        applicantContactDetails,
        applicantMedicalConditions,

        // Section 2: Parcours éducatif
        applicantSchoolName,
        applicantEnrollmentTerm,
        applicantMajor,
        applicantLanguages,

        // Section 3: Historique d'emploi
        applicantPrevEmployment,
        applicantPrevDuties,
        applicantPrevDismissalReason,

        // Section 4: Lettre de motivation
        applicantMotivationLetter,

        // Section 5: Informations HRP
        oocUcpName,
        oocForumName,
        oocDiscord,
        oocTimezone,
        oocMedicalExperience,
        oocAdminRecordLink,
        oocStatsLink,
        charBackground,
        // Genre
        genderMale,
        genderFemale,
        genderOther,
        // Emplacement (Nécessaire pour les rôles psychiatriques non-résidents)
        locationPHMC,
        locationPBC,
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

    } = formData;

    const positionDetailsMap = formData.positionDetailsData || {};

    // Déterminer le nom d'affichage dynamique et l'URL
    let dynamicDisplayPosition = "Position (Veuillez sélectionner)";
    let dynamicJobPostingUrl = "https://phmc.gta.world/viewforum.php?f=14"; // Forum d'emploi par défaut

    if (formData.recruitmentPosition && Object.keys(positionDetailsMap).length > 0) {
        const selectedPositionKey = formData.recruitmentPosition;
        if (positionDetailsMap[selectedPositionKey]) {
            dynamicDisplayPosition = positionDetailsMap[selectedPositionKey].displayName;
            dynamicJobPostingUrl = positionDetailsMap[selectedPositionKey].url;
        } else {
            dynamicDisplayPosition = selectedPositionKey;
            console.warn(`Position "${selectedPositionKey}" non trouvée dans positionDetailsData de Firebase. Utilisation de l'URL par défaut.`);
        }
    } else if (formData.recruitmentPosition) {
        dynamicDisplayPosition = formData.recruitmentPosition;
        console.warn(`positionDetailsData est vide ou non fourni. Utilisation de l'URL par défaut pour "${formData.recruitmentPosition}".`);
    }

    const pageTitlePosition = dynamicDisplayPosition !== "Position (Veuillez sélectionner)" ? dynamicDisplayPosition : "Candidature Psychiatrie";

    // --- BBCode conditionnel pour les sections 1.6 et suivantes ---
    let personalInfoContinuation = '';

    // Déterminer si la vue simplifiée (Condition médicale + Citoyenneté directement comme 1.6, 1.7) doit être affichée
    const showSimplifiedPersonalInfo =
        formData.recruitmentPosition === "Counseling Psychologist" ||
        formData.recruitmentPosition === "Psychologist";

    if (showSimplifiedPersonalInfo) {
        // BBCode pour "Counseling Psychologist" et "Psychologist"
        // (Condition médicale comme 1.6, Citoyenneté comme 1.7)
        personalInfoContinuation = `[b][color=#FF0000]1.6[/color] Avez-vous été diagnostiqué avec une condition médicale, des allergies, ou vous a-t-on prescrit des médicaments:[/b] [i]${applicantMedicalConditions || 'RÉPONSE'}[/i]
[b][color=#FF0000]1.7[/color]  Citoyenneté:[/b] [i](ajoutez un c, le cas échéant comme ceci cb[color=#FF0000][u][b]c[/b][/u][/color]) [/i]
[list=none][cb${citizenUS ? 'c' : ''}] Citoyen des États-Unis
[cb${citizenPermanent ? 'c' : ''}] Statut de résident permanent et demande de citoyenneté américaine déposée
[cb${citizenNone ? 'c' : ''}] Aucune des réponses ci-dessus
[br][/br][/list]`;
    } else {
        // BBCode pour les AUTRES carrières psychiatriques (par exemple, "Resident Psychiatrist", "Attending Psychiatrist")
        // Ce bloc inclura SEULEMENT "Lieu d'emploi souhaité" comme 1.6
        personalInfoContinuation = `[b][color=#FF0000]1.6[/color]  Lieu d'emploi souhaité:[/b] [i](ajoutez un c, le cas échéant comme ceci cb[color=#FF0000][u][b]c[/b][/u][/color]) [/i]
[list=none][cb${locationPHMC ? 'c' : ''}] Centre médical de Pillbox Hill (Ville de Los Santos)
[cb${locationPBC ? 'c' : ''}] Clinique PHMC de Paleto Bay (Paleto Bay)
[/list]`;
    }
    // --- Fin BBCode conditionnel ---

    let bbCode = `[imageleft]https://i.ibb.co/nMgfpMcv/phmc-curve.png[/imageleft] [b][size=110]Centre médical de Pillbox Hill[/size][/b] 
Centre de carrière [center][/center]
[center]Candidature pour:[/center]
[center][size=150][b]${pageTitlePosition}[/b][/size][/center]
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
${personalInfoContinuation}
[/list][/divbox]
[br][/br]
[divbox=na][list=none][b][size=110][color=#FF0000]2[/color].  Parcours éducatif[/size][/b][/list]
[hr][/hr]
[list=none][b][color=#FF0000]2.1[/color] Niveau d'éducation le plus élevé:[/b] [i](ajoutez un c, le cas échéant comme ceci cb[color=#FF0000][u][b]c[/b][/u][/color]) [/i]
[list=none]
[cb${eduHighSchool ? 'c' : ''}] Diplôme d'études secondaires
[cb${eduCertificate ? 'c' : ''}] Certificat (Inférieur au baccalauréat ou professionnel)
[cb${eduDiploma ? 'c' : ''}] Diplôme (Inférieur au baccalauréat ou professionnel)
[cb${eduAssociate ? 'c' : ''}] Diplôme d'associé
[cb${eduBachelor ? 'c' : ''}] Licence
[cb${eduMaster ? 'c' : ''}] Master
[cb${eduDoctorate ? 'c' : ''}] Doctorat
[/list]
[b][color=#FF0000]2.2[/color] Établissement fréquenté:[/b] 
[list=none][color=#FF0000][b]2.2.1[/color] Nom de l'établissement:[/b]  [i]${applicantSchoolName || 'RÉPONSE'}[/i]
[color=#FF0000][b]2.2.2[/color] Période d'inscription:[/b]  [i]${applicantEnrollmentTerm || 'JJ/MMM/AAAA à JJ/MMM/AAAA'}[/i]
[color=#FF0000][b]2.2.3[/color] Domaine d'études principal:[/b] [i]${applicantMajor || 'RÉPONSE'}[/i]
[/list]
[b][color=#FF0000]2.3[/color] Langues supplémentaires:[/b] [i]${applicantLanguages || 'RÉPONSE'}[/i][/list]
[br][/br][/divbox]
[divbox=na][list=none][b][size=110][color=#FF0000]3[/color].  Historique d'emploi[/size][/b][/list]
[hr][/hr]
[list=none][b][color=#FF0000]3.1[/color] Emploi précédent:[/b] [i]${applicantPrevEmployment || 'POSTE chez ENTREPRISE entre JJ/MMM/AAAA et JJ/MMM/AAAA'}[/i]
[b][color=#FF0000]3.2[/color] Fonctions:[/b] [i]${applicantPrevDuties || 'RÉPONSE'}[/i]
[b][color=#FF0000]3.3[/color] Raison du licenciement:[/b] [i]${applicantPrevDismissalReason || 'RÉPONSE'}[/i][/list]
[br][/br][/divbox]
[divbox=na][list=none][b][size=110][color=#FF0000]4[/color].  Lettre de motivation[/size][/b][/list]
[hr][/hr]
[list=none][b][color=#FF0000]4.1[/color] Soumettez votre lettre de motivation, décrivant pourquoi vous souhaitez nous rejoindre, pourquoi nous devrions vous choisir plutôt que quelqu'un d'autre, et pourquoi les qualités requises pour ce poste vous correspondent :[/b] i[/i]
[quote][i]${applicantMotivationLetter || 'RÉPONSE ICI'}[/i][/quote][/list]
[br][/br][/divbox]
[divbox=na][list=none][b][size=110][color=#FF0000]5[/color].  (( Informations hors personnage ))[/size][/b][/list]
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
[quote][i]${charBackground || 'RÉPONSE ICI'}[/i][/quote][/list][/divbox]
[divboxcolor=black][center][url=https://phmc.gta.world/viewforum.php?f=19][color=#FF0000]>[/color] [color=#FFFFFF]Département de santé mentale[/url] |[/color]  [url=https://phmc.gta.world/viewtopic.php?t=14][color=#FF0000]>[/color] [color=#FFFFFF]Informations sur l'emploi[/url] |[/color] [url=https://phmc.gta.world/viewforum.php?f=111][color=#FF0000]>[/color]  [color=#FFFFFF]Directives pour les visiteurs[/color][/url][/center][/divboxcolor]`
    return bbCode;
};
export default generatePsych;
