import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// ─── Firebase Config ──────────────────────────────────────────────────────────
// ⚠  Fill in apiKey and appId from:
//    Firebase Console → Project Settings → Your apps → (Web app) → SDK setup
const firebaseConfig = {
  apiKey: "PASTE_YOUR_API_KEY_HERE",
  authDomain: "hackattack-6d7de.firebaseapp.com",
  projectId: "hackattack-6d7de",
  storageBucket: "hackattack-6d7de.firebasestorage.app",
  messagingSenderId: "183251997172",
  appId: "PASTE_YOUR_APP_ID_HERE",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
