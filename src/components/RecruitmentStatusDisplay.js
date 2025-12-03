// src/components/RecruitmentStatusDisplay.js
import React, { useEffect } from 'react';

const RecruitmentStatusDisplay = ({
    selectedAgencyGroup,
    bbCodeVersion,
    physicianRecruitmentDetails,
    psychRecruitmentDetails,
    adminRecruitmentDetails,
    emsRecruitmentDetails,
    nurseRecruitmentDetails,
    coronerRecruitmentDetails,
}) => {
    useEffect(() => {
    }, [selectedAgencyGroup, bbCodeVersion]);

    let mainTitle = "Recruitment Overview";
    let sectionsToShow = [];

    if (selectedAgencyGroup === 'PHMC Recruitment') {
        const allPhmcSections = [
            { title: "Postes Médicaux", data: physicianRecruitmentDetails, groupFilter: "Physician", isActive: bbCodeVersion === 50 },
            { title: "Postes Psychologue/Psychiatre", data: psychRecruitmentDetails, groupFilter: "Psych", isActive: bbCodeVersion === 51 },
            { title: "Postes Administratifs", data: adminRecruitmentDetails, groupFilter: "Admin", isActive: bbCodeVersion === 52 },
            { title: "Postes Infirmiers", data: nurseRecruitmentDetails, groupFilter: "Nurse", isActive: bbCodeVersion === 53 },
            { title: "Postes DMEC", data: coronerRecruitmentDetails, groupFilter: "Coroner", isActive: bbCodeVersion === 54 },
            { title: "Postes EMS", data: emsRecruitmentDetails, groupFilter: "EMS", isActive: bbCodeVersion === 55 },
        ];

        const activeSection = allPhmcSections.find(s => s.isActive);

        if (activeSection) {
            // A specific PHMC Recruitment form is active, show its status
            mainTitle = `Statut des ${activeSection.title}`;
            sectionsToShow = [activeSection];
        } else {
            // If selectedAgencyGroup is 'PHMC Recruitment' but the current bbCodeVersion
            // does NOT correspond to any of the defined PHMC Recruitment forms (e.g., bbCodeVersion: 1),
            // then this component should not display anything for this group.
            return null;
        }
    } else {
        // Not PHMC Recruitment or SAAA group, so component is not active.
        return null;
    }

    // Filter out sections that have no data.
    sectionsToShow = sectionsToShow.filter(section => section.data && Object.keys(section.data).length > 0);

    if (sectionsToShow.length === 0) {
        // This means the group was relevant (e.g., PHMC Recruitment with an active section, or SAAA),
        // but the relevant section(s) had no actual position data.
        return (
            <div className="recruitment-status-box" style={styles.statusBoxBase}>
                <h5 style={{...styles.mainTitleStyle, borderColor: selectedAgencyGroup === 'SAAA' ? '#0dcaf0' : '#495057', color: selectedAgencyGroup === 'SAAA' ? '#0dcaf0' : '#f8f9fa'}}>
                    {mainTitle}
                </h5>
                <p style={styles.noDataText}>Aucune donnée de recrutement disponible pour ce groupe ou cette catégorie.</p>
            </div>
        );
    }
    
    return (
        <div
            className="recruitment-status-box"
            style={{
                ...styles.statusBoxBase,
                borderColor: selectedAgencyGroup === 'SAAA' ? '#0dcaf0' : '#495057',
            }}
        >
            <h5 style={{
                ...styles.mainTitleStyle,
                borderColor: selectedAgencyGroup === 'SAAA' ? '#0dcaf0' : '#495057',
                color: selectedAgencyGroup === 'SAAA' ? '#0dcaf0' : '#f8f9fa',
            }}>
                {mainTitle}
            </h5>

            {sectionsToShow.map((section, index) => {
                if (!section.data || Object.keys(section.data).length === 0) {
                    return null;
                }

                const positions = Object.values(section.data).filter(pos => pos.group === section.groupFilter);
                const openPositions = positions.filter(pos => pos.status === "OPEN");
                const closedPositions = positions.filter(pos => pos.status === "CLOSED");

                const sectionStyle = (index > 0 && sectionsToShow.length > 1) ? { marginTop: '1.5rem' } : {};

                if (positions.length === 0) {
                    return (
                        sectionsToShow.length > 1 ? (
                            <div key={section.title} style={sectionStyle}>
                                <h6 style={styles.sectionTitleStyle}>{section.title}:</h6>
                                <p style={styles.noDataText}>Aucun poste actuellement listé ou le statut n'est pas défini pour cette catégorie.</p>
                            </div>
                        ) : (
                            <div key={section.title} style={sectionStyle}>
                                <p style={styles.noDataText}>Aucun poste actuellement listé ou le statut n'est pas défini pour cette catégorie.</p>
                            </div>
                        )
                    );
                }

                return (
                    <div key={section.title} style={sectionStyle}>
                        {sectionsToShow.length > 1 && (
                            <h6 style={styles.sectionTitleStyle}>{section.title}:</h6>
                        )}
                        {openPositions.length > 0 && (
                            <div style={{ marginBottom: '0.5rem' }}>
                                <strong style={styles.openStrong}>Postes Ouverts :</strong>
                                <ul style={styles.listStyle}>
                                    {openPositions.map(pos => (
                                        <li key={`${section.title}-open-${pos.displayName}`} style={styles.listItemStyle}>
                                            <span style={styles.openSpan}>{pos.displayName}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {closedPositions.length > 0 && (
                            <div>
                                <strong style={styles.closedStrong}>Postes Fermés :</strong>
                                <ul style={styles.listStyle}>
                                    {closedPositions.map(pos => (
                                        <li key={`${section.title}-closed-${pos.displayName}`} style={{ ...styles.listItemStyle, color: '#dc3545' }}>
                                            {pos.displayName} (Candidatures Fermées)
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {openPositions.length === 0 && closedPositions.length === 0 && (
                             <p style={styles.noDataText}>Tous les postes ne sont actuellement ni explicitement ouverts ni fermés, ou le statut n'est pas défini pour {section.title}.</p>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

const styles = {
    statusBoxBase: {
        marginBottom: '2.5rem',
        padding: '1rem',
        borderRadius: '0.3rem',
        backgroundColor: '#2c3034',
        color: '#f8f9fa',
        border: '1px solid',
    },
    mainTitleStyle: {
        borderBottom: '1px solid',
        paddingBottom: '0.5rem',
        marginBottom: '1rem',
    },
    sectionTitleStyle: {
        color: '#6cb2eb',
        fontWeight: 'bold',
        marginBottom: '0.5rem',
    },
    listStyle: {
        listStyleType: 'disc',
        paddingLeft: '20px',
        marginBlockStart: '0.3em',
        fontSize: '0.9em',
    },
    listItemStyle: {
        marginBottom: '0.2rem',
    },
    openStrong: { color: '#28a745' },
    openSpan: { color: '#28a745' },
    closedStrong: { color: '#dc3545' },
    noDataText: {
        color: '#6c757d',
        fontSize: '0.9em',
        marginLeft: '20px',
    },
};

export default RecruitmentStatusDisplay;
