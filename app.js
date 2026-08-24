import { db } from "./firebase-config.js";
import {
  addDoc, collection, doc, getDoc, getDocs, onSnapshot, orderBy, query,
  serverTimestamp, setDoc, where
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

export const activeUnsubscribes = [];
let publicUnsubscribe = null;
let directUnsubscribe = null;

const messagesContainer = document.getElementById("messages");
const messageForm = document.getElementById("message-form");
const messageInput = document.getElementById("message-input");
const friendsList = document.getElementById("friends-list");
const dmFriendsList = document.getElementById("friends-list-dm");
const directMessages = document.getElementById("direct-messages");
const directMessageForm = document.getElementById("direct-message-form");
const directMessageInput = document.getElementById("direct-message-input");
const activeDmHeading = document.getElementById("active-dm-heading");
let currentUser = null;
let activeFriendUid = null;

export function setCurrentUser(user) { currentUser = user; }
export function clearMessages() { messagesContainer.replaceChildren(); directMessages.replaceChildren(); }
export function stopAllListeners() {
  activeUnsubscribes.splice(0).forEach((unsubscribe) => unsubscribe());
  publicUnsubscribe = null;
  directUnsubscribe = null;
}

function renderMessage(message, container, type = "public") {
  const data = message.data();
  const element = document.createElement("article");
  element.className = `message ${data.uid === currentUser?.uid ? "sent" : "received"}`;
  const sender = document.createElement("strong");
  sender.textContent = data.senderUsername ? `@${data.senderUsername}` : (data.userEmail?.split("@")[0] || "Unknown User");
  const text = document.createElement("div");
  text.textContent = data.text || "";
  element.append(sender, text);
  container.appendChild(element);
}

export async function sendMessage(text) {
  const value = text.trim();
  if (!value || !currentUser) return;
  const profile = await getUserProfile(currentUser.uid);
  await addDoc(collection(db, "public_messages"), { text: value, uid: currentUser.uid, userEmail: currentUser.email, senderUsername: profile?.username || profile?.displayName || "", createdAt: serverTimestamp() });
}

export function listenForMessages() {
  publicUnsubscribe?.();
  if (publicUnsubscribe) activeUnsubscribes.splice(activeUnsubscribes.indexOf(publicUnsubscribe), 1);
  const messagesQuery = query(collection(db, "public_messages"), orderBy("createdAt", "asc"));
  publicUnsubscribe = onSnapshot(messagesQuery, (snapshot) => { messagesContainer.replaceChildren(); snapshot.forEach((message) => renderMessage(message, messagesContainer)); messagesContainer.scrollTop = messagesContainer.scrollHeight; }, (err) => console.warn("Listener detached:", err.message));
  activeUnsubscribes.push(publicUnsubscribe);
  return publicUnsubscribe;
}

async function getUserProfile(uid) {
  const profile = await getDoc(doc(db, "users", uid));
  if (profile.exists()) return profile.data();
  const result = await getDocs(query(collection(db, "users"), where("uid", "==", uid)));
  return result.docs[0]?.data() || null;
}

function profileLabel(data) {
  const username = data.username?.trim();
  return username ? `@${username}` : (data.displayName || data.email?.split("@")[0] || "Unknown User");
}

export async function addFriend(targetEmailOrUsername) {
  if (!currentUser) throw new Error("You must be signed in.");
  const rawInput = targetEmailOrUsername.trim();
  const queryTerm = rawInput.toLowerCase().replace(/^@/, "");
  const [byUsername, byEmail] = await Promise.all([
    getDocs(query(collection(db, "users"), where("username", "==", queryTerm))),
    getDocs(query(collection(db, "users"), where("email", "==", rawInput)))
  ]);
  const matches = new Map();
  [...byUsername.docs, ...byEmail.docs].forEach((result) => matches.set(result.id, result));
  const target = [...matches.values()][0];
  if (!target) throw new Error("No user found with that username or email");
  if (target.id === currentUser.uid || target.data().uid === currentUser.uid) throw new Error("You cannot add yourself");
  const existingFriends = await getDocs(collection(db, "friends", currentUser.uid, "userFriends"));
  const alreadyFriend = existingFriends.docs.some((friend) => friend.id === target.id || friend.data().uid === target.id);
  if (alreadyFriend) throw new Error("User already in your friend list");
  await setDoc(doc(db, "friends", currentUser.uid, "userFriends", target.id), { uid: target.id, status: "accepted", createdAt: serverTimestamp() });
  return target.data();
}

function chatIdFor(uid) { return [currentUser.uid, uid].sort().join("_"); }

export async function sendDirectMessage(friendUid, text) {
  const value = text.trim();
  if (!value || !currentUser || !friendUid) return;
  const profile = await getUserProfile(currentUser.uid);
  await addDoc(collection(db, "direct_messages", chatIdFor(friendUid), "messages"), { text: value, uid: currentUser.uid, userEmail: currentUser.email, senderUsername: profile?.username || profile?.displayName || "", createdAt: serverTimestamp() });
}

export function listenForDirectMessages(friendUid) {
  activeFriendUid = friendUid;
  directUnsubscribe?.();
  if (directUnsubscribe) activeUnsubscribes.splice(activeUnsubscribes.indexOf(directUnsubscribe), 1);
  const messagesQuery = query(collection(db, "direct_messages", chatIdFor(friendUid), "messages"), orderBy("createdAt", "asc"));
  directUnsubscribe = onSnapshot(messagesQuery, (snapshot) => { directMessages.replaceChildren(); snapshot.forEach((message) => renderMessage(message, directMessages, "direct")); directMessages.scrollTop = directMessages.scrollHeight; }, (err) => console.warn("Listener detached:", err.message));
  activeUnsubscribes.push(directUnsubscribe);
  return directUnsubscribe;
}

function renderFriend(friend, list) {
  const item = document.createElement("li");
  const button = document.createElement("button");
  button.type = "button"; button.textContent = profileLabel(friend);
  button.addEventListener("click", () => { activeDmHeading.textContent = profileLabel(friend); listenForDirectMessages(friend.uid); });
  item.appendChild(button); list.appendChild(item);
}

function listenForFriends() {
  const unsubscribe = onSnapshot(collection(db, "friends", currentUser.uid, "userFriends"), async (snapshot) => {
    friendsList.replaceChildren(); dmFriendsList.replaceChildren();
    const friends = await Promise.all(snapshot.docs.map((item) => getUserProfile(item.id)));
    friends.filter(Boolean).forEach((friend) => { renderFriend(friend, friendsList); renderFriend(friend, dmFriendsList); });
  }, (err) => console.warn("Listener detached:", err.message));
  activeUnsubscribes.push(unsubscribe);
}

function listenForOnlineUsers() {
  const unsubscribe = onSnapshot(query(collection(db, "users"), where("isOnline", "==", true)), (snapshot) => {
    const list = document.getElementById("user-list"); list.replaceChildren();
    snapshot.forEach((item) => { const li = document.createElement("li"); li.textContent = `● ${profileLabel(item.data())}`; li.className = "online-user"; list.appendChild(li); });
  }, (err) => console.warn("Listener detached:", err.message));
  activeUnsubscribes.push(unsubscribe);
}

messageForm.addEventListener("submit", (event) => { event.preventDefault(); sendMessage(messageInput.value).then(() => { messageInput.value = ""; }).catch(console.error); });
messageInput.addEventListener("keypress", (event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); messageForm.requestSubmit(); } });
directMessageForm.addEventListener("submit", (event) => { event.preventDefault(); sendDirectMessage(activeFriendUid, directMessageInput.value).then(() => { directMessageInput.value = ""; }).catch(console.error); });

