// Hands-Free Assistant (V1)
// Speech-to-text + local note saving
// Works best in Chrome/Edge. Safari/Firefox support may vary.

const btnListen = document.getElementById("btnListen");
const btnStop = document.getElementById("btnStop");
const btnSave = document.getElementById("btnSave");
const btnClear = document.getElementById("btnClear");
const btnDeleteAll = document.getElementById("btnDeleteAll");

const statusEl = document.getElementById("status");
const liveText = document.getElementById("liveText");
const categoryEl = document.getElementById("category");

const notesList = document.getElementById("notesList");
const emptyEl = document.getElementById("empty");

const STORAGE_KEY = "hfa_notes_v1";

function nowISO() {
  return new Date().toISOString();
}

function loadNotes() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveNotes(notes) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

function setStatus(text) {
  statusEl.textContent = text;
}

function renderNotes() {
  const notes = loadNotes();
  notesList.innerHTML = "";

  emptyEl.style.display = notes.length ? "none" : "block";

  for (const note of notes.slice().reverse()) {
    const li = document.createElement("li");
    li.className = "note";

    const meta = document.createElement("div");
    meta.className = "meta";

    const when = new Date(note.createdAt).toLocaleString();
    meta.innerHTML = `<span><strong>${note.category || "Uncategorized"}</strong></span><span>${when}</span>`;

    const text = document.createElement("div");
    text.className = "text";
    text.textContent = note.text;

    const actions = document.createElement("div");
    actions.className = "actions";

    const btnCopy = document.createElement("button");
    btnCopy.className = "btn secondary";
    btnCopy.textContent = "Copy";
    btnCopy.onclick = async () => {
      await navigator.clipboard.writeText(note.text);
      setStatus("Copied to clipboard");
      setTimeout(() => setStatus("Idle"), 900);
    };

    const btnDelete = document.createElement("button");
    btnDelete.className = "btn danger";
    btnDelete.textContent = "Delete";
    btnDelete.onclick = () => {
      const all = loadNotes();
      const filtered = all.filter(n => n.id !== note.id);
      saveNotes(filtered);
      renderNotes();
      setStatus("Deleted note");
      setTimeout(() => setStatus("Idle"), 900);
    };

    actions.append(btnCopy, btnDelete);
    li.append(meta, text, actions);
    notesList.appendChild(li);
  }
}

// --- Speech Recognition (Web Speech API) ---
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

let recognition = null;
let listening = false;

// Wake phrase logic (simple V1):
// If transcript includes "hey assist", we will treat subsequent speech as note content.
// For now, we just start/stop with buttons AND detect "hey assist" as a hint.
const WAKE_PHRASE = "hey assist";
let wakeDetected = false;

function setupRecognition() {
  if (!SpeechRecognition) return null;

  const rec = new SpeechRecognition();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = "en-US";

  rec.onstart = () => {
    listening = true;
    btnListen.disabled = true;
    btnStop.disabled = false;
    setStatus("Listening…");
  };

  rec.onend = () => {
    listening = false;
    btnListen.disabled = false;
    btnStop.disabled = true;
    setStatus("Idle");
  };

  rec.onerror = (e) => {
    setStatus(`Error: ${e.error}`);
  };

  rec.onresult = (event) => {
    let interim = "";
    let finalText = "";

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const res = event.results[i];
      const transcript = res[0].transcript;
      if (res.isFinal) finalText += transcript;
      else interim += transcript;
    }

    // Combine for display
    const combined = (finalText + " " + interim).trim();
    if (!combined) return;

    // Wake phrase detection (V1 heuristic)
    const lower = combined.toLowerCase();
    if (lower.includes(WAKE_PHRASE)) {
      wakeDetected = true;
      setStatus('Wake detected: "Hey Assist"');
      // Remove wake phrase from the displayed text
      const cleaned = combined.replace(new RegExp(WAKE_PHRASE, "ig"), "").trim();
      if (cleaned) liveText.value = cleaned;
      btnSave.disabled = liveText.value.trim().length === 0;
      return;
    }

    // If wake was detected earlier, treat speech as note content
    if (wakeDetected) {
      liveText.value = combined;
      btnSave.disabled = liveText.value.trim().length === 0;
    } else {
      // Otherwise, still show it (helps debugging), but saving remains enabled only if text exists
      liveText.value = combined;
      btnSave.disabled = liveText.value.trim().length === 0;
    }
  };

  return rec;
}

function ensureRecognition() {
  if (recognition) return recognition;
  recognition = setupRecognition();
  return recognition;
}

btnListen.onclick = async () => {
  const rec = ensureRecognition();
  if (!rec) {
    setStatus("Speech recognition not supported in this browser.");
    return;
  }
  wakeDetected = false;
  try {
    rec.start();
  } catch {
    // Sometimes start throws if already started
  }
};

btnStop.onclick = () => {
  if (recognition && listening) {
    recognition.stop();
  }
};

btnClear.onclick = () => {
  liveText.value = "";
  wakeDetected = false;
  btnSave.disabled = true;
  setStatus("Cleared");
  setTimeout(() => setStatus("Idle"), 700);
};

btnSave.onclick = () => {
  const text = liveText.value.trim();
  if (!text) return;

  const notes = loadNotes();
  notes.push({
    id: crypto.randomUUID(),
    text,
    category: categoryEl.value.trim(),
    createdAt: nowISO(),
  });
  saveNotes(notes);

  liveText.value = "";
  wakeDetected = false;
  btnSave.disabled = true;

  renderNotes();
  setStatus("Saved note");
  setTimeout(() => setStatus("Idle"), 900);
};

btnDeleteAll.onclick = () => {
  saveNotes([]);
  renderNotes();
  setStatus("Deleted all notes");
  setTimeout(() => setStatus("Idle"), 900);
};

// Initial render
renderNotes();

// Helpful status message
if (!SpeechRecognition) {
  setStatus("Speech recognition not supported here. Try Chrome/Edge.");
}
