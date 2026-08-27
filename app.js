import { db } from "./firebase-config.js";
import {
  addDoc, collection, doc, getDoc, getDocs, onSnapshot, orderBy, query,
  serverTimestamp, setDoc, where
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

export const activeUnsubscribes = [];
const AVATARS = [
  "./assets/avatars/avatar1.png",
  "./assets/avatars/avatar2.png",
  "./assets/avatars/avatar3.png",
  "./assets/avatars/avatar4.png",
  "./assets/avatars/avatar5.png"
];
const LEGACY_AVATARS = [
  "./assets/avatars/avatar1.jpg",
  "./assets/avatars/avatar2.jpg",
  "./assets/avatars/avatar3.jpg",
  "./assets/avatars/avatar4.jpg",
  "./assets/avatars/avatar5.jpg"
];
let currentUser = null;
let activeFriendUid = null;
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
const drawerToggle = document.getElementById("drawer-toggle");
const sideDrawer = document.getElementById("side-drawer");
const drawerBackdrop = document.getElementById("drawer-backdrop");
const drawerAvatar = document.getElementById("drawer-avatar");
const drawerDisplayName = document.getElementById("drawer-display-name");
const drawerUsername = document.getElementById("drawer-username");

function normalizeAvatarPath(value) {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const byIndex = AVATARS.find((avatar, index) => {
    const matches = avatar.endsWith(`avatar${index + 1}.png`) || avatar.endsWith(`avatar${index + 1}.jpg`);
    return matches && (trimmed === avatar || trimmed.endsWith(`avatar${index + 1}.png`) || trimmed.endsWith(`avatar${index + 1}.jpg`));
  });
  if (byIndex) return byIndex;

  const legacyIndex = LEGACY_AVATARS.indexOf(trimmed);
  if (legacyIndex !== -1) return AVATARS[legacyIndex];

  return trimmed;
}

function getAvatarSource(value) {
  if (value === null || value === undefined || value === "") return AVATARS[0];
  if (typeof value === "number") return AVATARS[value] || AVATARS[0];
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return AVATARS[0];
    if (/^\d+$/.test(trimmed)) {
      const index = Number(trimmed);
      return AVATARS[index] || AVATARS[0];
    }
    if (trimmed.startsWith("./") || trimmed.startsWith("/") || trimmed.startsWith("http")) {
      return normalizeAvatarPath(trimmed) || AVATARS[0];
    }
    return AVATARS.includes(trimmed) ? trimmed : AVATARS[0];
  }
  return AVATARS[0];
}

function resolveAvatarPath(profileOrUser) {
  if (!profileOrUser) return AVATARS[0];
  if (profileOrUser.avatar) return getAvatarSource(profileOrUser.avatar);
  if (typeof profileOrUser.avatarIndex === "number") return getAvatarSource(profileOrUser.avatarIndex);
  return AVATARS[0];
}

function createAvatarImage(src, alt = "User avatar", className = "avatar") {
  const img = document.createElement("img");
  img.src = src;
  img.alt = alt;
  img.loading = "lazy";
  img.className = className;
  img.onerror = () => {
    if (img.src !== AVATARS[0]) {
      img.src = AVATARS[0];
    }
  };
  return img;
}

function renderAvatarSelector(selectedAvatar = AVATARS[0]) {
  const container = document.getElementById("avatar-picker-container");
  if (!container) return;

  const activeAvatar = getAvatarSource(selectedAvatar);
  container.replaceChildren();

  AVATARS.forEach((avatar, index) => {
    const label = document.createElement("label");
    label.className = "avatar-option";

    const input = document.createElement("input");
    input.type = "radio";
    input.name = "selectedAvatar";
    input.value = avatar;
    input.checked = activeAvatar === avatar;

    const image = createAvatarImage(avatar, `Avatar ${index + 1}`, "avatar-option-image");
    label.append(input, image);
    container.appendChild(label);
  });
}

async function hydrateAvatarPicker() {
  if (!currentUser) return;
  const profile = await getUserProfile(currentUser.uid);
  const selected = resolveAvatarPath(profile);
  renderAvatarSelector(selected);
}

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

  const senderRow = document.createElement("div");
  senderRow.className = "message-header";

  const avatar = createAvatarImage(resolveAvatarPath(data), "Sender avatar", "message-avatar");
  const sender = document.createElement("strong");
  sender.textContent = data.senderDisplayName || data.senderUsername || (data.userEmail?.split("@")[0] || "Unknown User");

  senderRow.append(avatar, sender);

  const text = document.createElement("div");
  text.className = "message-text";
  text.textContent = data.text || "";

  element.append(senderRow, text);
  container.appendChild(element);
}

