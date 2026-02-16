import { GRAPE_GUIDE, REGIONS, BORDEAUX_GUIDE, LABEL_TIPS, TASTING_HISTORY } from "./palateConfig";

// --- Keys ---
const KEYS = {
  messages: "wine-sommelier:chatHistory",
  grapes: "wine-sommelier:grapes",
  regions: "wine-sommelier:regions",
  labels: "wine-sommelier:labels",
  cellar: "wine-sommelier:cellar",
  palateNotes: "wine-sommelier:palateNotes",
  lastSync: "wine-sommelier:lastSync",
  migrated: "wine-sommelier:v2-migrated",
};

const OLD_KEYS = {
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

// --- Rating conversion (X/10 → letter grade) ---
function ratingToGrade(rating) {
  if (!rating) return null;
  // If already a letter grade, return as-is
  if (/^[A-F][+-]?$/i.test(String(rating).trim())) return String(rating).trim().toUpperCase();
  const num = parseFloat(String(rating).replace("/10", ""));
  if (isNaN(num)) return null;
  if (num >= 9.5) return "A+";
  if (num >= 9) return "A+";
  if (num >= 8.5) return "A";
  if (num >= 8) return "A-";
  if (num >= 7.5) return "B+";
  if (num >= 7) return "B";
  if (num >= 6.5) return "B-";
  if (num >= 6) return "C+";
  if (num >= 5.5) return "C";
  if (num >= 5) return "C-";
  if (num >= 4) return "D";
  return "F";
}

// --- V2 Migration ---
export function migrateToV2() {
  if (getJSON(KEYS.migrated)) return;

  // 1. Copy old messages
  const oldMessages = getJSON(OLD_KEYS.messages);
  if (oldMessages?.length > 0 && !getJSON(KEYS.messages)) {
    setJSON(KEYS.messages, oldMessages);
  }

  // 2. Copy old palate notes
  const oldPalate = getJSON(OLD_KEYS.palate);
  if (oldPalate?.length > 0) {
    const migrated = oldPalate.map(n => ({ ...n, source: "static" }));
    setJSON(KEYS.palateNotes, migrated);
  }

  // 3. Seed grapes from static config
  const grapes = GRAPE_GUIDE.map(g => ({ ...g, source: "static" }));
  setJSON(KEYS.grapes, grapes);

  // 4. Seed regions from static config + transform Bordeaux
  const regions = REGIONS.map(r => ({ ...r, source: "static" }));

  // Transform BORDEAUX_GUIDE into a rich region entry
  const bordeauxEntry = {
    name: "Bordeaux Left Bank",
    tier: "splurge",
    price: "$25-60+",
    note: "Cabernet Sauvignon on gravel. LEFT BANK ONLY. Perfume, structure, lift. Avoid Right Bank entirely (" + BORDEAUX_GUIDE.avoid.join(", ") + " — too dense).",
    soils: "Gravel over clay/limestone. Finer gravel = more elegance (Margaux). More clay = more weight (Saint-Estèphe).",
    subEntries: BORDEAUX_GUIDE.priority.map(a => ({
      name: a.name,
      rank: a.rank,
      note: a.personality,
      picks: a.picks,
    })),
    vintages: BORDEAUX_GUIDE.vintages.map(v => ({ ...v })),
    source: "static",
  };
  regions.push(bordeauxEntry);
  setJSON(KEYS.regions, regions);

  // 5. Seed labels from static config
  const labels = {
    green: LABEL_TIPS.green.map(t => ({ ...t, source: "static" })),
    red: LABEL_TIPS.red.map(t => ({ ...t, source: "static" })),
  };
  setJSON(KEYS.labels, labels);

  // 6. Seed cellar from static tasting history + old stored tastings
  const cellarEntries = TASTING_HISTORY.map((t, i) => ({
    wine: t.wine,
    rating: t.rating ? ratingToGrade(t.rating) : null,
    verdict: t.verdict || "neutral",
    notes: t.notes,
    date: t.date || "2026-02-13",
    source: "static",
    id: `static-${i}`,
  }));

  // Merge with any old stored tastings
  const oldTastings = getJSON(OLD_KEYS.tastings) || [];
  const existingWines = new Set(cellarEntries.map(e => e.wine.toLowerCase()));
  for (const t of oldTastings) {
    if (!existingWines.has(t.wine?.toLowerCase())) {
      cellarEntries.push({
        wine: t.wine,
        rating: ratingToGrade(t.rating),
        verdict: t.verdict || "neutral",
        notes: t.notes,
        date: t.date,
        source: "static",
        id: `migrated-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      });
    }
  }
  setJSON(KEYS.cellar, cellarEntries);

  // 7. Set flag + clean up old keys
  setJSON(KEYS.migrated, true);
  Object.values(OLD_KEYS).forEach(k => localStorage.removeItem(k));
}

// --- Cloud Sync ---
let syncTimeout = null;

function scheduleCloudSync() {
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(() => {
    pushToCloud();
  }, 2000);
}

async function pushToCloud() {
  try {
    const payload = {
      chatHistory: getMessages(),
      grapes: getGrapes(),
      regions: getRegions(),
      labels: getLabels(),
      cellar: getCellar(),
      palateNotes: getPalateNotes(),
    };
    console.log("[sync] pushing to cloud:", payload.chatHistory.length, "msgs,", payload.cellar.length, "cellar,", payload.grapes.length, "grapes");
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

// --- Merge helpers ---
function mergeByName(local, cloud) {
  const map = new Map(local.map(item => [item.name.toLowerCase(), item]));
  for (const item of cloud) {
    const key = item.name.toLowerCase();
    const existing = map.get(key);
    if (!existing || (item.updatedAt && (!existing.updatedAt || item.updatedAt > existing.updatedAt))) {
      map.set(key, item);
    }
  }
  return Array.from(map.values());
}

function mergeByField(local, cloud, field) {
  const map = new Map(local.map(item => [item[field]?.toLowerCase(), item]));
  for (const item of cloud) {
    const key = item[field]?.toLowerCase();
    const existing = map.get(key);
    if (!existing || (item.updatedAt && (!existing.updatedAt || item.updatedAt > existing.updatedAt))) {
      map.set(key, item);
    }
  }
  return Array.from(map.values());
}

export async function pullFromCloud() {
  try {
    const resp = await fetch("/api/sync-load");
    if (!resp.ok) {
      console.warn("[sync] pull failed:", resp.status);
      return false;
    }
    const cloud = await resp.json();
    console.log("[sync] pulled from cloud:", cloud);
    if (!cloud) return false;

    let updated = false;

    // Merge grapes
    if (cloud.grapes?.length) {
      const local = getGrapes();
      const merged = mergeByName(local, cloud.grapes);
      if (merged.length > local.length || JSON.stringify(merged) !== JSON.stringify(local)) {
        setJSON(KEYS.grapes, merged);
        updated = true;
      }
    }

    // Merge regions
    if (cloud.regions?.length) {
      const local = getRegions();
      const merged = mergeByName(local, cloud.regions);
      if (merged.length > local.length || JSON.stringify(merged) !== JSON.stringify(local)) {
        setJSON(KEYS.regions, merged);
        updated = true;
      }
    }

    // Merge labels
    if (cloud.labels) {
      const local = getLabels();
      let labelsUpdated = false;
      if (cloud.labels.green?.length) {
        const merged = mergeByField(local.green, cloud.labels.green, "flag");
        if (merged.length > local.green.length) { local.green = merged; labelsUpdated = true; }
      }
      if (cloud.labels.red?.length) {
        const merged = mergeByField(local.red, cloud.labels.red, "flag");
        if (merged.length > local.red.length) { local.red = merged; labelsUpdated = true; }
      }
      if (labelsUpdated) {
        setJSON(KEYS.labels, local);
        updated = true;
      }
    }

    // Merge cellar - deduplicate by id or wine+date
    if (cloud.cellar?.length) {
      const local = getCellar();
      const existingIds = new Set(local.map(t => t.id).filter(Boolean));
      const existingWineDates = new Set(local.map(t => `${t.wine}|${t.date}`));
      const newEntries = cloud.cellar.filter(t =>
        !existingIds.has(t.id) && !existingWineDates.has(`${t.wine}|${t.date}`)
      );
      if (newEntries.length > 0) {
        setJSON(KEYS.cellar, [...local, ...newEntries]);
        updated = true;
      }
    }

    // Merge palate notes - deduplicate by text+date
    if (cloud.palateNotes?.length) {
      const local = getPalateNotes();
      const existingKeys = new Set(local.map(n => `${n.text}|${n.date}`));
      const newNotes = cloud.palateNotes.filter(n => !existingKeys.has(`${n.text}|${n.date}`));
      if (newNotes.length > 0) {
        setJSON(KEYS.palateNotes, [...local, ...newNotes]);
        updated = true;
      }
    }

    // Messages: use cloud if cloud has more
    const localMessages = getMessages();
    const cloudMessages = cloud.chatHistory || cloud.messages || [];
    if (cloudMessages.length > localMessages.length) {
      setJSON(KEYS.messages, cloudMessages);
      updated = true;
    }

    // Push local data back up so all devices share
    const localAfter = {
      chatHistory: getMessages(),
      grapes: getGrapes(),
      cellar: getCellar(),
    };
    if (localAfter.chatHistory.length > 0 || localAfter.grapes.length > 0 || localAfter.cellar.length > 0) {
      await pushToCloud();
    }

    return updated;
  } catch (err) {
    console.warn("[sync] error:", err);
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

// --- Grapes ---
export function getGrapes() {
  return getJSON(KEYS.grapes) || [];
}

export function upsertGrape(grape) {
  const grapes = getGrapes();
  const idx = grapes.findIndex(g => g.name.toLowerCase() === grape.name.toLowerCase());
  const entry = { ...grape, source: grape.source || "chat", updatedAt: new Date().toISOString() };
  if (idx >= 0) grapes[idx] = { ...grapes[idx], ...entry };
  else grapes.push(entry);
  setJSON(KEYS.grapes, grapes);
  scheduleCloudSync();
  return entry;
}

export function deleteGrape(name) {
  const grapes = getGrapes().filter(g => g.name.toLowerCase() !== name.toLowerCase());
  setJSON(KEYS.grapes, grapes);
  scheduleCloudSync();
}

// --- Regions ---
export function getRegions() {
  return getJSON(KEYS.regions) || [];
}

export function upsertRegion(region) {
  const regions = getRegions();
  const idx = regions.findIndex(r => r.name.toLowerCase() === region.name.toLowerCase());
  const entry = { ...region, source: region.source || "chat", updatedAt: new Date().toISOString() };
  if (idx >= 0) regions[idx] = { ...regions[idx], ...entry };
  else regions.push(entry);
  setJSON(KEYS.regions, regions);
  scheduleCloudSync();
  return entry;
}

export function deleteRegion(name) {
  const regions = getRegions().filter(r => r.name.toLowerCase() !== name.toLowerCase());
  setJSON(KEYS.regions, regions);
  scheduleCloudSync();
}

// --- Labels ---
export function getLabels() {
  return getJSON(KEYS.labels) || { green: [], red: [] };
}

export function upsertLabelTip(tip) {
  const labels = getLabels();
  const arr = labels[tip.type];
  if (!arr) return null;
  const idx = arr.findIndex(t => t.flag.toLowerCase() === tip.flag.toLowerCase());
  const entry = { flag: tip.flag, detail: tip.detail, source: tip.source || "chat", updatedAt: new Date().toISOString() };
  if (idx >= 0) arr[idx] = { ...arr[idx], ...entry };
  else arr.push(entry);
  setJSON(KEYS.labels, labels);
  scheduleCloudSync();
  return entry;
}

export function deleteLabelTip(type, flag) {
  const labels = getLabels();
  if (!labels[type]) return;
  labels[type] = labels[type].filter(t => t.flag.toLowerCase() !== flag.toLowerCase());
  setJSON(KEYS.labels, labels);
  scheduleCloudSync();
}

// --- Cellar ---
export function getCellar() {
  return getJSON(KEYS.cellar) || [];
}

export function addCellarEntry(entry) {
  const log = getCellar();
  log.push({
    ...entry,
    date: entry.date || new Date().toISOString().split("T")[0],
    source: entry.source || "chat",
    id: entry.id || Date.now().toString(),
  });
  setJSON(KEYS.cellar, log);
  scheduleCloudSync();
  return entry;
}

export function updateCellarEntry(id, updates) {
  const log = getCellar();
  const idx = log.findIndex(t => t.id === id);
  if (idx >= 0) {
    log[idx] = { ...log[idx], ...updates, updatedAt: new Date().toISOString() };
    setJSON(KEYS.cellar, log);
    scheduleCloudSync();
  }
}

export function deleteCellarEntry(id) {
  const log = getCellar().filter(t => t.id !== id);
  setJSON(KEYS.cellar, log);
  scheduleCloudSync();
}

// --- Palate Notes ---
export function getPalateNotes() {
  return getJSON(KEYS.palateNotes) || [];
}

export function addPalateNote(note, date) {
  const notes = getPalateNotes();
  notes.push({
    text: typeof note === "string" ? note : note.text || note,
    date: date || new Date().toISOString().split("T")[0],
    source: "chat",
  });
  setJSON(KEYS.palateNotes, notes);
  scheduleCloudSync();
  return { text: note, date };
}

export function deletePalateNote(index) {
  const notes = getPalateNotes();
  if (index >= 0 && index < notes.length) {
    notes.splice(index, 1);
    setJSON(KEYS.palateNotes, notes);
    scheduleCloudSync();
  }
}

// --- Rewrite Section (full replacement) ---
export function rewriteSection(section, data) {
  const keyMap = {
    grapes: KEYS.grapes,
    regions: KEYS.regions,
    labels: KEYS.labels,
    cellar: KEYS.cellar,
    palateNotes: KEYS.palateNotes,
  };
  const key = keyMap[section];
  if (!key) return { success: false, message: `Unknown section: ${section}` };

  setJSON(key, data);
  scheduleCloudSync();

  const count = Array.isArray(data) ? data.length : (data.green?.length || 0) + (data.red?.length || 0);
  return { success: true, message: `Rewrote ${section}: now ${count} entries` };
}

// --- Export / Clear ---
export function exportAllData() {
  return {
    grapes: getGrapes(),
    regions: getRegions(),
    labels: getLabels(),
    cellar: getCellar(),
    palateNotes: getPalateNotes(),
    chatHistory: getMessages(),
    exportedAt: new Date().toISOString(),
  };
}

export function clearAllData() {
  Object.values(KEYS).forEach(k => localStorage.removeItem(k));
  pushToCloud();
}
