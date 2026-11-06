// src/phmc-bbcode-generators/generateFlightCertificate.js
// Certificat d'aptitude médicale au vol (formulaire 41). Voir utils/flightCertificate.js pour les classes et critères.
import {
    getFlightCertClass, FLIGHT_CERT_EXAMS, examResultKey, examValueKey, validityMonthsFor, validUntil,
} from '../utils/flightCertificate';

const frDate = (value) => {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : (value || 'N/A');
};

const generateFlightCertificate = (formData) => {
    const f = formData || {};
    const cls = getFlightCertClass(f.flightCertClass);
    const categories = Array.isArray(f.flightCertCategories) ? f.flightCertCategories : [];
    const conclusion = f.flightCertConclusion || '';
    const months = validityMonthsFor(f.flightCertClass, f.patientDateOfBirth, f.date);
    const until = validUntil(f.date, months);

    const verdictColor = conclusion === 'Apte' ? '#008000' : conclusion === 'Inapte' ? '#FF0000' : '#FF8000';
    const verdictLine = conclusion
        ? `[color=${verdictColor}][b]${conclusion.toUpperCase()}[/b][/color]`
        : '[i]Conclusion non renseignée[/i]';

    // Seuls les RÉSULTATS de conformité figurent sur le certificat (jamais de diagnostic : il peut être remis à l'autorité aéronautique).
    const examRows = (cls ? cls.exams : []).map((exam) => {
        const info = FLIGHT_CERT_EXAMS[exam];
        const result = f[examResultKey(exam)] || 'Non renseigné';
        const color = result === 'Conforme' ? '#008000' : result === 'Non conforme' ? '#FF0000' : '#666666';
        const measured = f[examValueKey(exam)] ? ` — ${f[examValueKey(exam)]}` : '';
        return `[tr][td]${info.label}[/td][td][color=${color}]${result}[/color]${measured}[/td]`;
    }).join('\n');

    const restrictionsBlock = conclusion === 'Apte avec restrictions' && f.flightCertRestrictions
        ? `\n[b]Restrictions :[/b] ${f.flightCertRestrictions}\n`
        : '';
    const noteBlock = f.flightCertNote ? `\n[b]Observations :[/b] ${f.flightCertNote}\n` : '';
    const signature = f.phmcEmployeeSignatureImage ? `[img]${String(f.phmcEmployeeSignatureImage).trim()}[/img]` : '';

    return `[divbox=white][center][img]https://i.ibb.co/0pgw9hHm/phmc.png[/img][/center][/divbox]
[divbox=white][br][/br][center][size=150][b]CERTIFICAT D'APTITUDE MÉDICALE AU VOL[/b][/size]
[b]${cls ? cls.label : 'Classe non renseignée'}[/b][/center]
[hr][/hr]

Je soussigné(e), [b]${f.phmcEmployee || 'Employé PHMC'}[/b], ${f.phmcRank || 'N/A'} au Pillbox Hill Medical Center, certifie avoir examiné le ${frDate(f.date)} :

[table]
[tr][td][b]Patient[/b][/td][td]${f.patientName || 'N/A'}${f.patientID ? ` (${f.patientID})` : ''}[/td]
[tr][td][b]Date de naissance[/b][/td][td]${frDate(f.patientDateOfBirth)}[/td]
[tr][td][b]Catégorie(s) de vol[/b][/td][td]${categories.length ? categories.join(', ') : 'N/A'}[/td]
[/table]

[b]Examens réalisés[/b]
[table]
${examRows}
[/table]

[b]Conclusion :[/b] ${verdictLine}
${restrictionsBlock}${noteBlock}
[b]Délivré le :[/b] ${frDate(f.date)}
[b]Valable jusqu'au :[/b] ${conclusion === 'Inapte' ? 'Sans objet (inapte)' : (until ? frDate(until) : 'N/A')}${months && conclusion !== 'Inapte' ? ` (${months} mois)` : ''}

[size=85][i]Ce certificat atteste uniquement de l'aptitude médicale au vol : il ne contient aucun diagnostic ni donnée médicale détaillée, couverts par le secret médical. Il ne remplace pas la licence de vol délivrée par la San Andreas Aviation Administration (SAAA).[/i][/size]

${signature}
[b]${f.phmcEmployee || 'Employé PHMC'}[/b]
[size=85]${f.phmcRank || 'N/A'} — Pillbox Hill Medical Center[/size][/divbox]`;
};

export default generateFlightCertificate;
