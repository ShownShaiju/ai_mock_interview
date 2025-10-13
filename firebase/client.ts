import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
const firebaseConfig = {
  apiKey: "AIzaSyAgxSKRGE1BjhEr5NxprOxWP045eVdgnDQ",
  authDomain: "verviq-e15f6.firebaseapp.com",
  projectId: "verviq-e15f6",
  storageBucket: "verviq-e15f6.firebasestorage.app",
  messagingSenderId: "646945454603",
  appId: "1:646945454603:web:42c1b6eeb1b85f36b6a50e",
  measurementId: "G-DG1KRPXE6S"
};

// Initialize Firebase
const app = !getApps.length? initializeApp(firebaseConfig) :getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);