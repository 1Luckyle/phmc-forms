const generateCertificate = (formData) => {
    const {
        scenePhotos,
        decedentName,
        patientAge,
        probableCauseOfDeath,
        patientDateOfBirth,
        dateofdeath,
        TimeofDeath,
        witnessName,
        coronerEmployee,
        date,
    } = formData;
    const scenePhotosBBCode = (scenePhotos || '').split(',').map(photo => `[img]${photo.trim()}[/img]`).join('\n');

    let bbCode = `[divbox=#E8E8E8][br][/br][center][img]https://i.ibb.co/0pgw9hHm/phmc.png[/img][/center][br][/br]


[hr][/hr]
[center][size=125][b]CERTIFICAT DE DÉCÈS ÉMIS PAR LE
DÉPARTEMENT DE PATHOLOGIE ET DE MÉDECINE LÉGALE[/center][/b][/size]
[hr][/hr][br]

[center]Je soussigné(e), [b]${coronerEmployee}[/b], au nom du Département de Pathologie et de Médecine Légale du Pillbox Hill Medical Center, dans l'État de San Andreas, documente, enregistre, scelle et certifie par la présente le décès de [b]${decedentName}[/b]. Je confirme que les informations suivantes sont exactes au meilleur de mes capacités:[/center][br][/br]

[table][tr][td]NOM[/td][td]
${decedentName || 'INSÉRER LE NOM DU DÉFUNT ICI'}

[tr][td]ÂGE[/td][td]
${patientAge}	

[tr][td]DATE DE NAISSANCE[/td][td]
${patientDateOfBirth || 'INSÉRER LA DATE DE NAISSANCE ICI'}	

[tr][td]CAUSE DU DÉCÈS[/td][td]
${probableCauseOfDeath || 'INSÉRER LA CAUSE DU DÉCÈS ICI'}	

[tr][td]HEURE DU DÉCÈS[/td][td]
${TimeofDeath || 'INSÉRER L\'HEURE DU DÉCÈS ICI'}	

[tr][td]DATE DU DÉCÈS[/td][td]
${dateofdeath || 'INSÉRER LA DATE DU DÉCÈS ICI'}	
[/table][br][/br]
[list=none][left]
SIGNATURE DU MÉDECIN LÉGISTE:
NOM IMPRIMÉ: Dr. Anne Carter

SIGNATURE DU TÉMOIN:
NOM IMPRIMÉ: ${witnessName || 'INSÉRER LE NOM DU TÉMOIN ICI'}

DATE D'ÉMISSION DU CERTIFICAT: ${date}
[/list]

[br][hr][/hr]
[center]Note: Ceci est la copie originale du certificat de décès. Des copies supplémentaires peuvent être demandées moyennant des frais additionnels[/center][br][/br]`
    return bbCode;
    };
export default generateCertificate;