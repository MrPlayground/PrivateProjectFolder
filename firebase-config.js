import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDFXAlgiGPKX3uUIx1tHOnwtqJGc7LU5L8",
  authDomain: "private-project-chatapp.firebaseapp.com",
  projectId: "private-project-chatapp",
  storageBucket: "private-project-chatapp.firebasestorage.app",
  messagingSenderId: "643763770784",
  appId: "1:643763770784:web:64587600cc1a32162380c5",
  measurementId: "G-XP02V5T813"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);