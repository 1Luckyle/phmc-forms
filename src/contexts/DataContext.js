// src/context/DataContext.js
import React, { createContext, useState, useEffect, useContext, useCallback, useRef } from 'react';
import { database } from '../firebase';
import { ref, get, onValue } from 'firebase/database';
import { useNotification } from './NotificationContext';

// Define cache segments
const CACHE_SEGMENTS = {
  STAFF: 'staff',
  AGENCIES: 'agencies',
  SELECT_OPTIONS: 'selectOptions'
};

// Define segments that should not be cached in localStorage
const EXCLUDED_FROM_CACHE = ['savedReports'];

const DataContext = createContext();

export const useData = () => {
  return useContext(DataContext);
};

export const DataProvider = ({ children }) => {
  // --- State ---
  const { showNotification, removeNotification } = useNotification();
  const [phmcListData, setPhmcListData] = useState([]);
  const [coronerListData, setCoronerListData] = useState([]);
  const [agencyDataStore, setAgencyDataStore] = useState({});
  const [selectOptions, setSelectOptions] = useState({});
  const [physicianRecruitmentDetails, setPhysicianRecruitmentDetails] = useState({});
  const [psychRecruitmentDetails, setPsychRecruitmentDetails] = useState({});
  const [adminRecruitmentDetails, setAdminRecruitmentDetails] = useState({});
  const [emsRecruitmentDetails, setEmsRecruitmentDetails] = useState({});
  const [nurseRecruitmentDetails, setNurseRecruitmentDetails] = useState({});
  const [coronerRecruitmentDetails, setCoronerRecruitmentDetails] = useState({});
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [loading, setLoading] = useState(true);

  // Segmented cache for fetched data
  const dataCache = useRef({});
  const didLoadFromCache = useRef(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const firebaseListeners = useRef({});

  // --- Cache config ---
  const CACHE_PREFIX = 'firebaseCache';
  const CACHE_VERSION = '1.0';
  const CACHE_EXPIRY = 1000 * 60 * 60 * 24 * 7; // 7 days

  const SEGMENT_VERSIONS = {
    [CACHE_SEGMENTS.STAFF]: '1.0',
    [CACHE_SEGMENTS.AGENCIES]: '1.0',
    [CACHE_SEGMENTS.SELECT_OPTIONS]: '1.0'
  };

  const getSegmentVersion = (segment) => SEGMENT_VERSIONS[segment] || '1.0';
  const getCacheKey = (segment) => `${CACHE_PREFIX}_${segment}_v${getSegmentVersion(segment)}`;
  const getTimestampKey = (segment) => `${CACHE_PREFIX}_${segment}_v${getSegmentVersion(segment)}_timestamp`;
  const getVersionKey = (segment) => `${CACHE_PREFIX}_${segment}_v${getSegmentVersion(segment)}_version`;

  const isCacheValid = (segment) => {
    const timestamp = localStorage.getItem(getTimestampKey(segment));
    const cachedVersion = localStorage.getItem(getVersionKey(segment));
    const currentVersion = getSegmentVersion(segment);

    const isVersionValid = cachedVersion === currentVersion;
    const isTimeValid = timestamp && (Date.now() - parseInt(timestamp)) < CACHE_EXPIRY;

    if (!isVersionValid && cachedVersion) {
      console.log(`🔄 Cache version mismatch for ${segment}: Stored ${cachedVersion} vs Required ${currentVersion}. Replacing.`);
    } else if (!isTimeValid && timestamp) {
      console.log(`⏰ Cache for ${segment} has expired. Replacing.`);
    }
    return isVersionValid && isTimeValid;
  };

  const objToArray = (o) => {
  if (Array.isArray(o)) return o;
  if (o && typeof o === 'object') {
    return Object.keys(o).map((id) => ({ id, ...o[id] }));
  }
    return [];
  };

  // --- Update cache + state for a segment ---
  const updateCacheSegment = useCallback(async (segment, data) => {
    // Memory cache
    dataCache.current[segment] = data;

    // localStorage (unless excluded)
    if (!EXCLUDED_FROM_CACHE.includes(segment)) {
      try {
        const version = getSegmentVersion(segment);
        localStorage.setItem(getCacheKey(segment), JSON.stringify(data));
        localStorage.setItem(getTimestampKey(segment), Date.now().toString());
        localStorage.setItem(getVersionKey(segment), version);
        console.log(`💾 Updated cache segment: ${segment} (v${version})`);
      } catch (error) {
        console.warn(`Failed to update cache for ${segment}:`, error);
        try {
          localStorage.removeItem(getCacheKey(segment));
          localStorage.removeItem(getTimestampKey(segment));
          localStorage.removeItem(getVersionKey(segment));
        } catch (clearError) {
          console.error(`Failed to clear cache for ${segment}:`, clearError);
        }
      }
    } else {
      console.log(`⏩ Skipping localStorage cache for ${segment} (excluded segment)`);
    }

    // Update relevant state
    switch (segment) {
      case CACHE_SEGMENTS.STAFF:
        setPhmcListData(data?.phmc || []);
        setCoronerListData(data?.coroner || []);
        break;
      case CACHE_SEGMENTS.AGENCIES:
        setAgencyDataStore(data || {});
        break;
      case CACHE_SEGMENTS.SELECT_OPTIONS:
        setSelectOptions(data || {});
        setPhysicianRecruitmentDetails(data?.physicianRecruitmentDetails || {});
        setPsychRecruitmentDetails(data?.psychPositionDetailsData || {});
        setAdminRecruitmentDetails(data?.adminPositionDetailsData || {});
        setEmsRecruitmentDetails(data?.emsPositionDetailsData || {});
        setNurseRecruitmentDetails(data?.nursePositionDetailsData || {});
        setCoronerRecruitmentDetails(data?.coronerPositionDetailsData || {});
        break;
      default:
        console.warn(`Unknown cache segment: ${segment}`);
    }
  }, []);

  // --- Util: applique un objet { staff, agencies, selectOptions } sur les segments ---
  const applyImportedData = useCallback(async (data) => {
    for (const segment of Object.values(CACHE_SEGMENTS)) {
      if (data[segment] !== undefined) {
        await updateCacheSegment(segment, data[segment]);
      }
    }
    showNotification("Données chargées depuis le seed local.", 'info', 2500);
  }, [updateCacheSegment, showNotification]);

  // --- Util: valide la forme du JSON importé/seed ---
  const validateImportedData = useCallback((data) => {
    const errors = [];
    if (typeof data !== 'object' || data === null) {
      errors.push('Le JSON racine doit être un objet.');
      return errors;
    }
    // staff
    if (data[CACHE_SEGMENTS.STAFF]) {
      const s = data[CACHE_SEGMENTS.STAFF];
      if (typeof s !== 'object' || s === null) errors.push("`staff` doit être un objet.");
      if (s && (!Array.isArray(s.phmc) || !Array.isArray(s.coroner))) {
        errors.push("`staff` doit contenir `phmc: []` et `coroner: []`.");
      }
    }
    // agencies
    if (data[CACHE_SEGMENTS.AGENCIES] && typeof data[CACHE_SEGMENTS.AGENCIES] !== 'object') {
      errors.push("`agencies` doit être un objet (dictionnaire).");
    }
    // selectOptions
    if (data[CACHE_SEGMENTS.SELECT_OPTIONS]) {
      const so = data[CACHE_SEGMENTS.SELECT_OPTIONS];
      if (typeof so !== 'object' || so === null) {
        errors.push("`selectOptions` doit être un objet.");
      }
    }
    return errors;
  }, []);

  // --- Util: import dynamique du seed local ---
  // Supporte Vite/Webpack modernes (import assertion) et fallback sans assertion.
  const importLocalSeed = useCallback(async () => {
    try {
      // Essai avec import assertion (Vite/Webpack 5+)
      const mod = await import('../data/seed.json', { assert: { type: 'json' } });
      return mod?.default ?? mod;
    } catch (_) {
      try {
        // Fallback sans assertion (CRA/anciennes toolchains)
        const mod = await import('../data/seed.json');
        return mod?.default ?? mod;
      } catch (e2) {
        console.warn('Pas de seed local ou import JSON non supporté par le bundler:', e2);
        return null;
      }
    }
  }, []);

  // --- Util: met à jour tous les states à partir de data cache ---
  const updateStateWithData = (data) => {
    Object.entries(CACHE_SEGMENTS).forEach(([_, segment]) => {
      if (data[segment]) {
        updateCacheSegment(segment, data[segment]);
      }
    });
  };

  // --- Firebase listeners ---
  const setupFirebaseListeners = useCallback(() => {
    Object.values(firebaseListeners.current).forEach(unsubscribe => unsubscribe && unsubscribe());
    firebaseListeners.current = {};

    // staff
    const staffRef = ref(database, CACHE_SEGMENTS.STAFF);
    let isInitialStaffCallback = true;
    firebaseListeners.current.staff = onValue(staffRef, (snapshot) => {
      if (didLoadFromCache.current && isInitialStaffCallback) {
        isInitialStaffCallback = false;
        console.log('⏩ Skipping initial Firebase staff update because cache was used.');
        return;
      }
      isInitialStaffCallback = false;

      if (snapshot.exists()) {
        const staffData = snapshot.val();
        if (JSON.stringify(staffData) === JSON.stringify(dataCache.current[CACHE_SEGMENTS.STAFF])) return;
        updateCacheSegment(CACHE_SEGMENTS.STAFF, staffData);
        console.log('🔄 Staff data updated from Firebase');
      }
    });

    // agencies
    const agenciesRef = ref(database, CACHE_SEGMENTS.AGENCIES);
    let isInitialAgencyCallback = true;
    firebaseListeners.current.agencies = onValue(agenciesRef, (snapshot) => {
      if (didLoadFromCache.current && isInitialAgencyCallback) {
        isInitialAgencyCallback = false;
        console.log('⏩ Skipping initial Firebase agency update because cache was used.');
        return;
      }
      isInitialAgencyCallback = false;

      if (snapshot.exists()) {
        const agencyData = snapshot.val();
        if (JSON.stringify(agencyData) === JSON.stringify(dataCache.current[CACHE_SEGMENTS.AGENCIES])) return;
        updateCacheSegment(CACHE_SEGMENTS.AGENCIES, agencyData);
        console.log('🔄 Agency data updated from Firebase');
      }
    });

    // selectOptions
    const optionsRef = ref(database, CACHE_SEGMENTS.SELECT_OPTIONS);
    let isInitialOptionsCallback = true;
    firebaseListeners.current.options = onValue(optionsRef, (snapshot) => {
      if (didLoadFromCache.current && isInitialOptionsCallback) {
        isInitialOptionsCallback = false;
        console.log('⏩ Skipping initial Firebase select options update because cache was used.');
        return;
      }
      isInitialOptionsCallback = false;

      if (snapshot.exists()) {
        const optionsData = snapshot.val();
        if (JSON.stringify(optionsData) === JSON.stringify(dataCache.current[CACHE_SEGMENTS.SELECT_OPTIONS])) return;
        updateCacheSegment(CACHE_SEGMENTS.SELECT_OPTIONS, optionsData);
        console.log('🔄 Select options updated from Firebase');
      }
    });
  }, [updateCacheSegment]);

  // --- Chargement principal + Fallback Seed ---
  const loadData = useCallback(async (forceRefresh = false) => {
    // Mémoire + cache localStorage
    if (dataLoaded && !forceRefresh && Object.values(CACHE_SEGMENTS).every(segment =>
      dataCache.current[segment] && isCacheValid(segment))) {
      console.log('📦 Using memory-cached Firebase data');
      setIsLoadingData(false);
      setLoading(false);
      return;
    }

    if (!forceRefresh) {
      const allSegmentsLoaded = Object.values(CACHE_SEGMENTS).every(segment => {
        const cachedData = localStorage.getItem(getCacheKey(segment));
        if (cachedData && isCacheValid(segment)) {
          try {
            const parsedData = JSON.parse(cachedData);
            dataCache.current[segment] = parsedData;
            return true;
          } catch (error) {
            console.error(`Error parsing cached data for ${segment}:`, error);
            return false;
          }
        }
        return false;
      });

      if (allSegmentsLoaded) {
        console.log('📦 Using localStorage-cached Firebase data');
        updateStateWithData(dataCache.current);
        setDataLoaded(true);
        setIsLoadingData(false);
        setLoading(false);
        didLoadFromCache.current = true;
        return;
      }
    }

    // Sinon, on tente Firebase
    let loadingNotificationId;
    try {
      loadingNotificationId = showNotification("Data Loading...", 'spinner fa-spin', 0);
      console.log('🔄 Fetching fresh data from Firebase...');

      const dbRootRef = ref(database);
      const snapshot = await get(dbRootRef);

      if (snapshot.exists()) {
        const allData = snapshot.val();

        // Cache par segment
        Object.entries(CACHE_SEGMENTS).forEach(([_, path]) => {
          if (allData[path] !== undefined) {
            dataCache.current[path] = allData[path];
            if (!EXCLUDED_FROM_CACHE.includes(path)) {
              try {
                localStorage.setItem(getCacheKey(path), JSON.stringify(allData[path]));
                localStorage.setItem(getTimestampKey(path), Date.now().toString());
                localStorage.setItem(getVersionKey(path), getSegmentVersion(path));
              } catch (error) {
                console.warn(`Failed to cache ${path} to localStorage:`, error);
                try {
                  localStorage.removeItem(getCacheKey(path));
                  localStorage.removeItem(getTimestampKey(path));
                  localStorage.removeItem(getVersionKey(path));
                } catch (clearError) {
                  console.error(`Failed to clear cache for ${path}:`, clearError);
                }
              }
            } else {
              console.log(`⏩ Skipping localStorage cache for ${path} (excluded segment)`);
            }
          }
        });

        console.log('💾 Firebase data cached to localStorage by segments');
        updateStateWithData(allData);
        showNotification("Data Loaded!", 'check-circle', 2000);
        setDataLoaded(true);
      } else {
        // 🔁 Fallback seed si Firebase n'a rien
        console.warn('Aucune donnée trouvée sur Firebase. Tentative seed local…');
        const seedData = await importLocalSeed();
        if (seedData) {
          const errors = validateImportedData(seedData);
          if (errors.length) {
            console.warn('Seed JSON invalide:', errors);
          } else {
            await applyImportedData(seedData);
            setDataLoaded(true);
            setIsLoadingData(false);
            setLoading(false);
            return;
          }
        } else {
          showNotification('Initial application data not found on server.', 'error', 3500);
        }
      }
    } catch (error) {
      console.error("Error fetching data from Realtime Database:", error);
      showNotification("An error has happened, contact the maintainer", 'error', 3500);

      // 🔁 Fallback seed si get() a échoué
      try {
        console.warn('Tentative de chargement depuis le seed local (fallback)…');
        const seedData = await importLocalSeed();
        if (seedData) {
          const errors = validateImportedData(seedData);
          if (errors.length) {
            console.warn('Seed JSON invalide:', errors);
          } else {
            await applyImportedData(seedData);
            setDataLoaded(true);
            setIsLoadingData(false);
            setLoading(false);
            return;
          }
        }
      } catch (e2) {
        console.warn('Pas de seed local ou import échoué:', e2);
      }
    } finally {
      setIsLoadingData(false);
      setLoading(false);
      if (loadingNotificationId) {
        removeNotification(loadingNotificationId);
      }
    }
  }, [
    dataLoaded,
    showNotification,
    removeNotification,
    importLocalSeed,
    validateImportedData,
    applyImportedData
  ]);

  // --- Nettoyage ancien cache ---
  const cleanupCache = useCallback(() => {
    const prefix = CACHE_PREFIX + '_';
    // Collect keys first to avoid live iteration issues when removing
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) keys.push(key);
    }

    keys.forEach((key) => {
      if (key.startsWith(prefix)) {
        const isCurrentKey = Object.values(CACHE_SEGMENTS).some(segment =>
          key === getCacheKey(segment) ||
          key === getTimestampKey(segment) ||
          key === getVersionKey(segment)
        );
        if (!isCurrentKey) {
          console.log(`🧹 Cleaning up old cache key: ${key}`);
          localStorage.removeItem(key);
        }
      }
    });
  }, []);

  useEffect(() => {
    const initialLoad = async () => {
      await loadData();
      if (!Object.keys(firebaseListeners.current).length) {
        setupFirebaseListeners();
      }
    };
    initialLoad();
    cleanupCache();

    return () => {
      Object.values(firebaseListeners.current).forEach(unsubscribe => unsubscribe && unsubscribe());
    };
  }, [loadData, setupFirebaseListeners, cleanupCache]);

  // --- API publique ---
  const refreshData = useCallback(async () => {
    setDataLoaded(false);
    Object.values(CACHE_SEGMENTS).forEach(segment => {
      localStorage.removeItem(getCacheKey(segment));
      localStorage.removeItem(getTimestampKey(segment));
      localStorage.removeItem(getVersionKey(segment));
    });
    await loadData(true);
  }, [loadData]);

  const refreshSegments = useCallback(async (segments = []) => {
    const segmentsToRefresh = segments.length > 0 ? segments : Object.values(CACHE_SEGMENTS);
    for (const segment of segmentsToRefresh) {
      if (!CACHE_SEGMENTS[segment] && !Object.values(CACHE_SEGMENTS).includes(segment)) {
        console.warn(`Invalid segment: ${segment}`);
        continue;
      }
      const segmentRef = ref(database, segment);
      try {
        const snapshot = await get(segmentRef);
        if (snapshot.exists()) {
          await updateCacheSegment(segment, snapshot.val());
        }
      } catch (error) {
        console.error(`Failed to refresh segment ${segment}:`, error);
        showNotification(`Failed to refresh ${segment} data`, 'error');
      }
    }
  }, [updateCacheSegment, showNotification]);

  const notifyDataUpdate = useCallback(async (path, _type = 'update') => {
    console.log(`🔔 Received direct update notification for path: ${path}`);
    if (path.startsWith('savedReports/')) return;

    const segmentsToRefresh = [];
    Object.values(CACHE_SEGMENTS).forEach((segment) => {
      if (path.startsWith(segment)) segmentsToRefresh.push(segment);
    });

    if (segmentsToRefresh.length > 0) {
      console.log(`🔄 Refreshing segments due to direct update: ${segmentsToRefresh.join(', ')}`);
      await refreshSegments(segmentsToRefresh);
    }
  }, [refreshSegments]);

  const value = {
    phmcListData,
    coronerListData,
    agencyDataStore,
    selectOptions,
    physicianRecruitmentDetails,
    psychRecruitmentDetails,
    adminRecruitmentDetails,
    emsRecruitmentDetails,
    nurseRecruitmentDetails,
    coronerRecruitmentDetails,
    isLoadingData,
    loading,
    refreshData,
    refreshSegments,
    notifyDataUpdate
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
};