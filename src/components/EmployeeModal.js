import React, { useState, useMemo, useEffect } from 'react';
import { Form, Button } from 'react-bootstrap';
import Select from 'react-select';
import { database, auth } from '../firebase';
import { ref, get, set, push, update } from 'firebase/database';
import { onAuthStateChanged } from 'firebase/auth';
import { useEmployeeAuth } from '../contexts/EmployeeAuthContext';
import { PHMC_RANKS, CORONER_RANKS } from '../constants/ranks';

// --- Styles ---
const modalOverlayStyle = {
  position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
  backgroundColor: 'rgba(0, 0, 0, 0.7)', display: 'flex',
  justifyContent: 'center', alignItems: 'center', zIndex: 1050,
};
const modalContentStyle = {
  backgroundColor: '#0d1117', color: '#c9d1d9', padding: '20px',
  borderRadius: '5px', width: '90%',
  maxWidth: '750px',
  maxHeight: '90vh',
  overflowY: 'auto',
  position: 'relative',
  border: '1px solid #30363d',
};
const modalHeaderStyle = {
  fontSize: '1.2em', fontWeight: 'bold', marginBottom: '15px',
  borderBottom: '1px solid #30363d', paddingBottom: '10px',
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  color: '#c9d1d9',
};
const modalTitleStyle = { margin: 0 };
const closeButtonStyle = {
  background: 'none', border: 'none', color: '#c9d1d9',
  fontSize: '24px', cursor: 'pointer', lineHeight: '1', padding: '0 5px',
};
const modalBodyStyle = { paddingTop: '10px' };
const modalFooterStyle = {
  borderTop: '1px solid #30363d', paddingTop: '15px', marginTop: '20px',
  display: 'flex', justifyContent: 'flex-end', gap: '10px',
};
const formControlStyle = {
  backgroundColor: '#0d1117', color: '#c9d1d9',
  borderColor: '#30363d', width: '100%',
};
const formLabelStyle = {
  color: '#c9d1d9',
  marginBottom: '8px',
  marginTop: '10px',
  display: 'block',
};
const reactSelectStyles = {
  control: (base) => ({
    ...base,
    backgroundColor: '#0d1117',
    color: '#c9d1d9',
    borderColor: '#30363d',
    '&:hover': { borderColor: '#c9d1d9' }
  }),
  menu: (base) => ({ ...base, backgroundColor: '#0d1117', zIndex: 1051 }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isFocused ? '#1f2937' : '#0d1117',
    color: '#c9d1d9',
    '&:hover': { backgroundColor: '#1f2937' }
  }),
  singleValue: (base) => ({ ...base, color: '#c9d1d9' }),
  input: (base) => ({ ...base, color: '#c9d1d9' }),
  placeholder: (base) => ({ ...base, color: '#6c757d' }),
  group: (base) => ({ ...base, paddingTop: 8, paddingBottom: 8 }),
  groupHeading: (base) => ({ ...base, color: '#6c757d', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.75rem', marginBottom: 4 })
};
// --- End Styles ---

// map|array|null -> array
const ensureArray = (v) => (Array.isArray(v) ? v : v && typeof v === 'object' ? Object.values(v) : []);

// Envoie une notification webhook Discord lors d'une demande en attente (modification ou autre)
const sendPendingRequestWebhook = async (isCoroner, type, data) => {
  const webhookURL = isCoroner
    ? process.env.REACT_APP_CORONER_DISCORD_UPDATES
    : process.env.REACT_APP_PHMC_DISCORD;
  if (!webhookURL) return;
  try {
    let embed;
    if (type === 'modification') {
      const changes = [];
      if ((data.newData.name || '') !== (data.oldData.name || ''))
        changes.push({ name: "Nom", value: `~~${data.oldData.name}~~ → **${data.newData.name}**`, inline: true });
      if ((data.newData.rank || '') !== (data.oldData.rank || ''))
        changes.push({ name: "Grade", value: `~~${data.oldData.rank || 'N/A'}~~ → **${data.newData.rank || 'N/A'}**`, inline: true });
      if ((data.newData.badge || '') !== (data.oldData.badge || ''))
        changes.push({ name: "Badge", value: `~~${data.oldData.badge || 'N/A'}~~ → **${data.newData.badge || 'N/A'}**`, inline: true });
      if ((data.newData.discord || '') !== (data.oldData.discord || ''))
        changes.push({ name: "Discord", value: `~~${data.oldData.discord || 'N/A'}~~ → **${data.newData.discord || 'N/A'}**`, inline: true });
      if ((data.newData.phNumber || '') !== (data.oldData.phNumber || ''))
        changes.push({ name: "Téléphone", value: `~~${data.oldData.phNumber || 'N/A'}~~ → **${data.newData.phNumber || 'N/A'}**`, inline: true });
      embed = {
        title: `✏️ Demande de modification — ${isCoroner ? 'DMEC' : 'PHMC'}`,
        color: 0xFFA500,
        description: `**${data.requestedBy}** a soumis une demande de modification de ses informations.`,
        fields: changes.length > 0 ? changes : [{ name: "Modifications", value: "Informations mises à jour (aucun changement détecté).", inline: false }],
        timestamp: new Date().toISOString(),
        footer: { text: "PHMC-FR Tools — En attente d'approbation admin" }
      };
    }
    if (!embed) return;
    await fetch(webhookURL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] })
    });
  } catch (err) {
    console.warn('Failed to send pending request webhook:', err);
  }
};

