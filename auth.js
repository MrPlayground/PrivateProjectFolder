import { auth } from "./firebase-config.js";
import { listenForMessages, setCurrentUser, stopListeningForMessages } from "./app.js";
import {
  createUserWithEmailAndPassword as createUser,
  onAuthStateChanged,
  signInWithEmailAndPassword as signIn,
  signOut as logOut
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";

const views = {
  signin: document.getElementById("view-signin"),
  signup: document.getElementById("view-signup"),
  chat: document.getElementById("view-chat")
};
const signinForm = document.getElementById("signin-form");
const signupForm = document.getElementById("signup-form");
const signinErrorMessage = document.getElementById("auth-error-message");
const signupErrorMessage = document.getElementById("auth-error-message-signup");

export function createUserWithEmailAndPassword(email, password) {
  return createUser(auth, email, password);
}

export function signInWithEmailAndPassword(email, password) {
  return signIn(auth, email, password);
}

export function signOut() {
  return logOut(auth);
}

export function getFriendlyErrorMessage(error) {
  const messages = {
    "auth/invalid-credential": "Incorrect email or password. Please try again.",
    "auth/email-already-in-use": "An account with this email already exists.",
    "auth/weak-password": "Password should be at least 6 characters.",
    "auth/invalid-email": "Please enter a valid email address."
  };

  return messages[error.code] || "Something went wrong. Please try again.";
}

function showView(viewName) {
  Object.entries(views).forEach(([name, view]) => {
    view.classList.toggle("is-visible", name === viewName);
    view.setAttribute("aria-hidden", String(name !== viewName));
  });
}

function showError(element, error) {
  element.textContent = getFriendlyErrorMessage(error);
}

function clearErrors() {
  signinErrorMessage.textContent = "";
  signupErrorMessage.textContent = "";
}

document.getElementById("show-signup-link").addEventListener("click", (event) => {
  event.preventDefault();
  clearErrors();
  showView("signup");
});

document.getElementById("show-signin-link").addEventListener("click", (event) => {
  event.preventDefault();
  clearErrors();
  showView("signin");
});

signinForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearErrors();
  const formData = new FormData(signinForm);

  try {
    await signInWithEmailAndPassword(formData.get("email"), formData.get("password"));
  } catch (error) {
    showError(signinErrorMessage, error);
  }
});

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearErrors();
  const formData = new FormData(signupForm);

  try {
    await createUserWithEmailAndPassword(formData.get("email"), formData.get("password"));
  } catch (error) {
    showError(signupErrorMessage, error);
  }
});

document.getElementById("logout-button").addEventListener("click", () => {
  signOut().catch((error) => console.error("Unable to sign out:", error));
});

onAuthStateChanged(auth, (user) => {
  setCurrentUser(user);

  if (user) {
    clearErrors();
    showView("chat");
    listenForMessages();
    return;
  }

  stopListeningForMessages();
  document.getElementById("messages").replaceChildren();
  showView("signin");
});
