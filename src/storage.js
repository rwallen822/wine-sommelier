const KEYS = {
  messages: "wine-sommelier-messages",
  tastings: "wine-sommelier-tastings",
  palate: "wine-sommelier-palate",
};

const MAX_MESSAGES = 100;

function getJSON(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function setJSON(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

// --- Messages ---
export function getMessages() {
  return getJSON(KEYS.messages) || [];
}

export function saveMessages(msgs) {
  const capped = msgs.slice(-MAX_MESSAGES);
  setJSON(KEYS.messages, capped);
}

// --- Tasting Log ---
export function getTastingLog() {
  return getJSON(KEYS.tastings) || [];
}

export function addTastingEntry(entry) {
  const log = getTastingLog();
  log.push({ ...entry, date: entry.date || new Date().toISOString().split("T")[0] });
  setJSON(KEYS.tastings, log);
}

// --- Palate Notes ---
export function getPalateNotes() {
  return getJSON(KEYS.palate) || [];
}

export function addPalateNote(note) {
  const notes = getPalateNotes();
  notes.push({ text: note, date: new Date().toISOString().split("T")[0] });
  setJSON(KEYS.palate, notes);
}

// --- Export / Clear ---
export function exportAllData() {
  return {
    messages: getMessages(),
    tastings: getTastingLog(),
    palateNotes: getPalateNotes(),
    exportedAt: new Date().toISOString(),
  };
}

export function clearAllData() {
  Object.values(KEYS).forEach(k => localStorage.removeItem(k));
}
