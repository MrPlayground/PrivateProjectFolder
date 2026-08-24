import { db } from "./firebase-config.js";
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

const messagesContainer = document.getElementById("messages");
const messageForm = document.getElementById("message-form");
const messageInput = document.getElementById("message-input");
const sendButton = document.getElementById("send-button");

let currentUser = null;
let stopMessageListener = null;

export function setCurrentUser(user) {
  currentUser = user;
}

export function stopListeningForMessages() {
  stopMessageListener?.();
  stopMessageListener = null;
}

export async function sendMessage(text) {
  const messageText = text.trim();

  if (!messageText || !currentUser) {
    return;
  }

  await addDoc(collection(db, "messages"), {
    text: messageText,
    uid: currentUser.uid,
    userEmail: currentUser.email,
    createdAt: serverTimestamp()
  });
}

function renderMessage(message) {
  const messageElement = document.createElement("article");
  const messageData = message.data();
  const isSentMessage = messageData.uid === currentUser?.uid;

  messageElement.className = `message ${isSentMessage ? "sent" : "received"}`;

  const senderElement = document.createElement("div");
  senderElement.className = "sender";
  senderElement.textContent = messageData.userEmail || "Unknown user";

  const textElement = document.createElement("div");
  textElement.textContent = messageData.text || "";

  messageElement.append(senderElement, textElement);
  messagesContainer.appendChild(messageElement);
}

export function listenForMessages() {
  stopListeningForMessages();
  const messagesQuery = query(collection(db, "messages"), orderBy("createdAt", "asc"));

  stopMessageListener = onSnapshot(messagesQuery, (snapshot) => {
    messagesContainer.replaceChildren();
    snapshot.forEach(renderMessage);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }, (error) => {
    console.error("Unable to listen for messages:", error);
  });

  return stopMessageListener;
}

function handleMessageSubmit(event) {
  event.preventDefault();

  sendMessage(messageInput.value)
    .then(() => {
      messageInput.value = "";
    })
    .catch((error) => {
      console.error("Unable to send message:", error);
    });
}

messageForm.addEventListener("submit", handleMessageSubmit);
sendButton.addEventListener("click", (event) => {
  event.preventDefault();
  messageForm.requestSubmit();
});
messageInput.addEventListener("keypress", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    messageForm.requestSubmit();
  }
});

