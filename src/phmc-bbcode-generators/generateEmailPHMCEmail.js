const generateEmailPHMCEmail = (formData) => {
    const {
        scenePhotos,
        decedentName,
        patientNotes,
        synopsis,
        phmcEmployee,
        decedentOOC,
        patientCareer,
    } = formData;
    const scenePhotosBBCode = (scenePhotos || '').split(',').map(photo => `[img]${photo.trim()}[/img]`).join('\n');

    let bbCode = `[divbox=na][br][/br][imageleft]https://i.ibb.co/nMgfpMcv/phmc-curve.png[/imageleft] [b][size=110]Pillbox Hill Medical Center[/size][/b] 
[center][/center][br][/br]
[center][size=130][/center][/size]
[center][size=150][b]RE: ${patientNotes} [/b][/size][/center]

[hr][/hr][br][/br][list=none]
Cher(ère) ${decedentName},

${synopsis}


Respectueusement,
${scenePhotosBBCode} 
[/list][hr][/hr][list=none]
[b][size=105]${phmcEmployee || 'Employé PHMC'}[/size][/b]
[size=85]${decedentOOC}
${patientCareer}
[/size]

[b]Pillbox Hill Medical Center[/b]
[size=85]Elgin Avenue/Strawberry Avenue, Pillbox Hill, Los Santos, SA
Téléphone: 50056
Courriel: [url=https://phmc.gta.world/ucp.php?i=pm&mode=compose&g=40]info@phmc.health[/url]
Site web: [url=https://phmcfr.com/index.php]www.phmcfr.com[/url]

Suivez-nous sur Facebrowser: [url=https://facebrowser.gta.world/pages/Pillbox.Hill.Medical.Center?ref=qs]Pillbox Hill Medical Center[/url][/size]

[size=70][i]Le contenu de ce message et de toute pièce jointe est confidentiel. Ils sont destinés uniquement au(x) destinataire(s) nommé(s). Si vous avez reçu ce courriel par erreur, veuillez en informer l'expéditeur immédiatement et ne pas divulguer le contenu à quiconque ni en faire de copies.[/i][/size][/divbox] 
`
    return bbCode;
    };
export default generateEmailPHMCEmail;