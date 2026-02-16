const KEYS = {
  messages: "wine-sommelier-messages",
  tastings: "wine-sommelier-tastings",
  palate: "wine-sommelier-palate",
  lastSync: "wine-sommelier-last-sync",
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

// --- Cloud Sync ---
let syncTimeout = null;

function scheduleCloudSync() {
  // Debounce: wait 2 seconds after last change before syncing
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(() => {
    pushToCloud();
  }, 2000);
}

async function pushToCloud() {
  try {
    const payload = {
      messages: getMessages(),
      tastings: getTastingLog(),
      palate: getPalateNotes(),
    };
    console.log("[sync] pushing to cloud:", payload.messages.length, "msgs,", payload.tastings.length, "tastings,", payload.palate.length, "palate");
    const resp = await fetch("/api/sync-save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      console.warn("[sync] push failed:", resp.status, await resp.text());
      return;
    }
    console.log("[sync] push success");
    setJSON(KEYS.lastSync, new Date().toISOString());
  } catch (err) {
    console.warn("[sync] push error:", err);
  }
}

export async function pullFromCloud() {
  try {
    const resp = await fetch("/api/sync-load");
    if (!resp.ok) {
      console.warn("Cloud sync load failed:", resp.status);
      return false;
    }
    const cloud = await resp.json();
    console.log("[sync] pulled from cloud:", cloud);
    if (!cloud) return false;

    let updated = false;
    const localTastings = getTastingLog();
    const localPalate = getPalateNotes();
    const localMessages = getMessages();

    // Merge tastings - deduplicate by wine+date
    if (cloud.tastings?.length) {
      const existingKeys = new Set(localTastings.map(t => `${t.wine}|${t.date}`));
      const newEntries = cloud.tastings.filter(t => !existingKeys.has(`${t.wine}|${t.date}`));
      if (newEntries.length > 0) {
        setJSON(KEYS.tastings, [...localTastings, ...newEntries]);
        updated = true;
      }
    }

    // Merge palate notes - deduplicate by text+date
    if (cloud.palate?.length) {
      const existingKeys = new Set(localPalate.map(n => `${n.text}|${n.date}`));
      const newNotes = cloud.palate.filter(n => !existingKeys.has(`${n.text}|${n.date}`));
      if (newNotes.length > 0) {
        setJSON(KEYS.palate, [...localPalate, ...newNotes]);
        updated = true;
      }
    }

    // Messages: use cloud if local is empty
    if (localMessages.length === 0 && cloud.messages?.length > 0) {
      setJSON(KEYS.messages, cloud.messages);
      updated = true;
    }

    return updated;
  } catch (err) {
    console.warn("Cloud sync error:", err);
    return false;
  }
}

// --- Messages ---
export function getMessages() {
  return getJSON(KEYS.messages) || [];
}

export function saveMessages(msgs) {
  const capped = msgs.slice(-MAX_MESSAGES);
  setJSON(KEYS.messages, capped);
  scheduleCloudSync();
}

// --- Tasting Log ---
export function getTastingLog() {
  return getJSON(KEYS.tastings) || [];
}

export function addTastingEntry(entry) {
  const log = getTastingLog();
  log.push({ ...entry, date: entry.date || new Date().toISOString().split("T")[0] });
  setJSON(KEYS.tastings, log);
  scheduleCloudSync();
}

// --- Palate Notes ---
export function getPalateNotes() {
  return getJSON(KEYS.palate) || [];
}

export function addPalateNote(note) {
  const notes = getPalateNotes();
  notes.push({ text: note, date: new Date().toISOString().split("T")[0] });
  setJSON(KEYS.palate, notes);
  scheduleCloudSync();
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
  pushToCloud();
}
