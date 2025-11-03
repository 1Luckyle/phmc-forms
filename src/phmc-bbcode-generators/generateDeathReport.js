const generateDeathReport = (formData) => {
    const {
        coronerRank,
        placeOfDeath,
        department,
        dateTime,
        coronerEmployee,
        coronerBadge,
        decedentName,
        decedentOOC,
        pronouncedTimeOfDeath,
        synopsis,
        probableCauseOfDeath,
        mannerOfDeath,
        typeOfDeath,
        scenePhotos,
        agencyDataStore,
        additionalImages,
        evidenceLockerID,
        morgueStatus,
    } = formData;

    const { decedentAttributes, decedentPlaceholder } = formData;

const getDepartmentFullName = (shortCode) => {
    if (agencyDataStore && agencyDataStore[shortCode]) {
        return agencyDataStore[shortCode].fullName;
    }
    return shortCode; // fallback to shortcode
};

    // --- Input Validation (Optional but Recommended) ---
    // Add checks here if certain fields are absolutely required before generating
    // Example:
    // if (!placeOfDeath || !department || !dateTime /* ... other required fields */) {
    //     console.error("Missing required fields for death report generation.");
    //     return "Error: Missing required information for report."; // Or throw an error
    // }

    // --- Image URL Processing ---
    // Use optional chaining and provide default empty arrays to prevent errors if fields are null/undefined/empty
    const scenePhotosArray = (scenePhotos || '').split(',').map(url => url.trim()).filter(url => url);
    const additionalImagesArray = (additionalImages || '').split(',').map(url => url.trim()).filter(url => url);
    const decedentAttributesArray = (decedentAttributes || '').split(',').map(url => url.trim()).filter(url => url);
    const decedentPlaceholderArray = (decedentPlaceholder || '').split(',').map(url => url.trim()).filter(url => url);

    const scenePhotosBBCode = scenePhotosArray.length > 0
        ? scenePhotosArray.map(photo => `[img]${photo}[/img]`).join('\n')
        : '[i]Aucune photo de scène fournie.[/i]'; // Provide fallback text

    const additionalImagesBBCode = additionalImagesArray.length > 0
        ? additionalImagesArray.map(photo => `[img]${photo}[/img]`).join('\n')
        : '[i]Aucune image supplémentaire fournie.[/i]'; // Provide fallback text

    const decedentAttributesBBCode = decedentAttributesArray.length > 0
        ? `[b]Attributs du défunt /attributes:[/b]\n${decedentAttributesArray.map(photo => `[img]${photo}[/img]`).join('\n')}`
        : '';

    // --- Evidence Locker Logic ---
    let evidenceLockerText = 'Non';
    let evidenceLockerListItems = '';

    // Check if evidenceLockerID has a value, indicating evidence submission
    if (evidenceLockerID && evidenceLockerID.trim() !== '') {
        evidenceLockerText = 'Oui';
        evidenceLockerListItems = `[list][*] ${evidenceLockerID.trim()} - ${decedentName} (( ${decedentOOC} ))[/list]`;
    }
    const morgueStatusMessage = morgueStatus === 'true' || morgueStatus === true
     ? '[bold][color=red]La photo de l\'écran de la morgue est actuellement indisponible. [/color][/bold]\n'
     : '';


/*     // --- Debug Logs ---
    console.log("[generateDeathReport] Evidence Locker Values:", {
        evidenceLockerID,
        evidenceLockerText,
        evidenceLockerListItems
    });
 */
    // --- Morgue Status Message ---

    // --- BBCode Template ---
    // Use template literals for better readability
    const bbCode = `[divbox=transparent][center][img]https://i.ibb.co/0pgw9hHm/phmc.png[/img][/center][/divbox]

[divbox=transparent][br][/br][center]RAPPORT D'ENQUÊTE SUR LE DÉCÈS[/center]
[hr][/hr]

[center][bold]A. RAPPORT ÉCRIT[/bold][/center]

Le Bureau du Coroner du Comté a été appelé concernant le décès survenu à l'emplacement de [bold]${placeOfDeath || 'Lieu inconnu'}[/bold]. Après avoir reçu l'appel de[bold] ${getDepartmentFullName(department) || 'Département inconnu'}[/bold], le Bureau du Coroner a dépêché un ${coronerRank || 'Coroner'} sur la scène de crime pour mener une enquête le [bold]${dateTime || 'Date/Heure inconnue'}[/bold].

Le ${coronerRank || 'Coroner'}, [bold]${coronerEmployee || 'Coroner inconnu'}[/bold], Identifiant de badge [bold]${coronerBadge || 'N/A'}[/bold], est arrivé sur les lieux et a identifié l'individu comme étant [bold]${decedentName || 'Défunt non identifié'}[/bold], qui est estimé être décédé à [bold]${pronouncedTimeOfDeath || 'Heure inconnue'}[/bold]. Suite à une enquête initiale, le ${coronerRank || 'Coroner'} est arrivé au [bold]synopsis[/bold] suivant: ${synopsis || 'Aucun synopsis fourni.'}

D'après les informations recueillies lors de l'enquête sur les lieux et les antécédents médicaux du défunt (si disponibles), la cause probable du décès a été déterminée comme étant [bold]${probableCauseOfDeath || 'Indéterminée'}[/bold]. La manière du décès a été classée comme [bold]${mannerOfDeath || 'Indéterminée'}[/bold].
[/divbox]
[divbox=transparent][center][bold]B. DOSSIER PHOTOGRAPHIQUE DOCUMENTAIRE[/center]
[hr][/hr]
[center][size=85][bold][u]PHOTOGRAPHIE DE SCÈNE[/u][/bold][/size][/center]
${scenePhotosBBCode}
[/divbox]

[divbox=transparent]
[center][bold]C. DÉCLARATION[/bold][/center]
[hr][/hr]
[size=85]En tant que ${coronerRank || 'Coroner'}, j'ai pris des notes détaillées de mes constatations et conclusions, et ces notes sont disponibles pour examen si nécessaire. Cependant, je dois noter que ces notes ne contiennent aucune opinion personnelle et sont uniquement basées sur les preuves et les faits à ma disposition.

En conclusion, j'espère que ce rapport fournit les informations nécessaires pour que l'agence puisse procéder aux actions nécessaires. Veuillez me faire savoir si vous avez besoin d'informations supplémentaires ou si je peux vous être d'une aide supplémentaire.

Je certifie que les informations contenues dans ce rapport sont vraies et exactes selon mes meilleures connaissances et convictions. J'ai examiné le rapport et me suis assuré que toutes les informations incluses sont complètes et exactes. [/size][/divbox]

[divbox=transparent][center][bold]D. CONFIDENTIALITÉ ET VIE PRIVÉE[/bold][/center]
[hr][/hr]
[center][size=85]Ce document du Département de Médecine Légale et de Pathologie du Pillbox Hill Medical Center certifie l'authenticité des informations contenues dans celui-ci. Toute distribution ou utilisation non autorisée de ces informations constitue une violation de la loi sur la portabilité et la responsabilité en matière d'assurance maladie (HIPAA), ainsi que des lois étatiques et fédérales sur la protection de la vie privée, y compris, mais sans s'y limiter, la loi sur la confidentialité des informations médicales de San Andreas (CMIA) et la loi sur les pratiques d'information de San Andreas (IPA).

Il est impératif que toutes les parties manipulant ce document respectent la vie privée et la confidentialité du défunt et de sa famille. Toute violation de ces lois peut entraîner des poursuites judiciaires contre les parties responsables.

Ce document est fourni à des fins officielles uniquement et ne doit pas être interprété comme un conseil juridique ou un diagnostic médical. Si des informations supplémentaires ou des clarifications sont nécessaires, veuillez contacter le Département de Médecine Légale et de Pathologie du Pillbox Hill Medical Center.[/size][/divbox]

[divbox=transparent][center][bold][u](( IMAGES HORS PERSONNAGE ))[/u][/bold][/center][hr][/hr]

Cette section précise si le joueur a été tué de manière permanente (character killed) ou temporaire (player killed).
Dans ce cas, le joueur a été; ${typeOfDeath || 'Inconnu'}
Nom OOC du joueur: ${decedentOOC || 'Inconnu'}
Écran de morgue, cinjuries, liens cdna: ${morgueStatusMessage || ''}
[size=85][u] CES IMAGES SONT [bold]HORS PERSONNAGE[/bold] POUR LES DOSSIERS INTERNES, NE PAS LES UTILISER COMME PREUVE. [/u][/size]
${additionalImagesBBCode}

${decedentAttributesBBCode}

${coronerRank || 'Coroner'} ${coronerEmployee || 'Coroner inconnu'} a ajouté quelque chose au casier à preuves: ${evidenceLockerText}
${evidenceLockerListItems}

[/divbox]
`;

    return bbCode;
};

// Export the function so it can be imported elsewhere
export default generateDeathReport;