export async function sendMessage(text) {
  const value = text.trim();
  if (!value || !currentUser) return;
  const profile = await getUserProfile(currentUser.uid);
  const avatarPath = resolveAvatarPath(profile);
  await addDoc(collection(db, "public_messages"), {
    text: value,
    uid: currentUser.uid,
    userEmail: currentUser.email,
    senderUsername: profile?.username || "",
    senderDisplayName: profile?.displayName || "",
    avatar: avatarPath,
    avatarIndex: AVATARS.indexOf(avatarPath),
    createdAt: serverTimestamp()
  });
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
  return data.displayName || data.username || data.email?.split("@")[0] || "Unknown User";
}

export async function searchUsers(targetEmailOrUsername) {
  if (!currentUser) throw new Error("You must be signed in.");
  const rawInput = String(targetEmailOrUsername ?? "").trim();
  if (!rawInput) throw new Error("Please enter a username, display name, or email.");

  const queryTermLower = rawInput.toLowerCase().replace(/^@/, "");
  const emailLower = rawInput.toLowerCase();

  try {
    const [byUsername, byDisplayName, byEmail] = await Promise.all([
      getDocs(query(collection(db, "users"), where("username", "==", queryTermLower))).catch((err) => { console.warn("Username query failed:", err); return { docs: [] }; }),
      getDocs(query(collection(db, "users"), where("displayNameLower", "==", queryTermLower))).catch((err) => { console.warn("Display name query failed:", err); return { docs: [] }; }),
      getDocs(query(collection(db, "users"), where("email", "==", emailLower))).catch((err) => { console.warn("Email query failed:", err); return { docs: [] }; })
    ]);

    const matches = new Map();
    const allDocs = [...(byUsername?.docs || []), ...(byDisplayName?.docs || []), ...(byEmail?.docs || [])];
    if (allDocs.length === 0) return [];

    allDocs.forEach((result) => {
      if (!result || !result.id) return;
      const data = result.data();
      const uid = data?.uid || result.id;
      if (!uid) return;
      matches.set(uid, { id: result.id, ...data, uid, avatar: resolveAvatarPath(data) });
    });

    return [...matches.values()];
  } catch (error) {
    console.error("Search users error:", error);
    throw error;
  }
}

function renderSearchResult(user, container) {
  const row = document.createElement("div");
  row.className = "search-result-item";

  const info = document.createElement("div");
  info.className = "search-result-info";
  info.append(
    createAvatarImage(resolveAvatarPath(user), `Avatar for ${profileLabel(user)}`, "search-avatar"),
    document.createTextNode(profileLabel(user))
  );

  const addButton = document.createElement("button");
  addButton.type = "button";
  addButton.className = "add-friend-button";

  const uid = user.uid || user.id;
  const isSelf = !!currentUser && (uid === currentUser.uid || uid === currentUser.email);

  if (isSelf) {
    addButton.textContent = "You";
    addButton.disabled = true;
  } else {
    addButton.textContent = "Add";
    addButton.addEventListener("click", async () => {
      try {
        addButton.disabled = true;
        addButton.textContent = "Adding...";
        await addFriendByUid(uid);
        addButton.textContent = "Added";
      } catch (error) {
        addButton.disabled = false;
        addButton.textContent = "Add";
        console.error("Add friend from search error:", error);
      }
    });
  }

  row.append(info, addButton);
  container.appendChild(row);
  return row;
}

export async function addFriendByUid(uid) {
  if (!currentUser) throw new Error("You must be signed in.");
  if (!uid) throw new Error("User ID is required.");
  if (uid === currentUser.uid) throw new Error("You cannot add yourself.");

  const targetProfile = await getUserProfile(uid);
  if (!targetProfile) throw new Error("User not found.");

  const existingFriends = await getDocs(collection(db, "friends", currentUser.uid, "userFriends")).catch((err) => { console.warn("Friends list query failed:", err); return { docs: [] }; });
  const alreadyFriend = existingFriends.docs.some((friend) => friend.id === uid || friend.data()?.uid === uid);
  if (alreadyFriend) throw new Error("User already in your friend list.");

  await setDoc(doc(db, "friends", currentUser.uid, "userFriends", uid), { uid, status: "accepted", createdAt: serverTimestamp() });
  return targetProfile;
}

export async function addFriend(targetEmailOrUsername) {
  const users = await searchUsers(targetEmailOrUsername);
  const target = users[0];
  if (!target) throw new Error("No user found with that username, display name, or email.");
  return addFriendByUid(target.uid || target.id);
}

function chatIdFor(uid) { return [currentUser.uid, uid].sort().join("_"); }

