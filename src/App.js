import FieldGuide from './components/FieldGuide';
import { useState } from 'react';
import { HashRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider, useNotification } from './contexts/NotificationContext';
import { FormProvider } from './contexts/FormContext';
import { DataProvider } from './contexts/DataContext';
import * as Sentry from "@sentry/react";
import { sendDiscordErrorWebhook } from './index';

import MainApp from './MainApp';
import GtaLogin from './components/Auth/GtaLogin';
import GtaCallback from './components/Auth/GtaCallback';
import Admin from './components/Admin/Admin';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import PasswordResetHandler from './components/Auth/PasswordResetHandler';
import FleecaPaymentSuccess from './components/FleecaPaymentSuccess';
import TransparencyPage from './components/Transparency/TransparencyPage';
import MemorialPage from './components/Memorial/MemorialPage';
import HospitalPlanPage from './components/Directory/HospitalPlanPage';
import ReportLinkPage from './components/ReportLinkPage';
import DeepLinkPage from './components/DeepLinkPage';
import DeceasedGuard from './components/DeceasedGuard';

function App() {
    const [formData, setFormData] = useState({});
    const [lastWebhookIdentifier, setLastWebhookIdentifier] = useState(null);
    const [setShowAdblockNotification] = useState(false);

    const { showNotification, removeNotification } = useNotification();

const initialFormData = {
    // Core user state to preserve
    phmcEmployee: '',
    coronerEmployee: '',
    coronerBadge: '',
    coronerRank: '',
    coronerDiscord: '',
    coronerPHNumber: '50056',
    lastName: '',
    phmcRank: '',
    // Common form fields
    department: '',
    dateTime: '',
    date: '',
    decedentName: '',
    decedentOOC: '',
    synopsis: '',
    scenePhotos: '',
    additionalImages: '',
    patientID: '',
    patientName: '',
    patientAddress: '',
    massFatality: false,
    patientRace: '',
    patientGender: '',
    patientPH: '',
    patientDiscord: '',
    patientEmergencyContact: '',
    patientEmergencyContactNumber: '',
    patientEmergencyContactRelation: '',
    decedents: [],
    patientEmergencyContactDiscord: '',
    patientTitle: '',
    patientTitleOptions: '',
    patientAllergies: '',
    patientCurrentMedicine: '',
    patientChronicDiseases: '',
    patientNotes: '',
    patientDateOfBirth: '',
    patientBloodType: '',
    patientChiefComplaint: '',
    patientProcedure: '',
    patientDiagnosis: '',
    patientSecondaryDiagnosis: '',
    patientMedicine: '',
    admission: '',
    followup: '',
    SubmitDate: new Date().toISOString().split('T')[0],
    patientExercise: '',
    // Form-specific fields
    placeOfDeath: '',
    evidenceLockerID: '',
    evidenceLocker: '',
    pronouncedTimeOfDeath: '',
    mannerOfDeath: '',
    typeOfDeath: '',
    showRequestingOfficerInput: false,
    requestingOfficer: '',
    deathReport: '',
    additionalReports: [],
    additionalPatientIDs: [],
    autopsyDate: '',
    autopsyTime: '',
    autopsyDeathCauses: [''],
    autopsyAnatomicSummaryItems: [''],
    autopsyAlbumUrl: '',
    autopsyPhotosUnavailable: false,
    autopsyDiagramMarkers: [],
    autopsyDiagramImgurUrl: '',
    externalExamination: '',
    RadiologyResult: '',
    deathType: '',
    causeOfDeath: '',
    extraStaff: [],
    patientSummaryConsultation: '',
    patientSummary: '',
    surgeryProcedures: '',
    patientConsentOption: '',
    patientComplicationOptions: '',
    procedureGoodOptions: '',
    patientHeight: '',
    patientWeight: '',
    BodyMassIndex: '',
    temperature: '',
    heartRate: '',
    breathing: '',
    bloodPressure: '',
    patientJob: '',
    patientJobRisks: '',
    patientAllergiesRisk: '',
    patientMedicineRegular: '',
    patientOther: '',
    predisposition: '',
    patientCareer: '',
    patientImpairments: '',
    patientTriggers: '',
    patientFamily: '',
    patientFam: '',
    patientMedicalRecord: '',
    patientVisitReason: '',
    patientSymptoms: '',
    patientDrugs: '',
    patientDrugsUsage: '',
    patientMental: '',
    patientFamSocial: '',
    patientLegal: '',
    patientRelationship: '',
    patientFindings: '',
    patientTreatmentPlan: '',
    patientSafety: '',
    patientFollowUp: '',
    patientTreatmentMedicine: '',
    patientTherapy: '',
    patientRiskAssessment: '',
    Speech: '',
    Behavior: '',
    Appearance: '',
    Mood: '',
    Affect: '',
    Risk: '',
    ThoughtProcess: '',
    ThoughtContent: '',
    Insight: '',
    Cognition: '',
    painLevel: '',
    findings: '',
    lungs: '',
    pupils: '',
    wounds: '',
    ecg: '',
    sono: '',
    lab: [],
    bloodOxy: '',
    assignedDepartment: '',
    departmentLarge: '',
    paletoClinicDepartment: '',
    MedicalRecordsRelease: [],
    releaseReports: [],
    releasePractitionerAuto: false,
    payNow: false,
    paymentProofPhotos: '',
    fleecaPaymentId: '',
    PurposeMedicalInformationReleaseFormat: '',
    CarePurposeMedicalInformationRelease: '',
    patientMedInfoReleaseOther: '',
    MedicalRecordsReleaseOther: '',
    patientMedInfoFormatOther: '',
    StupidDateFrom: '',
    StupidDateTo: '',
    requestingAuthority: '',
    requestingAuthorityRef: '',
    guardianName: '',
    guardianRelation: '',
    patientEmancipated: false,
    patientFirstName: '',
    patientMiddleName: '',
    patientLastName: '',
    patientEmail: '',
    patientZIP: '',
    dnr: '',
    dnrOrder: '',
    attorney: '',
    dnrOther: '',
    attorneyName: '',
    attorneyRelation: '',
    attorneyPH: '',
    maritalStatus: '',
    numberChildren: '',
    financialStatus: '',
    patientSupport: '',
    patientHarm: '',
    patientGenetic: '',
    patientReligion: '',
    patientSmoker: '',
    patientAlcohol: '',
    patientDiet: '',
    patientSleep: '',
    patientSexLife: '',
    patientHazards: '',
    prescriptionImage: '',
    attachedReportSummary: '',
    emailPurpose: '',
    emailRecipient: '',
    dateOfVisit: '',
    sicknessStartDate: '',
    sicknessEndDate: '',
    reasonForSickness: '',
    illnessCondition: '',
    confirmationPurpose: '',
    phmcEmployeeSignatureImage: '',

    // Recruitment Fields
    recruitmentPosition: '',
    applicantTitle: '',
    applicantFirstName: '',
    applicantMiddleName: '',
    applicantLastName: '',
    applicantDOB: '',
    applicantZIP: '',
    applicantZIPCity: '',
    applicantCitizenship: '',
    applicantLocation: '',
    applicantEducationLevel: '',
    applicantEnrollmentStart: '',
    applicantEnrollmentEnd: '',
    applicantEnrollmentOngoing: false,
    applicantJobs: [],
    applicantLicense: '',
    applicantNoExperience: false,
    applicantPhone: '',
    applicantEmail: '',
    applicantSchoolName: '',
    applicantMajor: '',
    applicantLanguages: [],
    exemptCheckbox: false,
    oocMedicalExperience: '',
        applicantTitleAndFullName: '',
        applicantAddress: '',
        emsLicenseLink: '',
        emsPartTimeReason: '',
        oocDiscord: '',
        oocTimezone: '',
        oocOtherCharLicenseProof: '',
        dfpSanFireLink: '',
        dfpPhmcLink: '',
        dfpLegalFactionLink: '',

    // Imaging Fields
    Imaging: [],
    XrayResults: [],
    ctResults: [],
    mriResults: [],
    ultrasoundResults: [],
        patientTitleNew: '',
    patientNameNew: '',
    patientDateOfBirthNew: '',
    patientAddressNew: '',
    patientPHNew: '',
    patientDiscordNew: '',
    patientGenderNew: '',
    patientRaceNew: '',


};
    return (
        <Sentry.ErrorBoundary
            fallback={(
                <p style={{ padding: "16px", textAlign: "center", lineHeight: 1.6 }}>
                    Une erreur fatale inattendue s'est produite. Veuillez en informer le développeur sur le{" "}
                    <a href="https://discord.gg/Qupn5tWc6H" target="_blank" rel="noopener noreferrer">serveur Discord du PHMC</a>
                    {" "}en pensant à mentionner (ping) <strong>Luckyle</strong>.
                </p>
            )}
            onError={(error, componentStack) => {
                sendDiscordErrorWebhook({
                    message: error.message,
                    stack: componentStack,
                    source: 'React ErrorBoundary',
                    isButtonClickError: false, // In a React Error Boundary, we may not be able to determine this easily.
                });
            }}
        >
            <DataProvider>
                <FormProvider initialFormData={initialFormData} setFormData={setFormData} setLastWebhookIdentifier={setLastWebhookIdentifier} showNotification={showNotification}>
                    <NotificationProvider>
                        <AuthProvider>
                            <FieldGuide />
                            <Router>
                                <DeceasedGuard>
                                <Routes>
                                    <Route path="/" element={<MainApp formData={formData} setFormData={setFormData} lastWebhookIdentifier={lastWebhookIdentifier} setLastWebhookIdentifier={setLastWebhookIdentifier} initialFormData={initialFormData} showNotification={showNotification} removeNotification={removeNotification} setShowAdblockNotification={setShowAdblockNotification} />} />
                                    <Route path="/reset-password" element={<PasswordResetHandler />} />
                                    <Route path="/payment/success" element={<FleecaPaymentSuccess />} />
                                    <Route path="/transparence" element={<TransparencyPage />} />
                                    <Route path="/hommage" element={<MemorialPage />} />
                                    <Route path="/plan" element={<HospitalPlanPage />} />
                                    <Route path="/rapport/:node/:key" element={<ReportLinkPage />} />
                                    <Route path="/message/:id" element={<DeepLinkPage kind="message" />} />
                                    <Route path="/poste/:category/:key" element={<DeepLinkPage kind="poste" />} />
                                    <Route path="/candidature/:uid/:id" element={<DeepLinkPage kind="candidature" />} />
                                    <Route path="/login" element={<GtaLogin />} />
                                    <Route path="/auth/gta/callback" element={<GtaCallback />} />
                                    <Route path="/admin" element={<ProtectedRoute><Admin formData={formData} setFormData={setFormData} showNotification={showNotification} /></ProtectedRoute>} />
                                    <Route path="*" element={<Navigate to="/" replace />} />
                                </Routes>
                                </DeceasedGuard>
                            </Router>
                        </AuthProvider>
                    </NotificationProvider>
                </FormProvider>
            </DataProvider>
        </Sentry.ErrorBoundary>
    );
}

export default App;
