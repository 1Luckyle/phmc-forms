import React, { useState, useEffect } from 'react';
import { Form } from 'react-bootstrap';
import { database } from '../firebase';
import Select from 'react-select';
import { ref, get } from 'firebase/database';

// Normalise ["A","B"] -> [{label:"A", value:"A"}, ...] et laisse passer les objets déjà corrects
const toOptions = (arr = []) =>
  Array.isArray(arr)
    ? arr.map((v) =>
        (v && typeof v === 'object' && 'label' in v && 'value' in v)
          ? v
          : { label: String(v), value: String(v) }
      )
    : [];

// Utilise le label (texte affiché) comme valeur enregistrée,
// afin que le générateur BBcode sorte le texte français directement.
const toLabelValues = (opts) => opts.map(o => ({ label: o.label, value: o.label }));

const DeathRecord = ({ 
    formData, 
    handleChange, 
    handleSelectChange,
    coronerGroupedOptions
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
                // essaie d'abord selectOptions.deathRecordType, sinon deathRecordTypeOptions,
                // sinon fallback par défaut
                deathRecordType: toOptions(
                    options.deathRecordType || options.deathRecordTypeOptions || ['Identified', 'Unidentified']
                ),
                caseStatusOptions: toLabelValues(toOptions(options.caseStatusOptions || [])),
                bodyStatusOptions: toLabelValues(toOptions(options.bodyStatusOptions || [])),
                gender: toLabelValues(toOptions(options.gender || [])),
                mannerOfDeathOptions: toLabelValues(toOptions(options.mannerOfDeathOptions || [])),
                });
            }
        });
    }, []);

    return (
        <>
            <p>Ce formulaire est utilisé pour documenter un décès. Veuillez remplir tous les champs obligatoires avec précision. Le formulaire est ensuite enregistré dans le suivi des rapports du coroner.</p>
            <Form.Group className="mb-3">
                <Form.Label>Type de dossier de décès</Form.Label>
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
                        <Form.Control type="text" name="decedentName" value={formData.decedentName} onChange={handleChange} placeholder="Prénom & Nom" className="form-control" />
                        <Form.Control type="text" name="decedentOOC" value={formData.decedentOOC} onChange={handleChange} placeholder="(( Nom du défunt (HRP) ))" className="form-control" />
                        <Form.Control type="text" name="patientID" value={formData.patientID || ''} onChange={handleChange} placeholder="ID Patient (optionnel)" className="form-control" />
                    </div>
                    <Form.Label>Date du décès</Form.Label>

                    <div style={{ display: 'flex', gap: '10px' }}>
                        <Form.Control type="date" name="dateOfDeath" value={formData.dateOfDeath} onChange={handleChange} className="form-control" />

                        <Form.Select name="caseStatus" value={formData.caseStatus} onChange={handleChange} className="form-control">
                            <option value="">Statut du cas</option>
                            {selectOptions.caseStatusOptions.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </Form.Select>
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                        <Form.Select name="bodyStatus" value={formData.bodyStatus} onChange={handleChange} className="form-control">
                            <option value="">Statut de libération du corps</option>
                            {selectOptions.bodyStatusOptions.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </Form.Select>

                        <Form.Select name="sex" value={formData.sex} onChange={handleChange} className="form-control">
                            <option value="">Genre à l'état civil du défunt</option>
                            {selectOptions.gender.map(option => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </Form.Select>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <Form.Control type="text" name="ethnicity" value={formData.ethnicity} onChange={handleChange} placeholder="Ethnicité du défunt" className="form-control"/>
                        <Form.Control type="text" name="placeOfDeath" value={formData.placeOfDeath} onChange={handleChange} placeholder="Lieu du décès (Numéro, Étage, Rue)" className="form-control"/>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <Form.Control type="text" name="age" value={formData.age} onChange={handleChange} placeholder="Âge du défunt" className="form-control" />

                        <Form.Select name="manner" value={formData.manner} onChange={handleChange} className="form-control">
                            <option value="">Mode de décès</option>
                            {selectOptions.mannerOfDeathOptions.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </Form.Select>
                    </div>


                    {formData.deathRecordType === 'Unidentified' && (
                        <>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <Form.Control type="text" name="hairColor" value={formData.hairColor} onChange={handleChange} placeholder="Couleur des cheveux" className="form-control"/>
                                <Form.Control type="text" name="eyeColor" value={formData.eyeColor} onChange={handleChange} placeholder="Couleur des yeux" className="form-control"/>
                                <Form.Control type="text" name="weight" value={formData.weight} onChange={handleChange} placeholder="Poids" className="form-control"/>
                            </div>

                            <div style={{ display: 'flex', gap: '10px' }}>
                                <Form.Control type="text" name="height" value={formData.height} onChange={handleChange} placeholder="Taille" className="form-control"/>

                                <Form.Control as="textarea" rows={1} name="tattoos" value={formData.tattoos} onChange={handleChange} placeholder="Tatouages ou Aucun" className="form-control" />

                                <Form.Control as="textarea" rows={1} name="jewelry" value={formData.jewelry} onChange={handleChange} placeholder="Bijoux ou Aucun" className="form-control"/>
                            </div>

                            <Form.Group className="mb-3">
                                <Form.Control as="textarea" rows={3} name="comments" value={formData.comments} onChange={handleChange} placeholder="Commentaires..." className="form-control" />
                            </Form.Group>
                        </>
                    )}

                    {formData.deathRecordType !== 'Unidentified' && (
                        <>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <Form.Control type="text" name="causeA" value={formData.causeA} onChange={handleChange} placeholder="Entrez la cause A" className="form-control" />
                                <Form.Control type="text" name="causeB" value={formData.causeB} onChange={handleChange} placeholder="Entrez la cause B" className="form-control"/>
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <Form.Control type="text" name="causeC" value={formData.causeC} onChange={handleChange} placeholder="Entrez la cause C" className="form-control"/>
                                <Form.Control type="text" name="causeD" value={formData.causeD} onChange={handleChange} placeholder="Entrez la cause D" className="form-control"/>
                            </div>
                            <Form.Control as="textarea" rows={3} name="otherSignificantConditions" value={formData.otherSignificantConditions} onChange={handleChange} placeholder="Entrez d'autres informations significatives" className="form-control" />
                        </>
                    )}
                    <Form.Label>Examinateur médical</Form.Label>
                    <Select
                        name="coronerEmployee"
                        value={coronerGroupedOptions
                            .flatMap(group => group.options)
                            .find(option => option.value === formData.coronerEmployee) || null}
                        onChange={(selectedOption) => handleSelectChange(selectedOption, { name: 'coronerEmployee' })}
                        options={coronerGroupedOptions}
                        isClearable
                        placeholder="Sélectionner un coroner. (Vous pouvez taper pour rechercher!)"
                        className="form-control"
                        styles={{ 
                            control: (base, state) => ({
                                ...base,
                                backgroundColor: '#16202c',
                                color: '#eeeeeeb0',
                                borderColor: !formData.coronerEmployee ? '#dc3545' : (state.isFocused ? '#86b7fe' : '#6c757d'),
                                '&:hover': {
                                    borderColor: !formData.coronerEmployee ? '#dc3545' : '#86b7fe'
                                },
                                boxShadow: !formData.coronerEmployee ? '0 0 0 0.25rem rgba(220, 53, 69, 0.25)' : (state.isFocused ? '0 0 0 0.25rem rgba(13, 110, 253, 0.25)' : null),
                            }),
                            menu: (base) => ({ ...base, backgroundColor: '#16202c', zIndex: 1000 }),
                            option: (base, state) => ({ ...base, backgroundColor: state.isFocused ? 'Grey' : '#16202c', color: '#eeeeeeb0' }),
                            singleValue: (base) => ({ ...base, color: '#eeeeeeb0' }),
                            input: (base) => ({ ...base, color: '#eeeeeeb0' }),
                            placeholder: (base) => ({ ...base, color: '#eeeeeeb0' }),
                            group: (base) => ({ ...base, paddingTop: 8, paddingBottom: 8 }),
                            groupHeading: (base) => ({ ...base, color: '#9aa7b4', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.75rem', marginBottom: 4 })
                        }}
                    />
                    <Form.Label></Form.Label>
                    <Form.Label>Examinateur médical en chef ou Examinateur médical en chef adjoint </Form.Label>
                    <Select
                        name="chiefMedicalExaminer"
                        value={coronerGroupedOptions
                            .flatMap(group => group.options)
                            .find(option => option.value === formData.chiefMedicalExaminer) || null}
                        onChange={(selectedOption) => handleSelectChange(selectedOption, { name: 'chiefMedicalExaminer' })}
                        options={coronerGroupedOptions}
                        isClearable
                        placeholder="Sélectionner un examinateur médical en chef (Vous pouvez taper pour rechercher!)"
                        className="form-control"
                        styles={{ 
                            control: (base, state) => ({
                                ...base,
                                backgroundColor: '#16202c',
                                color: '#eeeeeeb0',
                                borderColor: !formData.chiefMedicalExaminer ? '#dc3545' : (state.isFocused ? '#86b7fe' : '#6c757d'),
                                '&:hover': {
                                    borderColor: !formData.chiefMedicalExaminer ? '#dc3545' : '#86b7fe'
                                },
                                boxShadow: !formData.chiefMedicalExaminer ? '0 0 0 0.25rem rgba(220, 53, 69, 0.25)' : (state.isFocused ? '0 0 0 0.25rem rgba(13, 110, 253, 0.25)' : null),
                            }),
                            menu: (base) => ({ ...base, backgroundColor: '#16202c', zIndex: 1000 }),
                            option: (base, state) => ({ ...base, backgroundColor: state.isFocused ? 'Grey' : '#16202c', color: '#eeeeeeb0' }),
                            singleValue: (base) => ({ ...base, color: '#eeeeeeb0' }),
                            input: (base) => ({ ...base, color: '#eeeeeeb0' }),
                            placeholder: (base) => ({ ...base, color: '#eeeeeeb0' }),
                            group: (base) => ({ ...base, paddingTop: 8, paddingBottom: 8 }),
                            groupHeading: (base) => ({ ...base, color: '#9aa7b4', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.75rem', marginBottom: 4 })
                        }}
                    />
                    <Form.Label></Form.Label>

                </>
            )}
        </>
    );
};

export default DeathRecord;