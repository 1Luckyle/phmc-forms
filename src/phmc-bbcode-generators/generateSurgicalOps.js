const generateSurgicalOps = (formData) => {
    const {
        phmcEmployee,
        extraStaff,
        patientID,
        patientSummaryConsultation,
        patientAddress,
        phmcRank,
        date,
        patientSummary,
        lastName,
        surgeryProcedures
    } = formData;
    const extraStaffNames = Array.isArray(extraStaff) ? extraStaff.join(', ') : extraStaff;

    let bbCode = `[divbox=white][table][tr][td][center][br][/br][br][/br][b]RAPPORT CHIRURGICAL[/b]

PATIENT ${patientID}

Date: ${date}
Signé: ${phmcRank} ${lastName}

[/center][td][center][img]https://i.ibb.co/0pgw9hHm/phmc.png[/img][/center][td][center][br][/br][br][/br][size=100][b]CENTRE MÉDICAL PILLBOX HILL[/b]
ELGIN AVE. / STRAWBERRY AVE.
BP 742
LOS SANTOS, SAN ANDREAS
T: 50056[/size][/center][/table][/divbox]
[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Personnel[/b][/color][/center][/divboxcolor]
[table][tr][td]Chirurgien principal[/td][td]
${phmcEmployee}
[/td][/tr]
[tr][td]Personnel supplémentaire [i](laisser vide si aucun)[/i][/td][td]
${extraStaff}
[/td][/tr][/table]
[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Enquête chirurgicale[/b][/color][/center][/divboxcolor]
[table]

[tr][td]Nom de la procédure[/td][td]
${surgeryProcedures}

[tr][td]Le patient ou sa famille a-t-il donné son consentement, ou avait-il une blessure potentiellement mortelle ou grave nécessitant une intervention chirurgicale immédiate?[/td][td]
[cb${formData.patientConsentOption === 'Yes' ? 'c' : ''}] Oui
[cb${formData.patientConsentOption === 'No' ? 'c' : ''}] Non


[/td][/tr]

[tr][td]Des complications médicales sont-elles survenues pendant la chirurgie?[/td][td]
[cb${formData.patientComplicationOptions === 'Yes' ? 'c' : ''}] Oui
[cb${formData.patientComplicationOptions === 'No' ? 'c' : ''}] Non
[/td][/tr]

[tr][td]La procédure a-t-elle été complétée avec succès et a-t-elle abouti au résultat clinique souhaité?[/td][td]
[cb${formData.procedureGoodOptions === 'Yes' ? 'c' : ''}] Oui
[cb${formData.procedureGoodOptions === 'No' ? 'c' : ''}] Non
[/td][/tr]
[/table]

[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Rapport post-anesthésie[/b][/color][/center][/divboxcolor]
[table]

[tr][td]Type et dosage d'anesthésie administrée[/td][td] ${patientSummaryConsultation}
[/td][/tr]

[tr][td]Détails d'anesthésie post-opératoire[/td][td]${patientAddress}
[/td][/tr]

[/table]

[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Résumé de la procédure chirurgicale[/b][/color][/center][/divboxcolor]
[table]

[tr][td]
${patientSummary}

[/table]`;

    return bbCode;
};

export default generateSurgicalOps;