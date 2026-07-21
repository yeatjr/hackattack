import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// ─── Firebase Config ──────────────────────────────────────────────────────────
// ⚠  Fill in apiKey and appId from:
//    Firebase Console → Project Settings → Your apps → (Web app) → SDK setup
const firebaseConfig = {
  apiKey: "AIzaSyA0HmBLUZ364sMSOG8j9u1tIGqJ191h3e0",
  authDomain: "hackattack-6d7de.firebaseapp.com",
  projectId: "hackattack-6d7de",
  storageBucket: "hackattack-6d7de.firebasestorage.app",
  messagingSenderId: "183251997172",
  appId: "1:183251997172:web:8261ff334c494c2721e9a1",
  measurementId: "G-8TB6ERLVQ6"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
