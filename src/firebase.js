// src/firebase.js
import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";
import { getFunctions } from "firebase/functions";

// Your web app's Firebase configuration using environment variables
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);

// App Check (reCAPTCHA Enterprise). Doit être initialisé juste après initializeApp et AVANT tout
// getDatabase/getAuth/getFunctions : ces services récupèrent le jeton App Check à leur première utilisation.
// Le jeton de debug n'est activé qu'en local ; il ne doit jamais l'être en production.
const isLocalhost = typeof window !== 'undefined'
  && ['localhost', '127.0.0.1'].includes(window.location.hostname);
if (isLocalhost) {
  // eslint-disable-next-line no-restricted-globals
  self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}

const appCheckSiteKey = process.env.REACT_APP_RECAPTCHA_SITE_KEY;
if (appCheckSiteKey) {
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
    isTokenAutoRefreshEnabled: true
  });
} else {
  console.warn('App Check désactivé : REACT_APP_RECAPTCHA_SITE_KEY est absente.');
}

const database = getDatabase(app);
const auth = getAuth(app);
const analytics = getAnalytics(app);
const functions = getFunctions(app, 'europe-west1');

export { database, auth, app, analytics, functions };