document.querySelectorAll(".tab-button").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll(".tab-button").forEach((item) => item.classList.toggle("is-active", item === button));
  document.querySelectorAll(".subview").forEach((view) => { const active = view.id === `subview-${button.dataset.view}`; view.hidden = !active; view.classList.toggle("is-visible", active); });
}));

document.getElementById("friend-search-form").addEventListener("submit", async (event) => { event.preventDefault(); const result = document.getElementById("friend-search-result"); try { const friend = await addFriend(document.getElementById("friend-search-input").value); result.textContent = `${friend.username || friend.email} added to your friends.`; } catch (error) { result.textContent = error.message; } });
document.getElementById("profile-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const userRef = doc(db, "users", currentUser.uid);
  const profile = await getUserProfile(currentUser.uid);
  const username = profile?.username?.trim().toLowerCase();
  await setDoc(userRef, { displayName: document.getElementById("display-name-input").value.trim(), isOnline: document.getElementById("online-status-input").checked, lastSeen: serverTimestamp() }, { merge: true });
  if (username) await setDoc(doc(db, "usernames", username), { uid: currentUser.uid, username }, { merge: true });
  document.getElementById("profile-status").textContent = "Profile saved.";
});

export function startApp(user) { stopAllListeners(); currentUser = user; listenForMessages(); listenForFriends(); listenForOnlineUsers(); }
