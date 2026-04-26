// Replace with your real backend endpoint when ready.
const API_ENDPOINT = "http://127.0.0.1:8000/api/v1/chat/";
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
  bubble.innerHTML = marked.parse(text);
  messagesEl.appendChild(bubble);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return bubble;
}

function formatSourceScore(score) {
  const numericScore = Number(score);
  if (!Number.isFinite(numericScore)) {
    return "N/A";
  }
  return numericScore.toFixed(3);
}

function normalizeSources(sources) {
  if (!Array.isArray(sources)) {
    return [];
  }

  return sources
    .map((source, index) => {
      if (Array.isArray(source)) {
        const [link, title, score] = source;
        if (!link) {
          return null;
        }

        return {
          id: `${index}-${link}`,
          link: String(link),
          title: String(title || link),
          score
        };
      }

      if (typeof source === "string" && source.trim()) {
        return {
          id: `${index}-${source}`,
          link: source,
          title: source,
          score: null
        };
      }

      if (source && typeof source === "object") {
        const link = source.link || source.url || source.href;
        const title = source.title || source.name || link;
        if (!link) {
          return null;
        }

        return {
          id: `${index}-${link}`,
          link: String(link),
          title: String(title),
          score: source.score
        };
      }

      return null;
    })
    .filter(Boolean);
}

function normalizeFollowUps(followUpQuestions) {
  if (!Array.isArray(followUpQuestions)) {
    return [];
  }

  return followUpQuestions
    .map((question) => (typeof question === "string" ? question.trim() : ""))
    .filter(Boolean);
}

function buildFollowUpsSection(followUpQuestions) {
  const normalizedFollowUps = normalizeFollowUps(followUpQuestions);
  if (normalizedFollowUps.length === 0) {
    return null;
  }

  const wrap = document.createElement("div");
  wrap.className = "followups-wrap";

  const heading = document.createElement("div");
  heading.className = "followups-heading";
  heading.textContent = "Suggested follow-ups";
  wrap.appendChild(heading);

  const list = document.createElement("div");
  list.className = "followups-list";

  normalizedFollowUps.forEach((question) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "followup-card";
    button.textContent = question;
    button.addEventListener("click", () => {
      if (sendBtnEl.disabled) return;
      chatInputEl.value = question;
      autoResizeTextarea();
      formEl.requestSubmit();
    });
    list.appendChild(button);
  });

  wrap.appendChild(list);
  return wrap;
}

function buildSourcesSection(sources) {
  const normalizedSources = normalizeSources(sources);
  if (normalizedSources.length === 0) {
    return null;
  }

  const sourcesWrap = document.createElement("div");
  sourcesWrap.className = "sources-wrap";

  const heading = document.createElement("div");
  heading.className = "sources-heading";
  heading.textContent = `Sources (${normalizedSources.length})`;
  sourcesWrap.appendChild(heading);

  const list = document.createElement("div");
  list.className = "sources-list";

  normalizedSources.forEach((source, index) => {
    const details = document.createElement("details");
    details.className = "source-card";

    const summary = document.createElement("summary");
    summary.className = "source-summary";
    summary.textContent = source.title;
    details.appendChild(summary);

    const body = document.createElement("div");
    body.className = "source-details";

    const score = document.createElement("div");
    score.className = "source-score";
    score.textContent = `Score: ${formatSourceScore(source.score)}`;
    body.appendChild(score);

    const anchor = document.createElement("a");
    anchor.className = "source-link";
    anchor.href = source.link;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.textContent = source.link;
    body.appendChild(anchor);

    details.appendChild(body);
    list.appendChild(details);
  });

  sourcesWrap.appendChild(list);
  return sourcesWrap;
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
    const botText = data.response || data.bot_msg || "No bot message returned.";
    const followUpQuestions = data.follow_up_questions;
    const sources = data.sources || data.links || data.source_links || [];
    thinkingBubble.remove();
    const botBubble = appendMessage(botText, "bot", { markdown: true });
    const followUpsSection = buildFollowUpsSection(followUpQuestions);
    if (followUpsSection) {
      botBubble.appendChild(followUpsSection);
    }
    const sourcesSection = buildSourcesSection(sources);
    if (sourcesSection) {
      botBubble.appendChild(sourcesSection);
    }
    messagesEl.scrollTop = messagesEl.scrollHeight;
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
