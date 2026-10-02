export const ARRIVAL_MODE_LABELS = {
    'Walk-in': 'Par ses propres moyens',
    EMS: 'Ambulance / EMS',
    Police: "Amené par les forces de l'ordre",
    Transfer: 'Transfert depuis un autre établissement',
    Other: 'Autre',
};

const VITAL_VALUES = [
    { key: 'temperatureValue', label: 'T°', unit: '°C' },
    { key: 'heartRateValue', label: 'FC', unit: 'bpm' },
    { key: 'respiratoryRateValue', label: 'FR', unit: '/min' },
    { key: 'bloodPressureValue', label: 'TA', unit: 'mmHg' },
    { key: 'spo2Value', label: 'SpO2', unit: '%' },
    { key: 'glucoseValue', label: 'Glycémie', unit: 'g/L' },
    { key: 'gcsScore', label: 'Glasgow', unit: '/15' },
];

/**
 * Ligne « Valeurs mesurées » sous les cases de signes vitaux. Renvoie une
 * chaîne vide si rien n'a été saisi, pour ne pas alourdir le rapport.
 */
export const buildVitalValuesBBCode = (formData) => {
    const filled = VITAL_VALUES
        .filter(({ key }) => formData[key] && String(formData[key]).trim())
        .map(({ key, label, unit }) => `${label}: ${String(formData[key]).trim()} ${unit}`);
    if (filled.length === 0) return '';
    return `
[table][tr][td][center][b]Valeurs mesurées[/b] — ${filled.join(' | ')}[/center][/table]`;
};
