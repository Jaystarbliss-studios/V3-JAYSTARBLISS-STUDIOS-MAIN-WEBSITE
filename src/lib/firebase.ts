import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  initializeFirestore, 
  getFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from "firebase/firestore";
import { 
  getAuth, 
  initializeAuth, 
  browserLocalPersistence, 
  browserSessionPersistence, 
  indexedDBLocalPersistence, 
  inMemoryPersistence,
  browserPopupRedirectResolver
} from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyD_lq2Z4qBrZZkzYmEMPPMtCKQmfSx2rkY",
  authDomain: "jaystarbliss-studios.firebaseapp.com",
  projectId: "jaystarbliss-studios",
  storageBucket: "jaystarbliss-studios.firebasestorage.app",
  messagingSenderId: "885364100276",
  appId: "1:885364100276:web:1159c4cbd9159aaa0e1be1",
  firestoreDatabaseId: "ai-studio-jaystarblissdyna-085e16ac-52ee-43ae-9c0c-52f6db7f8f7c"
};

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firebase services with resilient auto-detect long polling and multi-tab persistent cache
let db: ReturnType<typeof getFirestore>;
try {
  db = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  }, firebaseConfig.firestoreDatabaseId);
} catch {
  db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
}

// Initialize Auth with multi-tier persistence (localStorage -> indexedDB -> sessionStorage -> memory)
// and browserPopupRedirectResolver so signInWithPopup / signInWithRedirect work seamlessly
let auth: ReturnType<typeof getAuth>;
try {
  auth = initializeAuth(app, {
    persistence: [
      browserLocalPersistence,
      indexedDBLocalPersistence,
      browserSessionPersistence,
      inMemoryPersistence
    ],
    popupRedirectResolver: browserPopupRedirectResolver
  });
} catch {
  auth = getAuth(app);
}

const storage = getStorage(app);

export { app, db, auth, storage, firebaseConfig, browserPopupRedirectResolver };


