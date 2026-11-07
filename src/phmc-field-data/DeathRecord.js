import React, { useState, useEffect } from 'react';
import { Form } from 'react-bootstrap';
import { database } from '../firebase';
import { ref, get } from 'firebase/database';
import CoronerSelect from './shared/CoronerSelect';
import NameFields from './shared/NameFields';
import DoeChoice from './shared/DoeChoice';
import PlaceWithCity from './shared/PlaceWithCity';
import PresetTextField from './shared/PresetTextField';
import ComboSelect from './shared/ComboSelect';
import { ETHNICITY_OPTIONS } from '../utils/patientIdentity';
import { DEATH_CAUSE_PRESETS } from '../constants/deathPresets';
import { localizeOptions, MANNER_FR, BODY_STATUS_FR, CASE_STATUS_FR, IDENTIFICATION_FR, SEX_FR } from '../utils/deathLabels';

const DECEDENT_FIELDS = { full: 'decedentName', first: 'decedentFirstName', middle: 'decedentMiddleName', last: 'decedentLastName', title: 'decedentTitle' };
const HAIR_COLORS = ['Noirs', 'Bruns', 'Châtains', 'Blonds', 'Roux', 'Gris', 'Blancs', 'Chauve'];
const EYE_COLORS = ['Marron', 'Noisette', 'Bleus', 'Verts', 'Gris', 'Noirs'];

// Normalise ["A","B"] -> [{label:"A", value:"A"}, ...] et laisse passer les objets déjà corrects
const toOptions = (arr = []) =>
  Array.isArray(arr)
    ? arr.map((v) =>
        (v && typeof v === 'object' && 'label' in v && 'value' in v)
          ? v
          : { label: String(v), value: String(v) }
      )
    : [];

// Ces listes enregistrent le LIBELLÉ (texte affiché) comme valeur, pour que le rapport sorte directement le texte : on enregistre donc le libellé FRANÇAIS
// (« Naturelle », « Ouvert »…) quand la valeur de la base est connue, sinon le libellé de la base.
const toFrenchLabelValues = (opts, labels) => localizeOptions(opts, labels).map((option) => ({ label: option.label, value: option.label }));