// Retourne la paire [key, obj] par name pour une map ou un array
const findEntryByName = (data, name) => {
  if (!data || !name) return null;
  const lower = name.toLowerCase();
  if (Array.isArray(data)) {
    const idx = data.findIndex(e => (e?.name || '').toLowerCase() === lower);
    return idx >= 0 ? [String(idx), data[idx]] : null; // fallback index pour legacy array
  }
  for (const [k, v] of Object.entries(data)) {
    if ((v?.name || '').toLowerCase() === lower) return [k, v];
  }
  return null;
};

const EmployeeModal = ({
  show,
  onHide,
  phmcList,
  handleMissingEmployeeSubmit,
  showNotification,
  coronerList,
  isLoadingData,
  isAdminAuthenticated,
  adminUserEmail
}) => {
  const [actionType, setActionType] = useState('addEmployee');
  const [employeeType, setEmployeeType] = useState('coroner');
  const [selectedEmployeeName, setSelectedEmployeeName] = useState('');
  const [newRank, setNewRank] = useState('');
  const [staffToRemove, setStaffToRemove] = useState([]);
  const [authorizedBy, setAuthorizedBy] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [refreshData, setRefreshData] = useState(false);
  const [currentAdminUser, setCurrentAdminUser] = useState(null);
  const [isAdminVerified, setIsAdminVerified] = useState(false);
  const { employeeProfile, isAdmin } = useEmployeeAuth();

  const [missingEmployeeData, setMissingEmployeeData] = useState({
    coronerName: '',
    coronerLastName: '',
    coronerDiscord: '',
    employeeLastName: '',
    coronerRank: '',
    coronerPHNumber: '',
    coronerBadge: '',
    phmcDiscord: '',
    phmcBadge: '',
    phmcPHNumber: '',
  });

  const handleActionTypeChange = (type) => {
    setActionType(type);
    setSelectedEmployeeName('');
    setNewRank('');
    // Par défaut on reste sur 'coroner' sauf si tu veux autre chose
  };

  const handleEmployeeTypeChange = (type) => {
    setEmployeeType(type);
    setSelectedEmployeeName('');
    setNewRank('');
  };

  const handleSelectChange = (selectedOption) => {
    setSelectedEmployeeName(selectedOption ? selectedOption.value : '');
    setNewRank('');
  };

  const handleNewRankChange = (e) => setNewRank(e.target.value);

  // Écouter l'état d'authentification Firebase en temps réel
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentAdminUser(user);
      if (user) {
        try {
          const adminUsersRef = ref(database, 'adminUsers');
          const adminSnapshot = await get(adminUsersRef);
          if (adminSnapshot.exists()) {
            const adminUsers = adminSnapshot.val();
            const adminList = Array.isArray(adminUsers) ? adminUsers : Object.values(adminUsers || {});
            const isUserAdmin = adminList.some(admin => 
              admin === user.email || 
              admin === user.uid ||
              (typeof admin === 'object' && (admin.email === user.email || admin.uid === user.uid))
            );
            setIsAdminVerified(isUserAdmin);
          } else {
            setIsAdminVerified(false);
          }
        } catch (err) {
          console.error('Error checking admin status:', err);
          setIsAdminVerified(false);
        }
      } else {
        setIsAdminVerified(false);
      }
    });
    return () => unsubscribe();
  }, []);
  const handleRemoveStaffChange = (opts) => setStaffToRemove(opts ? opts.map(o => o.value) : []);
  const handleAuthorizedByChange = (e) => setAuthorizedBy(e.target.value);
  const handleInputChange = (e) => setMissingEmployeeData({ ...missingEmployeeData, [e.target.name]: e.target.value });

  // Pré-remplissage en édition
  useEffect(() => {
    if (actionType === 'editUser' && selectedEmployeeName) {
      setIsLoading(true);
      const listRef = ref(database, employeeType === 'coroner' ? 'staff/coroner' : 'staff/phmc');
      get(listRef)
        .then((snapshot) => {
          if (!snapshot.exists()) {
            showNotification('Aucune donnée sur les employés n\'est disponible.', 'warning');
            return;
          }
          const entry = findEntryByName(snapshot.val(), selectedEmployeeName);
          const employeeData = entry ? entry[1] : null;
          if (!employeeData) {
            showNotification('Données de l\'employé introuvables.', 'warning');
            return;
          }
          // Extraire uniquement les chiffres du badge stocké (format "PREFIX-XXXXX")
          const storedBadge = employeeData.badge || '';
          const badgeDigits = storedBadge.includes('-') ? storedBadge.split('-').slice(1).join('') : storedBadge;
          // Séparer prénom / nom
          // Pour PHMC : name = prénom seulement, lastName = nom → pas de découpe
          // Pour DMEC : name = nom complet → découpe sur le dernier mot, ou firstName si disponible
          const fullNameParts = (employeeData.name || '').split(' ');
          const isPhmc = employeeType !== 'coroner';
          const coronerFirstName = isPhmc
            ? (employeeData.name || '')
            : (employeeData.firstName
                || (fullNameParts.length > 1 ? fullNameParts.slice(0, -1).join(' ') : (fullNameParts[0] || '')));
          const coronerLastNamePart = isPhmc
            ? ''
            : (employeeData.firstName
                ? (employeeData.name || '').slice(employeeData.firstName.length).trim()
                : (fullNameParts.length > 1 ? fullNameParts[fullNameParts.length - 1] : ''));
          setMissingEmployeeData({
            coronerName: coronerFirstName,
            coronerLastName: coronerLastNamePart,
            coronerDiscord: employeeData.discord || '',
            employeeLastName: employeeData.lastName || '',
            coronerRank: employeeData.rank || '',
            coronerPHNumber: employeeData.phNumber || '',
            coronerBadge: badgeDigits,
            phmcDiscord: employeeData.discord || '',
            phmcBadge: badgeDigits,
            phmcPHNumber: employeeData.phNumber || '',
          });
        })
        .catch((err) => {
          console.error('Error fetching employee data:', err);
          showNotification(`Échec de la récupération des données de l'employé : ${err.message}`, 'error');
        })
        .finally(() => setIsLoading(false));
    }
  }, [actionType, selectedEmployeeName, employeeType, showNotification, refreshData]);

  const handleSubmit = async () => {
    // Vérification de l'authentification admin avec Firebase Auth
    if (!currentAdminUser) {
      showNotification('Accès refusé : Vous devez être connecté en tant qu\'administrateur pour effectuer cette action.', 'error');
      return;
    }

    // Pour editUser, permettre à l'employé de soumettre une demande de modification
    if (actionType === 'editUser' && employeeProfile && selectedEmployeeName === employeeProfile.name && !isAdminVerified) {
      // L'employé peut soumettre une demande de modification, pas besoin de vérifier adminUsers
      setIsLoading(true);
    } else {
      // Pour toutes les autres actions, vérifier que l'utilisateur est admin
      try {
        const adminUsersRef = ref(database, 'adminUsers');
        const adminSnapshot = await get(adminUsersRef);
        
        if (!adminSnapshot.exists()) {
          showNotification('Accès refusé : Vous n\'êtes pas autorisé à effectuer cette action.', 'error');
          return;
        }

        const adminUsers = adminSnapshot.val();
        const adminList = Array.isArray(adminUsers) ? adminUsers : Object.values(adminUsers || {});
        const isAdminAuthorized = adminList.some(admin => 
          admin === currentAdminUser.email || 
          admin === currentAdminUser.uid ||
          (typeof admin === 'object' && (admin.email === currentAdminUser.email || admin.uid === currentAdminUser.uid))
        );

        if (!isAdminAuthorized) {
          showNotification('Accès refusé : Vous n\'êtes pas dans la liste des administrateurs autorisés.', 'error');
          return;
        }
      } catch (err) {
        console.error('Error checking admin authorization:', err);
        showNotification(`Erreur lors de la vérification des autorisations : ${err.message}`, 'error');
        return;
      }

      setIsLoading(true);
    }

    // --- ADD EMPLOYEE ---
    if (actionType === 'addEmployee') {
      const isCoroner = employeeType === 'coroner';
      const required = isCoroner
        ? { coronerName: 'Prénom', coronerLastName: 'Nom', coronerDiscord: 'Discord', coronerRank: 'Grade', coronerBadge: 'Badge', coronerPHNumber: 'Numéro de téléphone' }
        : { coronerName: 'Prénom', employeeLastName: 'Nom', phmcDiscord: 'Discord', coronerRank: 'Grade', phmcBadge: 'Badge', phmcPHNumber: 'Numéro de téléphone' };

      const missing = Object.keys(required).filter(k => !missingEmployeeData[k]?.trim());
      if (missing.length) {
        showNotification(`Veuillez remplir tous les champs obligatoires : ${missing.map(k => required[k]).join(', ')}`, 'warning');
        setIsLoading(false);
        return;
      }

      // Validate badge: exactly 5 digits
      const badgeDigits = isCoroner ? missingEmployeeData.coronerBadge : missingEmployeeData.phmcBadge;
      if (!/^\d{5}$/.test(badgeDigits)) {
        showNotification('Le numéro de badge doit contenir exactement 5 chiffres.', 'warning');
        setIsLoading(false);
        return;
      }

      const rankList = isCoroner ? CORONER_RANKS : PHMC_RANKS;
      const selectedRankData = rankList.find(r => r.value === missingEmployeeData.coronerRank);
      const badgePrefix = selectedRankData?.badgePrefix || (isCoroner ? 'CO' : 'MD');
      const fullBadge = `${badgePrefix}-${badgeDigits}`;

      const newName = isCoroner
        ? `${missingEmployeeData.coronerName} ${missingEmployeeData.coronerLastName}`.trim()
        : `${missingEmployeeData.coronerName} ${missingEmployeeData.employeeLastName}`.trim();

      const payload = isCoroner
        ? {
            name: newName,
            firstName: missingEmployeeData.coronerName,
            discord: missingEmployeeData.coronerDiscord,
            rank: missingEmployeeData.coronerRank,
            badge: fullBadge,
            phNumber: missingEmployeeData.coronerPHNumber || '',
            category: missingEmployeeData.coronerRank
          }
        : {
            name: newName,
            lastName: missingEmployeeData.employeeLastName,
            discord: missingEmployeeData.phmcDiscord || '',
            phNumber: missingEmployeeData.phmcPHNumber || '',
            badge: fullBadge,
            rank: missingEmployeeData.coronerRank,
            category: missingEmployeeData.coronerRank
          };

      const basePath = isCoroner ? 'staff/coroner' : 'staff/phmc';
      const listRef = ref(database, basePath);

      try {
        const snap = await get(listRef);
        const existing = snap.exists() ? ensureArray(snap.val()) : [];
        const dup = existing.some(m => (m?.name || '').toLowerCase() === newName.toLowerCase());
        if (dup) {
          showNotification(`Le membre du personnel avec le nom "${newName}" existe déjà.`, 'warning');
          setIsLoading(false);
          return;
        }

        const newRef = push(listRef);     // génère une clé unique
        await set(newRef, payload);

        await handleMissingEmployeeSubmit('addEmployee', employeeType, newName, null, [], authorizedBy, missingEmployeeData, payload, currentAdminUser?.email);
        showNotification(`Ajout réussi de ${newName} à la liste des ${isCoroner ? 'coroners' : 'membres du personnel hospitalier'}.`, 'success');

        setRefreshData(prev => !prev);
        setMissingEmployeeData({ 
          coronerName: '', 
          coronerLastName: '',
          coronerDiscord: '', 
          employeeLastName: '', 
          coronerRank: '', 
          coronerPHNumber: '', 
          coronerBadge: '',
          phmcDiscord: '',
          phmcBadge: '',
          phmcPHNumber: '',
        });
      } catch (err) {
        console.error('Error adding staff member:', err);
        showNotification(`Erreur lors de l'ajout du membre du personnel : ${err.message}`, 'error');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // --- EDIT USER ---
    if (actionType === 'editUser') {
      if (!selectedEmployeeName) {
        showNotification('Aucun employé sélectionné pour la modification.', 'warning');
        setIsLoading(false);
        return;
      }

      const basePath = employeeType === 'coroner' ? 'staff/coroner' : 'staff/phmc';
      const listRef = ref(database, basePath);

      try {
        const snap = await get(listRef);
        if (!snap.exists()) {
          showNotification('Aucune donnée sur les employés n\'est disponible dans la base de données.', 'error');
          setIsLoading(false);
          return;
        }

        const data = snap.val();
        const entry = findEntryByName(data, selectedEmployeeName);
        if (!entry) {
          showNotification(`Employé "${selectedEmployeeName}" introuvable dans la base de données.`, 'error');
          setIsLoading(false);
          return;
        }
        const [key, employee] = entry;

        const updated = { ...employee };
        if (employeeType === 'coroner') {
          const coronerRankData = CORONER_RANKS.find(r => r.value === missingEmployeeData.coronerRank);
          const coronerBadgePrefix = coronerRankData?.badgePrefix || 'TF';
          const coronerBadgeDigits = missingEmployeeData.coronerBadge.replace(/\D/g, '');
          updated.name = `${missingEmployeeData.coronerName} ${missingEmployeeData.coronerLastName}`.trim();
          updated.firstName = missingEmployeeData.coronerName;
          updated.discord = missingEmployeeData.coronerDiscord;
          updated.rank = missingEmployeeData.coronerRank;
          updated.badge = coronerBadgeDigits ? `${coronerBadgePrefix}-${coronerBadgeDigits}` : missingEmployeeData.coronerBadge;
          updated.phNumber = missingEmployeeData.coronerPHNumber;
          updated.category = missingEmployeeData.coronerRank;
        } else {
          const phmcRankData = PHMC_RANKS.find(r => r.value === missingEmployeeData.coronerRank);
          const phmcBadgePrefix = phmcRankData?.badgePrefix || 'MD';
          const phmcBadgeDigits = missingEmployeeData.phmcBadge.replace(/\D/g, '');
          updated.name = missingEmployeeData.coronerName;
          updated.lastName = missingEmployeeData.employeeLastName;
          updated.discord = missingEmployeeData.phmcDiscord || '';
          updated.phNumber = missingEmployeeData.phmcPHNumber || '';
          updated.badge = phmcBadgeDigits ? `${phmcBadgePrefix}-${phmcBadgeDigits}` : missingEmployeeData.phmcBadge;
          updated.rank = missingEmployeeData.coronerRank;
          updated.category = missingEmployeeData.coronerRank;
        }

        // Si l'employé modifie ses propres informations, envoyer une demande de modification
        if (employeeProfile && selectedEmployeeName === employeeProfile.name && !isAdminVerified) {
          // Créer une demande de modification
          const modificationRequest = {
            requestId: `${Date.now()}_${selectedEmployeeName}`,
            originalName: selectedEmployeeName,
            oldData: employee,
            newData: updated,
            isCoroner: employeeType === 'coroner',
            requestedBy: employeeProfile.name,
            requestedAt: new Date().toISOString(),
            status: 'pending'
          };

          // Ajouter à la liste des demandes de modification
          const modRequestsRef = ref(database, 'pendingModificationRequests');
          const modSnapshot = await get(modRequestsRef);
          const existingRequests = modSnapshot.exists() ? 
            (Array.isArray(modSnapshot.val()) ? modSnapshot.val() : Object.values(modSnapshot.val())) : [];
          
          await set(modRequestsRef, [...existingRequests, modificationRequest]);

          // Notifier le canal Discord correspondant
          sendPendingRequestWebhook(employeeType === 'coroner', 'modification', modificationRequest);

          showNotification(`Demande de modification envoyée ! Un administrateur doit l'approuver.`, 'info');
          setSelectedEmployeeName('');
          setRefreshData(prev => !prev);
        } else {
          // Si c'est un admin, modifier directement
          await set(ref(database, `${basePath}/${key}`), updated);

          await handleMissingEmployeeSubmit('editUser', employeeType, selectedEmployeeName, newRank, staffToRemove, authorizedBy, missingEmployeeData, updated, currentAdminUser?.email);
          showNotification(`Mise à jour réussie des informations pour ${selectedEmployeeName}.`, 'success');
          setSelectedEmployeeName('');
          setRefreshData(prev => !prev);
        }
      } catch (err) {
        console.error('Error updating employee information in Firebase:', err);
        showNotification(`Erreur lors de la mise à jour des informations de l'employé : ${err.message}`, 'error');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // --- REMOVE STAFF ---
    if (actionType === 'removeStaff') {
      if (!staffToRemove?.length) {
        showNotification('Aucun membre du personnel sélectionné pour la suppression.', 'warning');
        setIsLoading(false);
        return;
      }
      if (!authorizedBy?.trim()) {
        showNotification('L\'autorisation est requise pour la suppression du personnel.', 'warning');
        setIsLoading(false);
        return;
      }

      try {
        const snap = await get(ref(database, 'staff'));
        if (!snap.exists()) {
          showNotification('Aucune donnée sur le personnel n\'est disponible dans la base de données.', 'error');
          setIsLoading(false);
          return;
        }

        const staffData = snap.val() || {};
        const updates = {};

        // Collect data of removed employees (for Auth deletion)
        const removedEmployees = [];
        const collectRemoved = (listData) => {
          if (!listData) return;
          const arr = Array.isArray(listData) ? listData : Object.values(listData);
          arr.forEach(m => { if (m && staffToRemove.includes(m?.name)) removedEmployees.push(m); });
        };
        collectRemoved(staffData.coroner);
        collectRemoved(staffData.phmc);

        const removeMatches = (listPath, listData) => {
          if (!listData) return;
          if (Array.isArray(listData)) {
            const filtered = listData.filter(m => !staffToRemove.includes(m?.name));
            updates[listPath] = filtered; // réécrit l'array
          } else {
            for (const [k, v] of Object.entries(listData)) {
              if (staffToRemove.includes(v?.name)) {
                updates[`${listPath}/${k}`] = null; // supprime la clé
              }
            }
          }
        };

        removeMatches('staff/coroner', staffData.coroner);
        removeMatches('staff/phmc', staffData.phmc);

        await update(ref(database), updates);

        // Delete Firebase Auth accounts for removed employees
        for (const emp of removedEmployees) {
          if (emp.uid || emp.email) {
            try {
              const idToken = await currentAdminUser.getIdToken();
              const functionUrl = `https://europe-west1-${process.env.REACT_APP_FIREBASE_PROJECT_ID}.cloudfunctions.net/deleteUserAccount`;
              await fetch(functionUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                body: JSON.stringify({ uid: emp.uid, email: emp.email })
              });
            } catch (authErr) {
              console.warn(`Could not delete Auth account for ${emp.name}:`, authErr);
            }
          }
        }

        await handleMissingEmployeeSubmit('removeStaff', employeeType, selectedEmployeeName, newRank, staffToRemove, authorizedBy, missingEmployeeData, updates, currentAdminUser?.email);
        showNotification(`Suppression réussie de ${staffToRemove.length} membre(s) du personnel.`, 'success');
        setRefreshData(prev => !prev);
      } catch (err) {
        console.error('Error removing staff members from Firebase:', err);
        showNotification(`Erreur lors de la suppression des membres du personnel : ${err.message}`, 'error');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // --- UPDATE RANK ---
    if (actionType === 'updateRank') {
      if (!selectedEmployeeName || !newRank?.trim()) {
        showNotification('Veuillez sélectionner un employé et entrer un nouveau grade.', 'warning');
        setIsLoading(false);
        return;
      }

      const trimmed = newRank.trim();
      const basePath = employeeType === 'coroner' ? 'staff/coroner' : 'staff/phmc';
      const listRef = ref(database, basePath);

      try {
        const snap = await get(listRef);
        if (!snap.exists()) {
          showNotification('Aucune donnée sur les employés n\'est disponible dans la base de données.', 'error');
          setIsLoading(false);
          return;
        }

        const entry = findEntryByName(snap.val(), selectedEmployeeName);
        if (!entry) {
          showNotification(`Employé "${selectedEmployeeName}" introuvable dans la base de données.`, 'error');
          setIsLoading(false);
          return;
        }

        const [key, employee] = entry;
        const updated = { ...employee, rank: trimmed, category: trimmed };
        await set(ref(database, `${basePath}/${key}`), updated);

        await handleMissingEmployeeSubmit('updateRank', employeeType, selectedEmployeeName, newRank, staffToRemove, authorizedBy, missingEmployeeData, updated, currentAdminUser?.email);
        showNotification(`Mise à jour réussie du grade de ${selectedEmployeeName}.`, 'success');
        setRefreshData(prev => !prev);
      } catch (err) {
        console.error('Error updating employee rank in Firebase:', err);
        showNotification(`Erreur lors de la mise à jour du grade de l'employé : ${err.message}`, 'error');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    setIsLoading(false);
  };

  const handleClose = () => {
    if (typeof onHide === 'function') onHide();
    else console.error('EmployeeModal: onHide is not a function', onHide);
  };

  // Options des selects (robustes map/array) - Filtrées selon l'utilisateur connecté
  const employeeOptions = useMemo(() => {
    const src = employeeType === 'coroner' ? ensureArray(coronerList) : ensureArray(phmcList);
    const allOptions = src.map(emp => ({
      value: emp.name,
      label: `${emp.name}${emp.lastName ? ' ' + emp.lastName : ''} (${emp.rank || emp.category || 'Rank Missing'})`
    }));
    
    // Si admin, montrer tous les employés
    if (isAdminVerified) {
      return allOptions;
    }
    
    // Si employé connecté, montrer seulement cet employé
    if (employeeProfile && actionType === 'editUser') {
      return allOptions.filter(opt => opt.value === employeeProfile.name);
    }
    
    return allOptions;
  }, [employeeType, coronerList, phmcList, isAdminVerified, employeeProfile, actionType]);

  const combinedStaffOptions = useMemo(() => {
    const coronerOptions = ensureArray(coronerList).map(c => ({
      value: c.name,
      label: `${c.name} (${c.rank || 'Coroner'})`,
      category: 'Coroner Staff'
    }));
    const phmcOptions = ensureArray(phmcList).map(p => ({
      value: p.name,
      label: `${p.name} (${p.category || 'PHMC'})`,
      category: 'Hospital Staff'
    }));
    return [...coronerOptions, ...phmcOptions].sort((a, b) => a.category.localeCompare(b.category));
  }, [coronerList, phmcList]);

  return show ? (
    <div style={modalOverlayStyle} onClick={handleClose}>
      <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
        <div style={modalHeaderStyle}>
          <h5 style={modalTitleStyle}>Gérer les données des employés</h5>
          <button onClick={handleClose} style={closeButtonStyle} aria-label="Close modal">&times;</button>
        </div>

        {!currentAdminUser && (
          <div style={{
            backgroundColor: '#dc3545',
            color: '#fff',
            padding: '12px 15px',
            borderRadius: '5px',
            marginBottom: '15px',
            fontSize: '14px',
            fontWeight: '500',
            textAlign: 'center'
          }}>
            ⚠️ Accès Administrateur Requis : Vous devez être connecté au panneau administrateur pour effectuer des modifications.
          </div>
        )}
        
        {currentAdminUser && isAdminVerified && (
          <div style={{
            backgroundColor: '#28a745',
            color: '#fff',
            padding: '12px 15px',
            borderRadius: '5px',
            marginBottom: '15px',
            fontSize: '14px',
            fontWeight: '500',
            textAlign: 'center'
          }}>
            ✅ Connecté en tant qu'administrateur : {currentAdminUser.email}
          </div>
        )}
        
        {currentAdminUser && !isAdminVerified && employeeProfile && (
          <div style={{
            backgroundColor: '#ffc107',
            color: '#000',
            padding: '12px 15px',
            borderRadius: '5px',
            marginBottom: '15px',
            fontSize: '14px',
            fontWeight: '500',
            textAlign: 'center'
          }}>
            ℹ️ Connecté en tant qu'employé : {employeeProfile.name}. Vous pouvez uniquement modifier vos propres informations.
          </div>
        )}

        <div style={modalBodyStyle}>
          <Form>
            <Form.Group controlId="actionTypeRadios" className="mb-3">
              <Form.Label style={formLabelStyle}>Sélectionner une action :</Form.Label>
              <div className="mb-3">
                <Form.Check inline label="Ajouter un employé" name="actionType" type="radio"
                  id="addEmployee-radio" value="addEmployee"
                  checked={actionType === 'addEmployee'}
                  onChange={() => handleActionTypeChange('addEmployee')} />
                <Form.Check inline label="Modifier les détails de l'employé" name="actionType" type="radio"
                  id="editUser-radio" value="editUser"
                  checked={actionType === 'editUser'}
                  onChange={() => handleActionTypeChange('editUser')} />
                <Form.Check inline label="Supprimer un employé" name="actionType" type="radio"
                  id="removeStaff-radio" value="removeStaff"
                  checked={actionType === 'removeStaff'}
                  onChange={() => handleActionTypeChange('removeStaff')} />
              </div>
            </Form.Group>

            {(actionType === 'addEmployee') && (
              <Form.Group controlId="employeeTypeRadios" className="mb-3">
                <Form.Label style={formLabelStyle}>Sélectionner le type d'employé :</Form.Label>
                <div className="mb-3">
                  <Form.Check inline label="DMEC" name="employeeType" type="radio"
                    id="coroner-radio" value="coroner"
                    checked={employeeType === 'coroner'}
                    onChange={() => handleEmployeeTypeChange('coroner')} />
                  <Form.Check inline label="Personnel hospitalier" name="employeeType" type="radio"
                    id="hospitalStaff-radio" value="hospitalStaff"
                    checked={employeeType === 'hospitalStaff'}
                    onChange={() => handleEmployeeTypeChange('hospitalStaff')} />
                </div>
              </Form.Group>
            )}

            {actionType === 'addEmployee' && (
              <>
                {employeeType === 'coroner' ? (
                  <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <Form.Control type="text" name="coronerName" value={missingEmployeeData.coronerName}
                        onChange={handleInputChange} placeholder="Prénom *" required style={formControlStyle} />
                      <Form.Control type="text" name="coronerLastName" value={missingEmployeeData.coronerLastName}
                        onChange={handleInputChange} placeholder="Nom *" required style={formControlStyle} />
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <Form.Control type="text" name="coronerDiscord" value={missingEmployeeData.coronerDiscord}
                        onChange={handleInputChange} placeholder="Discord *" required style={formControlStyle} />
                      <Form.Control type="text" name="coronerPHNumber" value={missingEmployeeData.coronerPHNumber}
                        onChange={handleInputChange} placeholder="Numéro de téléphone *" required style={formControlStyle} />
                    </div>
                    <div style={{ display: 'flex', gap: '0', alignItems: 'stretch', maxWidth: '220px' }}>
                      <span style={{ backgroundColor: '#1f2937', color: '#c9d1d9', border: '1px solid #30363d', borderRight: 'none', padding: '6px 10px', borderRadius: '4px 0 0 4px', fontSize: '0.9em', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center' }}>
                        {(CORONER_RANKS.find(r => r.value === missingEmployeeData.coronerRank)?.badgePrefix || 'TF') + '-'}
                      </span>
                      <Form.Control type="text" name="coronerBadge" value={missingEmployeeData.coronerBadge}
                        onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 5); setMissingEmployeeData({ ...missingEmployeeData, coronerBadge: v }); }}
                        placeholder="00000 *" required style={{ ...formControlStyle, borderRadius: '0 4px 4px 0', flex: 1, minWidth: 0 }} maxLength={5} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <Select
                        name="coronerRank"
                        options={CORONER_RANKS}
                        value={CORONER_RANKS.find(r => r.value === missingEmployeeData.coronerRank)}
                        onChange={(selectedOption) => setMissingEmployeeData({ ...missingEmployeeData, coronerRank: selectedOption.value })}
                        placeholder="Grade / Poste *"
                        styles={reactSelectStyles}
                        required
                      />
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <Form.Control type="text" name="coronerName" value={missingEmployeeData.coronerName}
                        onChange={handleInputChange} placeholder="Prénom *" required style={formControlStyle} />
                      <Form.Control type="text" name="employeeLastName" value={missingEmployeeData.employeeLastName}
                        onChange={handleInputChange} placeholder="Nom *" required style={formControlStyle} />
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <Form.Control type="text" name="phmcDiscord" value={missingEmployeeData.phmcDiscord}
                        onChange={handleInputChange} placeholder="Discord *" required style={formControlStyle} />
                      <Form.Control type="text" name="phmcPHNumber" value={missingEmployeeData.phmcPHNumber}
                        onChange={handleInputChange} placeholder="Numéro de téléphone *" required style={formControlStyle} />
                    </div>
                    <div style={{ display: 'flex', gap: '0', alignItems: 'stretch', maxWidth: '220px' }}>
                      <span style={{ backgroundColor: '#1f2937', color: '#c9d1d9', border: '1px solid #30363d', borderRight: 'none', padding: '6px 10px', borderRadius: '4px 0 0 4px', fontSize: '0.9em', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center' }}>
                        {(PHMC_RANKS.find(r => r.value === missingEmployeeData.coronerRank)?.badgePrefix || 'MD') + '-'}
                      </span>
                      <Form.Control type="text" name="phmcBadge" value={missingEmployeeData.phmcBadge}
                        onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 5); setMissingEmployeeData({ ...missingEmployeeData, phmcBadge: v }); }}
                        placeholder="00000 *" required style={{ ...formControlStyle, borderRadius: '0 4px 4px 0', flex: 1, minWidth: 0 }} maxLength={5} />
                    </div>
                    <Select
                      name="coronerRank"
                      options={PHMC_RANKS}
                      value={PHMC_RANKS.find(r => r.value === missingEmployeeData.coronerRank)}
                      onChange={(selectedOption) => setMissingEmployeeData({ ...missingEmployeeData, coronerRank: selectedOption.value })}
                      placeholder="Grade / Poste *"
                      styles={reactSelectStyles}
                      required
                    />
                  </div>
                )}
              </>
            )}

            {actionType === 'removeStaff' && (
              <>
                <Form.Label style={formLabelStyle}>Personnel à retirer :</Form.Label>
                <Select
                  isMulti
                  name="staffToRemove"
                  options={combinedStaffOptions}
                  value={combinedStaffOptions.filter(o => staffToRemove.includes(o.value))}
                  onChange={handleRemoveStaffChange}
                  isClearable
                  placeholder="Sélectionner le(s) membre(s) du personnel à retirer..."
                  styles={reactSelectStyles}
                  className="mb-2"
                />
                <Form.Label style={formLabelStyle}>Autorisé par :</Form.Label>
                <Form.Control type="text" name="authorizedBy" value={authorizedBy}
                  onChange={handleAuthorizedByChange} placeholder="Votre nom (Autorisation de retrait)" required style={formControlStyle} />
                <span className="helper-text" style={{ color: '#6c757d', display: 'block', marginTop: '5px' }}>
                  (Seul le personnel autorisé doit soumettre les demandes de retrait.)
                </span>
              </>
            )}

            {actionType === 'editUser' && (
              <>
                <Form.Group controlId="employeeTypeRadios" className="mb-3">
                  <Form.Label style={formLabelStyle}>Sélectionner le type d'employé :</Form.Label>
                  <div className="mb-3">
                    <Form.Check inline label="DMEC" name="employeeType" type="radio"
                      id="coroner-radio-2" value="coroner"
                      checked={employeeType === 'coroner'}
                      onChange={() => handleEmployeeTypeChange('coroner')} />
                    <Form.Check inline label="Personnel hospitalier" name="employeeType" type="radio"
                      id="hospitalStaff-radio-2" value="hospitalStaff"
                      checked={employeeType === 'hospitalStaff'}
                      onChange={() => handleEmployeeTypeChange('hospitalStaff')} />
                  </div>
                </Form.Group>

                <Form.Group controlId="coronerEmployeeSelect" className="mb-3">
                  <Form.Label style={formLabelStyle}>Sélectionner l'employé</Form.Label>
                  <Select
                    name="coronerEmployeeSelect"
                    options={employeeOptions}
                    value={employeeOptions.find(o => o.value === selectedEmployeeName)}
                    onChange={handleSelectChange}
                    isClearable
                    placeholder="Rechercher ou sélectionner un employé..."
                    styles={reactSelectStyles}
                  />
                </Form.Group>

                {employeeType === 'coroner' ? (
                  <>
                    <Form.Group className="mb-3">
                      <Form.Label style={formLabelStyle}>Prénom / Nom mis à jour</Form.Label>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <Form.Control type="text" placeholder="Prénom..."
                          value={missingEmployeeData.coronerName} onChange={handleInputChange}
                          name="coronerName" disabled={!selectedEmployeeName} style={formControlStyle} />
                        <Form.Control type="text" placeholder="Nom..."
                          value={missingEmployeeData.coronerLastName} onChange={handleInputChange}
                          name="coronerLastName" disabled={!selectedEmployeeName} style={formControlStyle} />
                      </div>
                    </Form.Group>
                    <Form.Group className="mb-3">
                      <Form.Label style={formLabelStyle}>Discord mis à jour</Form.Label>
                      <Form.Control type="text" placeholder="Discord..."
                        value={missingEmployeeData.coronerDiscord} onChange={handleInputChange}
                        name="coronerDiscord" disabled={!selectedEmployeeName} style={formControlStyle} />
                    </Form.Group>
                    <Form.Group className="mb-3">
                      <Form.Label style={formLabelStyle}>Rang mis à jour</Form.Label>
                      <Select
                        name="coronerRank"
                        options={CORONER_RANKS}
                        value={CORONER_RANKS.find(r => r.value === missingEmployeeData.coronerRank)}
                        onChange={(selectedOption) => setMissingEmployeeData({ ...missingEmployeeData, coronerRank: selectedOption.value })}
                        placeholder="Sélectionner le rang..."
                        styles={reactSelectStyles}
                        isDisabled={!selectedEmployeeName}
                      />
                    </Form.Group>
                    <Form.Group className="mb-3">
                      <Form.Label style={formLabelStyle}>Badge / Téléphone mis à jour</Form.Label>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'stretch' }}>
                        <div style={{ display: 'flex', gap: '0', alignItems: 'stretch', maxWidth: '220px' }}>
                          <span style={{ backgroundColor: '#1f2937', color: '#c9d1d9', border: '1px solid #30363d', borderRight: 'none', padding: '6px 10px', borderRadius: '4px 0 0 4px', fontSize: '0.9em', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', opacity: !selectedEmployeeName ? 0.5 : 1 }}>
                            {(CORONER_RANKS.find(r => r.value === missingEmployeeData.coronerRank)?.badgePrefix || 'TF') + '-'}
                          </span>
                          <Form.Control type="text"
                            value={missingEmployeeData.coronerBadge}
                            onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 5); setMissingEmployeeData({ ...missingEmployeeData, coronerBadge: v }); }}
                            placeholder="00000" disabled={!selectedEmployeeName}
                            style={{ ...formControlStyle, borderRadius: '0 4px 4px 0', flex: 1, minWidth: 0 }} maxLength={5} />
                        </div>
                        <Form.Control type="text" placeholder="Numéro de téléphone..."
                          value={missingEmployeeData.coronerPHNumber} onChange={handleInputChange}
                          name="coronerPHNumber" disabled={!selectedEmployeeName} style={formControlStyle} />
                      </div>
                    </Form.Group>
                  </>
                ) : (
                  <>
                    <Form.Group className="mb-3">
                      <Form.Label style={formLabelStyle}>Prénom / Nom mis à jour</Form.Label>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <Form.Control type="text" placeholder="Prénom..."
                          value={missingEmployeeData.coronerName} onChange={handleInputChange}
                          name="coronerName" disabled={!selectedEmployeeName} style={formControlStyle} />
                        <Form.Control type="text" placeholder="Nom..."
                          value={missingEmployeeData.employeeLastName} onChange={handleInputChange}
                          name="employeeLastName" disabled={!selectedEmployeeName} style={formControlStyle} />
                      </div>
                    </Form.Group>
                    <Form.Group className="mb-3">
                      <Form.Label style={formLabelStyle}>Discord mis à jour</Form.Label>
                      <Form.Control type="text" placeholder="Discord..."
                        value={missingEmployeeData.phmcDiscord} onChange={handleInputChange}
                        name="phmcDiscord" disabled={!selectedEmployeeName} style={formControlStyle} />
                    </Form.Group>
                    <Form.Group className="mb-3">
                      <Form.Label style={formLabelStyle}>Rang mis à jour</Form.Label>
                      <Select
                        name="coronerRank"
                        options={PHMC_RANKS}
                        value={PHMC_RANKS.find(r => r.value === missingEmployeeData.coronerRank || r.label === missingEmployeeData.coronerRank) || null}
                        onChange={(selectedOption) => setMissingEmployeeData({ ...missingEmployeeData, coronerRank: selectedOption.value })}
                        placeholder="Sélectionner le rang..."
                        styles={reactSelectStyles}
                        isDisabled={!selectedEmployeeName}
                      />
                    </Form.Group>
                    <Form.Group className="mb-3">
                      <Form.Label style={formLabelStyle}>Badge / Téléphone mis à jour</Form.Label>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'stretch' }}>
                        <div style={{ display: 'flex', gap: '0', alignItems: 'stretch', maxWidth: '220px' }}>
                          <span style={{ backgroundColor: '#1f2937', color: '#c9d1d9', border: '1px solid #30363d', borderRight: 'none', padding: '6px 10px', borderRadius: '4px 0 0 4px', fontSize: '0.9em', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', opacity: !selectedEmployeeName ? 0.5 : 1 }}>
                            {(PHMC_RANKS.find(r => r.value === missingEmployeeData.coronerRank || r.label === missingEmployeeData.coronerRank)?.badgePrefix || 'MD') + '-'}
                          </span>
                          <Form.Control type="text"
                            value={missingEmployeeData.phmcBadge}
                            onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 5); setMissingEmployeeData({ ...missingEmployeeData, phmcBadge: v }); }}
                            placeholder="00000" disabled={!selectedEmployeeName}
                            style={{ ...formControlStyle, borderRadius: '0 4px 4px 0', flex: 1, minWidth: 0 }} maxLength={5} />
                        </div>
                        <Form.Control type="text" placeholder="Numéro de téléphone..."
                          value={missingEmployeeData.phmcPHNumber} onChange={handleInputChange}
                          name="phmcPHNumber" disabled={!selectedEmployeeName} style={formControlStyle} />
                      </div>
                    </Form.Group>
                  </>
                )}
              </>
            )}

          </Form>
        </div>

        <div style={modalFooterStyle}>
          <Button 
            variant="primary" 
            onClick={handleSubmit} 
            disabled={isLoading || !currentAdminUser || (actionType !== 'editUser' && !isAdminVerified)}
            style={{
              opacity: (isLoading || !currentAdminUser || (actionType !== 'editUser' && !isAdminVerified)) ? 0.5 : 1,
              cursor: (isLoading || !currentAdminUser || (actionType !== 'editUser' && !isAdminVerified)) ? 'not-allowed' : 'pointer'
            }}
          >
            Soumettre la demande
          </Button>
          <Button variant="secondary" onClick={handleClose}>
            Annuler
          </Button>
        </div>
      </div>
    </div>
  ) : null;
};

export default EmployeeModal;
