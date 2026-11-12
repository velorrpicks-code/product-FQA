// Product Assistant frontend for the n8n Chat Trigger.
// Keep this URL as your n8n production Chat URL.
const N8N_CHAT_URL = "https://velor.app.n8n.cloud/webhook/36a95220-c279-4f8b-a71f-e0ec999c281d/chat";

const STORAGE_KEY = "velor-product-assistant-v1";
const SESSION_KEY = "velor-product-assistant-session";
const $ = (selector) => document.querySelector(selector);

const welcomeScreen = $("#welcomeScreen");
const conversation = $("#conversation");
const messagesEl = $("#messages");
const chatHistoryEl = $("#chatHistory");
const welcomeForm = $("#welcomeForm");
const composerForm = $("#composerForm");
const welcomeInput = $("#welcomeInput");
const composerInput = $("#composerInput");
const sendButtons = document.querySelectorAll(".send-button");
const toastEl = $("#toast");

let sessionId = getOrCreateSession();
let chats = loadChats();
let activeChatId = sessionId;
let isSending = false;

function getOrCreateSession() {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = (crypto.randomUUID ? crypto.randomUUID() : `session-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

function loadChats() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function saveChats() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(chats.slice(0, 40)));
}

function currentChat() {
  return chats.find(chat => chat.id === activeChatId);
}

function createChat() {
  sessionId = (crypto.randomUUID ? crypto.randomUUID() : `session-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  localStorage.setItem(SESSION_KEY, sessionId);
  activeChatId = sessionId;
  chats.unshift({ id: sessionId, title: "New conversation", messages: [], updatedAt: Date.now() });
  saveChats();
  renderHistory();
  renderMessages();
  showWelcome();
  closeSidebar();
  welcomeInput.focus();
}

function ensureCurrentChat(firstMessage) {
  let chat = currentChat();
  if (!chat) {
    chat = { id: sessionId, title: firstMessage.slice(0, 38), messages: [], updatedAt: Date.now() };
    chats.unshift(chat);
  }
  if (chat.title === "New conversation" && firstMessage) chat.title = firstMessage.slice(0, 38);
  chat.updatedAt = Date.now();
  saveChats();
  renderHistory();
  return chat;
}

function renderHistory() {
  chatHistoryEl.innerHTML = "";
  if (!chats.length) {
    const empty = document.createElement("div");
    empty.className = "history-empty";
    empty.textContent = "Your conversations will appear here.";
    chatHistoryEl.appendChild(empty);
    return;
  }

  [...chats].sort((a,b) => b.updatedAt - a.updatedAt).forEach(chat => {
    const button = document.createElement("button");
    button.className = `history-item${chat.id === activeChatId ? " active" : ""}`;
    button.textContent = chat.title || "Conversation";
    button.title = chat.title || "Conversation";
    button.addEventListener("click", () => openChat(chat.id));
    chatHistoryEl.appendChild(button);
  });
}

function openChat(id) {
  const chat = chats.find(item => item.id === id);
  if (!chat) return;
  activeChatId = id;
  sessionId = id;
  localStorage.setItem(SESSION_KEY, sessionId);
  renderHistory();
  renderMessages();
  showConversation();
  closeSidebar();
}

function renderMessages() {
  messagesEl.innerHTML = "";
  const chat = currentChat();
  if (!chat) return;
  chat.messages.forEach(message => addMessageToDOM(message.role, message.text));
}

function addMessageToDOM(role, text) {
  const row = document.createElement("div");
  row.className = `message-row ${role === "user" ? "user" : "assistant"}`;
  if (role !== "user") {
    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.textContent = "✦";
    row.appendChild(avatar);
  }
  const bubble = document.createElement("div");
  bubble.className = "message-bubble";
  bubble.textContent = text;
  row.appendChild(bubble);
  messagesEl.appendChild(row);
  conversation.scrollTop = conversation.scrollHeight;
  return row;
}

function addMessage(role, text) {
  const chat = ensureCurrentChat(role === "user" ? text : "");
  chat.messages.push({ role, text, at: Date.now() });
  chat.updatedAt = Date.now();
  saveChats();
  addMessageToDOM(role, text);
  renderHistory();
}

function showWelcome() {
  welcomeScreen.classList.remove("hidden");
  conversation.classList.add("hidden");
}
function showConversation() {
  welcomeScreen.classList.add("hidden");
  conversation.classList.remove("hidden");
  conversation.scrollTop = conversation.scrollHeight;
}

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toastEl.classList.remove("show"), 4200);
}