const DeathRecord = ({
    formData,
    handleChange,
    handleSelectChange,
    setFormData,
    coronerGroupedOptions,
    unrestrictedCoronerGroupedOptions,
}) => {
    const [selectOptions, setSelectOptions] = useState({
        deathRecordType: [],
        caseStatusOptions: [],
        bodyStatusOptions: [],
        gender: [],
        mannerOfDeathOptions: [],
    });

    useEffect(() => {
        const optionsRef = ref(database, 'selectOptions');
        get(optionsRef).then((snapshot) => {
            if (snapshot.exists()) {
                const options = snapshot.val();
                setSelectOptions({
                    // essaie d'abord selectOptions.deathRecordType, sinon deathRecordTypeOptions, sinon valeurs par défaut
                    deathRecordType: localizeOptions(
                        toOptions(options.deathRecordType || options.deathRecordTypeOptions || ['Identified', 'Unidentified']), IDENTIFICATION_FR,
                    ),
                    caseStatusOptions: toFrenchLabelValues(toOptions(options.caseStatusOptions || []), CASE_STATUS_FR),
                    bodyStatusOptions: toFrenchLabelValues(toOptions(options.bodyStatusOptions || []), BODY_STATUS_FR),
                    gender: toFrenchLabelValues(toOptions(options.gender || []), SEX_FR),
                    mannerOfDeathOptions: toFrenchLabelValues(toOptions(options.mannerOfDeathOptions || []), MANNER_FR),
                });
            }
        });
    }, []);

    const set = (name) => (value) => setFormData((prev) => ({ ...prev, [name]: value }));
    const unidentified = formData.deathRecordType === 'Unidentified';

    return (
        <>
            <Form.Group className="mb-3">
                <Form.Label className="form-section-title">Type de dossier</Form.Label>
                <Form.Select
                    name="deathRecordType"
                    value={formData.deathRecordType}
                    onChange={handleChange}
                    className="form-control"
                >
                    <option value="" disabled>Sélectionner le type de dossier de cas de décès public</option>
                    {selectOptions.deathRecordType.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                </Form.Select>
            </Form.Group>

            {formData.deathRecordType && (
                <>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <Form.Control type="text" name="caseNumber" value={formData.caseNumber || ''} onChange={handleChange} placeholder="Numéro du dossier" className="form-control" />
                        <Form.Select name="caseStatus" value={formData.caseStatus} onChange={handleChange} className="form-control">
                            <option value="">Statut du dossier</option>
                            {selectOptions.caseStatusOptions.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </Form.Select>
                        <Form.Select name="bodyStatus" value={formData.bodyStatus} onChange={handleChange} className="form-control">
                            <option value="">Statut de libération du corps</option>
                            {selectOptions.bodyStatusOptions.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </Form.Select>
                    </div>

                    <Form.Label className="form-section-title">Défunt</Form.Label>
                    {unidentified && <DoeChoice formData={formData} setFormData={setFormData} fields={DECEDENT_FIELDS} />}
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <NameFields
                            formData={formData} setFormData={setFormData} handleChange={handleChange} fields={DECEDENT_FIELDS}
                            placeholders={{ first: 'Prénom', middle: 'Deuxième prénom', last: 'Nom de famille' }}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <Form.Control type="text" name="decedentOOC" value={formData.decedentOOC} onChange={handleChange} placeholder="(( Discord du joueur (HRP) ))" className="form-control" />
                        {!unidentified && (
                            <Form.Control type="text" name="patientID" value={formData.patientID || ''} onChange={handleChange} placeholder="ID Patient" className="form-control" />
                        )}
                    </div>
                    <Form.Label>Date du décès</Form.Label>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <Form.Control type="date" name="dateOfDeath" value={formData.dateOfDeath} onChange={handleChange} className="form-control" />
                        <Form.Control type="text" name="age" value={formData.age} onChange={handleChange} placeholder={unidentified ? 'Âge approximatif du défunt' : 'Âge du défunt'} className="form-control" />
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <Form.Select name="sex" value={formData.sex} onChange={handleChange} className="form-control">
                            <option value="">Genre à l'état civil du défunt</option>
                            {selectOptions.gender.map(option => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </Form.Select>
                        <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                            <ComboSelect name="ethnicity" value={formData.ethnicity || ''} onChange={set('ethnicity')} options={ETHNICITY_OPTIONS} placeholder="Ethnicité du défunt (choisir ou écrire)" />
                        </div>
                    </div>

                    <Form.Label className="form-section-title">Circonstances du décès</Form.Label>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <PlaceWithCity formData={formData} setFormData={setFormData} handleChange={handleChange} addressName="placeOfDeath" zipName="placeOfDeathZip" placeholder="Lieu du décès (Numéro, Étage, Rue)" />
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <Form.Select name="manner" value={formData.manner} onChange={handleChange} className="form-control">
                            <option value="">Mode de décès</option>
                            {selectOptions.mannerOfDeathOptions.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </Form.Select>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <PresetTextField
                            name="causesOfDeath" formData={formData} setFormData={setFormData} presets={DEATH_CAUSE_PRESETS}
                            placeholder="Autres causes ou précisions" selectPlaceholder="Causes du décès (plusieurs choix possibles)…"
                        />
                    </div>

                    {unidentified ? (
                        <>
                            <Form.Label className="form-section-title">Description physique</Form.Label>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                                    <ComboSelect name="hairColor" value={formData.hairColor || ''} onChange={set('hairColor')} options={HAIR_COLORS} placeholder="Couleur des cheveux" />
                                </div>
                                <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                                    <ComboSelect name="eyeColor" value={formData.eyeColor || ''} onChange={set('eyeColor')} options={EYE_COLORS} placeholder="Couleur des yeux" />
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <Form.Control type="text" name="weight" value={formData.weight} onChange={handleChange} placeholder="Poids (ex. 80 kg)" className="form-control" />
                                <Form.Control type="text" name="height" value={formData.height} onChange={handleChange} placeholder="Taille (ex. 1,80 m)" className="form-control" />
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <Form.Control as="textarea" rows={1} name="tattoos" value={formData.tattoos} onChange={handleChange} placeholder="Tatouages ou Aucun" className="form-control" />
                                <Form.Control as="textarea" rows={1} name="jewelry" value={formData.jewelry} onChange={handleChange} placeholder="Bijoux ou Aucun" className="form-control" />
                            </div>
                            <Form.Group className="mb-3">
                                <Form.Control as="textarea" rows={3} name="comments" value={formData.comments} onChange={handleChange} placeholder="Commentaires..." className="form-control" />
                            </Form.Group>
                        </>
                    ) : (
                        <Form.Control as="textarea" rows={3} name="otherSignificantConditions" value={formData.otherSignificantConditions} onChange={handleChange} placeholder="Entrez d'autres informations significatives" className="form-control" />
                    )}

                    <Form.Label className="form-section-title">Médecins légistes</Form.Label>
                    <CoronerSelect options={coronerGroupedOptions} formData={formData} handleSelectChange={handleSelectChange} label="Examinateur médical" />
                    <Form.Label></Form.Label>
                    <CoronerSelect
                        name="chiefMedicalExaminer" options={unrestrictedCoronerGroupedOptions} formData={formData} handleSelectChange={handleSelectChange}
                        label="Examinateur en chef" placeholder="Sélectionner l'examinateur en chef (Vous pouvez taper pour rechercher!)" restricted={false}
                    />
                    <Form.Label></Form.Label>
                </>
            )}
        </>
    );
};

export default DeathRecord;
