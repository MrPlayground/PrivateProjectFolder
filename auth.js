import { auth, db } from "./firebase-config.js";
import { clearMessages, setCurrentUser, startApp, stopAllListeners } from "./app.js";
import {
  createUserWithEmailAndPassword, deleteUser, onAuthStateChanged, signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import {
  deleteDoc, doc, runTransaction, serverTimestamp, setDoc
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

const signinView = document.getElementById("view-signin");
const signupView = document.getElementById("view-signup");
const chatView = document.getElementById("view-chat");
const signinForm = document.getElementById("signin-form");
const signupForm = document.getElementById("signup-form");
const signinError = document.getElementById("auth-error-message");
const signupError = document.getElementById("auth-error-message-signup");
let presenceRef = null;

export function getFriendlyErrorMessage(error) {
  const messages = { "auth/invalid-credential": "Incorrect email or password. Please try again.", "auth/email-already-in-use": "An account with this email already exists.", "auth/weak-password": "Password should be at least 6 characters.", "auth/invalid-email": "Please enter a valid email address." };
  return error.message === "Username is already taken. Please pick another." ? error.message : (messages[error.code] || "Something went wrong. Please try again.");
}

function showView(view) {
  [signinView, signupView, chatView].forEach((item) => { const active = item === view; item.hidden = !active; item.classList.toggle("is-visible", active); item.setAttribute("aria-hidden", String(!active)); });
}
function showError(element, error) { element.textContent = getFriendlyErrorMessage(error); }
function clearErrors() { signinError.textContent = ""; signupError.textContent = ""; }

signinForm.addEventListener("submit", async (event) => {
  event.preventDefault(); clearErrors();
  const data = new FormData(signinForm);
  try { await signInWithEmailAndPassword(auth, data.get("email"), data.get("password")); } catch (error) { showError(signinError, error); }
});

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault(); clearErrors();
  const data = new FormData(signupForm);
  const username = data.get("username").trim().toLowerCase();
  let createdUser;
  try {
    const credential = await createUserWithEmailAndPassword(auth, data.get("email"), data.get("password"));
    createdUser = credential.user;
    const userRef = doc(db, "users", createdUser.uid);
    await setDoc(userRef, { uid: createdUser.uid, email: createdUser.email, username, isOnline: true }, { merge: true });
    await runTransaction(db, async (transaction) => {
      const usernameRef = doc(db, "usernames", username);
      if ((await transaction.get(usernameRef)).exists()) throw new Error("Username is already taken. Please pick another.");
      transaction.set(usernameRef, { uid: createdUser.uid, username });
    });
  } catch (error) {
    if (createdUser) {
      await deleteDoc(doc(db, "users", createdUser.uid)).catch(() => {});
      await deleteUser(createdUser).catch(() => {});
    }
    showError(signupError, error);
  }
});

document.getElementById("show-signup-link").addEventListener("click", (event) => { event.preventDefault(); clearErrors(); showView(signupView); });
document.getElementById("show-signin-link").addEventListener("click", (event) => { event.preventDefault(); clearErrors(); showView(signinView); });
document.getElementById("logout-button").addEventListener("click", () => {
  stopAllListeners();
  signOut(auth).catch(console.error);
});

onAuthStateChanged(auth, async (user) => {
  setCurrentUser(user);
  if (!user) { if (presenceRef) await setDoc(presenceRef, { isOnline: false, lastSeen: serverTimestamp() }, { merge: true }).catch(() => {}); stopAllListeners(); clearMessages(); showView(signinView); return; }
  presenceRef = doc(db, "users", user.uid);
  await setDoc(presenceRef, { isOnline: true, lastSeen: serverTimestamp() }, { merge: true });
  window.addEventListener("beforeunload", () => setDoc(presenceRef, { isOnline: false, lastSeen: serverTimestamp() }, { merge: true }));
  clearErrors(); showView(chatView); startApp(user);
});