export async function sendDirectMessage(friendUid, text) {
  const value = text.trim();
  if (!value || !currentUser || !friendUid) return;
  const profile = await getUserProfile(currentUser.uid);
  const avatarPath = resolveAvatarPath(profile);
  await addDoc(collection(db, "direct_messages", chatIdFor(friendUid), "messages"), {
    text: value,
    uid: currentUser.uid,
    userEmail: currentUser.email,
    senderUsername: profile?.username || "",
    senderDisplayName: profile?.displayName || "",
    avatar: avatarPath,
    avatarIndex: AVATARS.indexOf(avatarPath),
    createdAt: serverTimestamp()
  });
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
  button.type = "button";
  button.className = "friend-button";
  button.append(
    createAvatarImage(resolveAvatarPath(friend), `Avatar for ${profileLabel(friend)}`, "friend-avatar"),
    document.createTextNode(profileLabel(friend))
  );
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
    snapshot.forEach((item) => {
      const userData = item.data();
      const li = document.createElement("li");
      li.className = "online-user";
      li.append(
        createAvatarImage(resolveAvatarPath(userData), `Avatar for ${profileLabel(userData)}`, "online-user-avatar"),
        document.createTextNode(profileLabel(userData))
      );
      list.appendChild(li);
    });
  }, (err) => console.warn("Listener detached:", err.message));
  activeUnsubscribes.push(unsubscribe);
}

messageForm.addEventListener("submit", (event) => { event.preventDefault(); sendMessage(messageInput.value).then(() => { messageInput.value = ""; }).catch(console.error); });
messageInput.addEventListener("keypress", (event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); messageForm.requestSubmit(); } });
directMessageForm.addEventListener("submit", (event) => { event.preventDefault(); sendDirectMessage(activeFriendUid, directMessageInput.value).then(() => { directMessageInput.value = ""; }).catch(console.error); });

document.querySelectorAll(".tab-button").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll(".tab-button").forEach((item) => item.classList.toggle("is-active", item === button));
  document.querySelectorAll(".subview").forEach((view) => { const active = view.id === `subview-${button.dataset.view}`; view.hidden = !active; view.classList.toggle("is-visible", active); });
  closeDrawer();
}));

drawerToggle?.addEventListener("click", () => {
  const isOpen = sideDrawer?.classList.contains("is-open");
  setDrawerOpen(!isOpen);
});

drawerBackdrop?.addEventListener("click", closeDrawer);

document.getElementById("friend-search-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const result = document.getElementById("friend-search-result");
  const searchInput = document.getElementById("friend-search-input");
  result.replaceChildren();

  try {
    const matches = await searchUsers(searchInput.value);
    if (!matches.length) {
      result.textContent = "No users found.";
      return;
    }

    matches.forEach((user) => renderSearchResult(user, result));
  } catch (error) {
    result.textContent = error.message;
  }
});

document.getElementById("profile-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const userRef = doc(db, "users", currentUser.uid);
  const profile = await getUserProfile(currentUser.uid);
  const username = profile?.username?.trim().toLowerCase();
  const newDisplayName = document.getElementById("display-name-input").value.trim();
  const selectedAvatar = document.querySelector('input[name="selectedAvatar"]:checked')?.value || AVATARS[0];

  await setDoc(userRef, {
    displayName: newDisplayName,
    displayNameLower: newDisplayName.toLowerCase(),
    avatar: selectedAvatar,
    avatarIndex: AVATARS.indexOf(selectedAvatar),
    isOnline: document.getElementById("online-status-input").checked,
    lastSeen: serverTimestamp()
  }, { merge: true });

  if (username) await setDoc(doc(db, "usernames", username), { uid: currentUser.uid, username }, { merge: true });
  const refreshedProfile = await getUserProfile(currentUser.uid);
  updateDrawerProfile(refreshedProfile);
  renderAvatarSelector(selectedAvatar);
  document.getElementById("profile-status").textContent = "Profile saved.";
});

export async function startApp(user) {
  stopAllListeners();
  currentUser = user;
  const profile = await getUserProfile(user.uid);
  updateDrawerProfile(profile);
  await hydrateAvatarPicker();
  listenForMessages();
  listenForFriends();
  listenForOnlineUsers();
}

function setDrawerOpen(isOpen) {
  sideDrawer?.classList.toggle("is-open", isOpen);
  drawerBackdrop?.classList.toggle("is-visible", isOpen);
  drawerToggle?.setAttribute("aria-expanded", String(isOpen));
}

function updateDrawerProfile(profile = null) {
  if (!drawerDisplayName || !drawerUsername || !drawerAvatar) return;

  const profileData = profile || {};
  const displayName = profileData.displayName?.trim() || profileData.username || currentUser?.email?.split("@")[0] || "Profile";
  const username = profileData.username ? `@${profileData.username}` : (currentUser?.email || "");

  drawerDisplayName.textContent = displayName;
  drawerUsername.textContent = username;
  drawerAvatar.src = resolveAvatarPath(profileData || currentUser);
  drawerAvatar.alt = `${displayName} avatar`;
}

function openDrawer() { setDrawerOpen(true); }
function closeDrawer() { setDrawerOpen(false); }
