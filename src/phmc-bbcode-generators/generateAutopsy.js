const generateAutopsy = (formData) => {
    const {
        coronerRank,
        coronerEmployee,
        chiefCoronerRank,
        chiefCoronerEmployee,
        synopsis,       // Used for Opinion
        decedentName,
        externalExamination, // Added this from your Autopsy.js
        decedentOOC,
        autopsyDeathCauses,
        deathType,
        causeOfDeath,
        autopsyAnatomicSummaryItems,
        autopsyAlbumUrl,             // This now holds comma-separated image URLs
        autopsyPhotosUnavailable,
        RadiologyResult,             // Added this from your Autopsy.js
        autopsyDate: formAutopsyDate,
        autopsyTime: formAutopsyTime,
        autopsyDiagramImgurUrl, // Assuming the Imgur URL is stored here

    } = formData;

    // --- Dynamic Death Causes List ---
    let deathCausesListItems = '[list=a][*]N/A[/list]';
    if (autopsyDeathCauses && Array.isArray(autopsyDeathCauses)) {
        const filteredCauses = autopsyDeathCauses
            .map(cause => (cause || '').trim())
            .filter(cause => cause);
        if (filteredCauses.length > 0) {
            deathCausesListItems = `[list=a]${filteredCauses[0]}`;
            if (filteredCauses.length > 1) {
                deathCausesListItems += `\n${filteredCauses.slice(1).map(cause => `[*]${cause}`).join('\n')}`;
            }
            deathCausesListItems += `\n[/list]`;
        }
    }

    // --- Dynamic Anatomic Summary List ---
    let anatomicSummaryListItems = '[list=1][*]N/A[/list]';
    if (autopsyAnatomicSummaryItems && Array.isArray(autopsyAnatomicSummaryItems)) {
        const filteredSummaryItems = autopsyAnatomicSummaryItems
            .map(item => (item || '').trim())
            .filter(item => item);
        if (filteredSummaryItems.length > 0) {
            anatomicSummaryListItems = `[list=1]${filteredSummaryItems[0]}`;
            if (filteredSummaryItems.length > 1) {
                anatomicSummaryListItems += `\n${filteredSummaryItems.slice(1).map(item => `[*]${item}`).join('\n')}`;
            }
            anatomicSummaryListItems += `\n[/list]`;
        }
    }
    // --- Autopsy Diagram Logic ---
    let autopsyDiagramBBCode = '';
    if (autopsyDiagramImgurUrl && autopsyDiagramImgurUrl.trim() !== '') {
        autopsyDiagramBBCode = `[b]Diagramme d'autopsie[/b]:\n[img]${autopsyDiagramImgurUrl.trim()}[/img]\n`;
    } else {
        // Option 1: Omit the line if no diagram
        // autopsyDiagramBBCode = ''; 
        // Option 2: Indicate no diagram is available
        autopsyDiagramBBCode = `[b]Diagramme d'autopsie[/b]: N/A\n`;
    }

    // --- Photography Link/Image Logic ---
    let photographySectionBBCode = '';
    if (autopsyPhotosUnavailable) {
        photographySectionBBCode = 'Les photographies ne sont pas disponibles pour cette autopsie.';
    } else if (autopsyAlbumUrl && autopsyAlbumUrl.trim() !== '') {
        const photoUrls = autopsyAlbumUrl.split(',')
            .map(url => url.trim())
            .filter(url => url); // Filter out empty strings

        if (photoUrls.length > 0) {
            photographySectionBBCode = `Les photos sur les lieux sont disponibles: ${photoUrls.map((url, index) => `[url=${url}]Photo ${index + 1}[/url]`).join(' | ')} Des photographies ont été prises avant et pendant le déroulement de l'autopsie.`;
        } else {
            photographySectionBBCode = 'Aucune URL de photo valide fournie.';
        }
    } else {
        photographySectionBBCode = 'Aucune photographie fournie pour cette autopsie.';
    }

    // --- Format date and time for the report ---
    let finalAutopsyDate = 'JJ/MMM/AAAA';
    if (formAutopsyDate) {
        const dateParts = formAutopsyDate.split('-'); // YYYY-MM-DD
        if (dateParts.length === 3) {
            const dateObj = new Date(dateParts[0], parseInt(dateParts[1], 10) - 1, dateParts[2]); // Month is 0-indexed
            finalAutopsyDate = dateObj.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
        }
    }
    const finalAutopsyTime = formAutopsyTime || 'HH:MM';

    let bbCode = `[divbox=white][center][img]https://i.ibb.co/0pgw9hHm/phmc.png[/img][/center][/divbox]

[divbox=white][b][size=150][br][/br][center]DÉPARTEMENT DE PATHOLOGIE ET DE MÉDECINE LÉGALE[/size][/b][/center]
[center][size=120]Rapport d'autopsie par le médecin légiste[/size][/center][hr][/hr][justify][br][/br]J'ai effectué une autopsie sur le corps de [b]${decedentName || 'John Doe'} ((${decedentOOC || 'Nom OOC'}))[/b] au Département de Pathologie et de Médecine Légale du PHMC le ${finalAutopsyDate}, ${finalAutopsyTime}.
D'après les constatations anatomiques et les antécédents pertinents, j'attribue le décès à:
${deathCausesListItems}
[b]MANIÈRE DU DÉCÈS:[/b] ${deathType || 'Indéterminée'}
[b]COMMENT LA BLESSURE S'EST PRODUITE:[/b] ${causeOfDeath || 'Inconnue'}
${autopsyDiagramBBCode} 
[b]Résumé anatomique:[/b]
${anatomicSummaryListItems}
[b]Examen externe:[/b]
${externalExamination || 'Aucun détail d\'examen externe fourni.'}[br][/br]
[b]Vêtements:[/b]
Le corps n'était pas vêtu et les vêtements n'étaient pas disponibles au moment de l'autopsie.[br][/br]
[b]Incision initiale:[/b]
Les cavités corporelles sont ouvertes par l'incision coronale standard et l'incision en forme de Y standard.[br][/br]
[b]Examen interne:[/b]
Conformément à la cause du décès indiquée, rien d'inhabituel n'a été observé.[br][/br]
[b]Sections histologiques:[/b]
Des sections représentatives de divers organes sont conservées dans un bocal de stockage dans du formol à 10%.[br][/br]
[b]Toxicologie:[/b]
Du sang thoracique, du sang fémoral, du sang EDTA, de l'urine, du contenu gastrique et du vitré ont été soumis au laboratoire. Un dépistage complet a été demandé.[br][/br]
[b]Photographie:[/b]
${photographySectionBBCode}[br][/br]
[b]Radiologie:[/b]
Le corps est fluoroscopé et deux radiographies ont été prises; ${RadiologyResult || 'Aucun résultat radiologique spécifique noté.'}[br][/br]
[b]Avis:[/b]
${synopsis || 'Aucun avis fourni.'}[br][/br]
[b]Effectué par:[/b]
${coronerRank || 'Médecin légiste'} ${coronerEmployee || 'Coroner inconnu'} [br][/br]
[b]Approuvé par:[/b]
${chiefCoronerRank || 'Chef médecin légiste-Coroner'} ${chiefCoronerEmployee || 'Anne Carter'}[/justify][/divbox]`

    return bbCode;
};
export default generateAutopsy;