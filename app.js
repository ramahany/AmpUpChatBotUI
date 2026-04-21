// Replace with your real backend endpoint when ready.
const API_ENDPOINT = "https://web-production-f4213.up.railway.app/api/v1/chat/";
const ID_PATTERN = /^[A-Za-z_]+$/;

const messagesEl = document.getElementById("messages");
const sessionIdEl = document.getElementById("sessionId");
const userIdEl = document.getElementById("userId");
const chatInputEl = document.getElementById("chatInput");
const formEl = document.getElementById("composerForm");
const sendBtnEl = document.getElementById("sendBtn");
const errorTextEl = document.getElementById("errorText");

function markdownToSafeHtml(markdownText) {
  if (typeof marked === "undefined") {
    return markdownText;
  }

  const rawHtml = marked.parse(markdownText, {
    breaks: true,
    gfm: true
  });

  if (typeof DOMPurify === "undefined") {
    return rawHtml;
  }

  return DOMPurify.sanitize(rawHtml);
}

function appendMessage(text, role, options = {}) {
  const bubble = document.createElement("div");
  bubble.className = `bubble ${role}`;
  bubble.innerHTML =  marked.parse(text);
  messagesEl.appendChild(bubble);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return bubble;
}

function createThinkingBubble() {
  const bubble = document.createElement("div");
  bubble.className = "bubble bot";

  const typing = document.createElement("span");
  typing.className = "typing";

  for (let i = 0; i < 3; i += 1) {
    const dot = document.createElement("span");
    dot.className = "typing-dot";
    typing.appendChild(dot);
  }

  bubble.appendChild(typing);
  messagesEl.appendChild(bubble);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return bubble;
}

function autoResizeTextarea() {
  chatInputEl.style.height = "auto";
  chatInputEl.style.height = Math.min(chatInputEl.scrollHeight, 180) + "px";
}

function showError(msg) {
  errorTextEl.textContent = msg || "";
}

function validateIdField(inputEl) {
  const value = inputEl.value.trim();
  const valid = value.length > 0 && ID_PATTERN.test(value);
  inputEl.classList.toggle("invalid", !valid && value.length > 0);
  return valid;
}

function validateIdsBeforeSend() {
  const sessionIdValid = validateIdField(sessionIdEl);
  const userIdValid = validateIdField(userIdEl);

  if (!sessionIdEl.value.trim() || !userIdEl.value.trim()) {
    showError("Please fill session_id and user_id before sending a message.");
    return false;
  }

  if (!sessionIdValid || !userIdValid) {
    showError("session_id and user_id can contain only letters and underscore (_).");
    return false;
  }

  showError("");
  return true;
}

async function sendMessage(userText) {
  const payload = {
    session_id: sessionIdEl.value.trim(),
    user_id: userIdEl.value.trim(),
    user_msg: userText
  };

  appendMessage(userText, "user", { markdown: true });
  const thinkingBubble = createThinkingBubble();
  sendBtnEl.disabled = true;
  chatInputEl.disabled = true;

  try {
    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const data = await response.json();
    // Expected placeholder shape: { bot_msg: "..." }
    const botText = data.bot_msg || data.response || "No bot message returned.";
    thinkingBubble.remove();
    appendMessage(botText, "bot", { markdown: true });
  } catch (error) {
    thinkingBubble.remove();
    appendMessage(
      "Could not reach the server. Replace API_ENDPOINT with your backend URL and try again.",
      "bot"
    );
    showError(error.message);
  } finally {
    sendBtnEl.disabled = false;
    chatInputEl.disabled = false;
    chatInputEl.focus();
  }
}

formEl.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = chatInputEl.value.trim();

  if (!validateIdsBeforeSend()) return;
  if (!text) {
    showError("Please write a message before sending.");
    return;
  }

  showError("");
  chatInputEl.value = "";
  autoResizeTextarea();
  await sendMessage(text);
});

[sessionIdEl, userIdEl].forEach((inputEl) => {
  inputEl.addEventListener("input", () => {
    const value = inputEl.value;
    const filtered = value.replace(/[^A-Za-z_]/g, "");
    if (filtered !== value) {
      inputEl.value = filtered;
    }
    validateIdField(inputEl);
  });
  inputEl.addEventListener("blur", () => validateIdField(inputEl));
});

chatInputEl.addEventListener("input", autoResizeTextarea);
chatInputEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    formEl.requestSubmit();
  }
});

appendMessage("Hello! Fill session_id and user_id, then start chatting.", "bot", {
  markdown: true
});