function setBusy(busy) {
  isSending = busy;
  sendButtons.forEach(button => button.disabled = busy);
  composerInput.disabled = busy;
  welcomeInput.disabled = busy;
}

function extractReply(data) {
  // Chat Trigger workflows commonly return { output: "..." } or { text: "..." }.
  // This also handles array-wrapped and nested JSON responses.
  let value = data;
  for (let depth = 0; depth < 5; depth++) {
    if (typeof value === "string") return value;
    if (Array.isArray(value)) {
      if (!value.length) break;
      value = value[0];
      continue;
    }
    if (value && typeof value === "object") {
      const key = ["output", "text", "reply", "response", "message", "answer"].find(k => value[k] !== undefined);
      if (key) {
        value = value[key];
        continue;
      }
      if (value.data !== undefined) {
        value = value.data;
        continue;
      }
    }
    break;
  }
  if (typeof value === "string") return value;
  if (value && typeof value === "object") return JSON.stringify(value, null, 2);
  return "I received a response, but couldn't find the answer text. Please check the final output of your n8n workflow.";
}

async function sendMessage(rawText) {
  const text = rawText.trim();
  if (!text || isSending) return;

  showConversation();
  addMessage("user", text);
  const typingRow = addMessageToDOM("assistant", "Thinking…");
  typingRow.classList.add("typing");
  setBusy(true);

  try {
    const url = new URL(N8N_CHAT_URL);
    url.searchParams.set("action", "sendMessage");

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatInput: text,
        sessionId: sessionId
      })
    });

    const raw = await response.text();
    let data;
    try { data = raw ? JSON.parse(raw) : {}; }
    catch { data = raw; }

    if (!response.ok) {
      const detail = typeof data === "string" ? data : (data.message || data.error || JSON.stringify(data));
      throw new Error(`n8n returned ${response.status}: ${detail}`);
    }

    const reply = extractReply(data);
    typingRow.remove();
    addMessage("assistant", reply);
  } catch (error) {
    typingRow.remove();
    const message = error && error.message ? error.message : "Unknown connection error";
    addMessage("assistant", `Sorry, I couldn't connect to the product assistant. ${message}\n\nPlease check the n8n workflow is active and that Allowed Origins (CORS) includes your website domain.`);
    showToast("Couldn't reach n8n. Check your connection and CORS settings.");
    console.error("n8n chat error:", error);
  } finally {
    setBusy(false);
    composerInput.focus();
  }
}

welcomeForm.addEventListener("submit", event => {
  event.preventDefault();
  const value = welcomeInput.value;
  welcomeInput.value = "";
  sendMessage(value);
});
composerForm.addEventListener("submit", event => {
  event.preventDefault();
  const value = composerInput.value;
  composerInput.value = "";
  sendMessage(value);
});

document.querySelectorAll(".suggestion").forEach(button => {
  button.addEventListener("click", () => sendMessage(button.dataset.prompt || button.textContent.trim()));
});

$("#newChatButton").addEventListener("click", createChat);
$("#mobileNewChat").addEventListener("click", createChat);

function openSidebar() {
  $("#sidebar").classList.add("open");
  $("#sidebarBackdrop").classList.add("show");
}
function closeSidebar() {
  $("#sidebar").classList.remove("open");
  $("#sidebarBackdrop").classList.remove("show");
}
$("#openSidebar").addEventListener("click", openSidebar);
$("#closeSidebar").addEventListener("click", closeSidebar);
$("#sidebarBackdrop").addEventListener("click", closeSidebar);

// Restore the latest locally saved conversation, if present.
if (chats.length) {
  const latest = [...chats].sort((a,b) => b.updatedAt - a.updatedAt)[0];
  activeChatId = latest.id;
  sessionId = latest.id;
  localStorage.setItem(SESSION_KEY, sessionId);
  renderHistory();
  renderMessages();
  if (latest.messages && latest.messages.length) showConversation();
  else showWelcome();
} else {
  renderHistory();
  showWelcome();
}
