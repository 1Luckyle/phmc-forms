const generateEmail = (formData) => {
    const {
        requestingOfficer,
        department,
        coronerEmployee,
        coronerRank,
        coronerDiscord,
        coronerPHNumber,
        deathReport,
        additionalReports,
        agencyDataStore, // Added agencyDataStore
    } = formData;

    const getDepartmentFullName = (shortCode) => {
        if (agencyDataStore && agencyDataStore[shortCode]) {
            return agencyDataStore[shortCode].fullName;
        }
        return shortCode; // fallback to shortcode
    };

    let bbCode = `[center][img]https://i.ibb.co/GfSHbMMj/ItaoQkO.webp[/img][/center]
[hr][/hr]

DESTINATAIRE: ${requestingOfficer} - ${getDepartmentFullName(department)}
EXPÉDITEUR: ${coronerEmployee} @ phmc.health
OBJET: Documents du rapport de décès

À l'attention de: [b]${getDepartmentFullName(department)}[/b] - [b]${requestingOfficer}[/b]

Ce rapport de coroner a été rédigé par ${coronerRank} ${coronerEmployee}. Vous trouverez les documents ci-joints attachés à ce courriel. 

[b]INFORMATIONS / DEMANDE(S) D'AUTOPSIE[/B] 
Si vous avez besoin d'une autopsie, veuillez suivre ce lien et suivre les instructions: [url=https://phmc.gta.world/viewforum.php?f=265]Portail d'autopsie[/url].


[altspoiler=FAQ sur la demande d'autopsie]
1) Comment puis-je demander un rapport d'autopsie et/ou un certificat de décès?
Les autopsies et les certificats de décès peuvent être utiles dans diverses situations, en particulier lorsque la cause du décès joue un rôle essentiel. Nos professionnels s'efforcent de traiter chaque demande dans les délais les plus brefs. Cependant, étant donné que l'effort de documentation est immense, des frais de demande sont associés. Dès réception du paiement, le rapport ou le certificat vous sera envoyé directement.


2) Y a-t-il des frais associés au processus de demande?
Oui, il y a des frais de 2 000 $ associés à la demande. Ces frais couvrent les coûts administratifs liés au traitement et au maintien sécurisé de votre rapport/certificat demandé dans nos systèmes. Ils garantissent l'amélioration continue de nos services, en maintenant les normes les plus élevées en matière de gestion des données de santé.


3) Comment payer les frais de demande de 2 000 $?
Pour payer vos frais de demande de 2 000 $, veuillez vous connecter au site web bancaire et naviguer vers la section "Paiement". Sélectionnez votre méthode de paiement préférée (par exemple, carte de crédit, carte de débit), insérez notre numéro d'acheminement (020000062), entrez les détails de paiement requis, examinez la transaction et confirmez votre paiement. (( Tapez /transfer 2000 020000062 ))

(( Les autopsies pour les Player Kills (PK) et Character Kills (CK) ne seront acceptées que si elles sont jugées strictement nécessaires et pertinentes pour un cas ou une enquête importante. Avant de faire une demande pour une telle autopsie, un membre des médecins légistes doit être notifié et consulté. De plus, il est obligatoire de fournir des informations sur /cdamages et /cexamine. Dans le cas où ces informations ne seraient pas disponibles, n'hésitez pas à contacter un administrateur en jeu, qui pourra les fournir. Si ces étapes ne sont pas suivies, un refus automatique entraînera l'archivage de votre demande.

De plus, s'il s'agit d'un PK, veuillez utiliser John/Jane Doe avec le nom de leur personnage entre parenthèses OOC. Ex: John Doe (( James Smith ))

[url=https://phmc.gta.world/ucp.php?i=pm&mode=compose&g=50]Cliquez ici pour contacter un médecin légiste afin d'obtenir le feu vert![/url] ))
[/altspoiler]
Si vous avez d'autres questions, n'hésitez pas à contacter la personne suivante:
[list] ${coronerEmployee}
[*] Numéro de téléphone: ${coronerPHNumber}
[*] (( Discord: ${coronerDiscord} ))[/list]

[altspoiler=Rapport du coroner]
${deathReport}
[code]
${deathReport}

[/code]
[/altspoiler]
${additionalReports && additionalReports.length > 0
            ? additionalReports
                .filter(report => report.trim())
                .map((report, index) => `
[altspoiler=Rapport du coroner - Additionnel ${index + 1}]
${report}
[code]
${report}
[/code]
[/altspoiler]`).join('\n\n')
            : ''
        }

Cordialement
${coronerRank} ${coronerEmployee}
Pillbox Hill Medical Center - Pathologie et Médecine Légale

[size=75]Le contenu de ce courriel est destiné uniquement à la personne ou à l'entité à laquelle il est adressé. Ce courriel peut contenir des informations confidentielles. Si vous n'êtes pas la personne à qui ce message est adressé, sachez que toute utilisation, reproduction ou distribution de ce message est strictement interdite. Si vous avez reçu ceci par erreur, veuillez contacter l'expéditeur et supprimer immédiatement ce courriel et toutes les pièces jointes.[/size]`;

    return bbCode;
};

export default generateEmail;