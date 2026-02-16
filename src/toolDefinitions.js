import {
  upsertGrape, upsertRegion, upsertLabelTip, addCellarEntry, addPalateNote,
  getGrapes, getRegions, getLabels, getCellar, getPalateNotes,
  deleteGrape, deleteRegion, deleteLabelTip, deleteCellarEntry, deletePalateNote,
} from "./storage";
import { rewriteSection } from "./storage";

export const TOOL_DEFINITIONS = [
  {
    name: "read_section",
    description: "Read all current entries from a section of the app to check what exists before creating or updating. ALWAYS call this before creating a new entry to check for duplicates.",
    input_schema: {
      type: "object",
      properties: {
        section: {
          type: "string",
          enum: ["grapes", "regions", "labels", "cellar", "palateNotes"],
          description: "Which section to read",
        },
      },
      required: ["section"],
    },
  },
  {
    name: "update_grape",
    description: "Update an existing grape entry by name, or create a new one if it doesn't exist. Changes safety rating, expands/replaces note. When updating, include ALL relevant info (old + new) since the note field is REPLACED.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Grape variety name" },
        safety: { type: "string", enum: ["always", "sometimes", "avoid"], description: "Safety rating for user's palate" },
        note: { type: "string", description: "Note about this grape — REPLACES existing, so include all relevant info old + new" },
      },
      required: ["name"],
    },
  },
  {
    name: "update_region",
    description: "Update an existing region entry or create a new one. Expand notes, add vintages, add sub-entries, update soils, change tier. Arrays (subEntries, vintages) are MERGED by name/year — string fields are REPLACED, so include all info.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Region name" },
        tier: { type: "string", enum: ["goldmine", "good", "splurge", "caution", "avoid"], description: "Value tier" },
        price: { type: "string", description: "Typical price range" },
        note: { type: "string", description: "Description — REPLACES existing, include all info" },
        soils: { type: "string", description: "Soil/terroir notes" },
        subEntries: {
          type: "array",
          description: "Sub-entries to ADD or UPDATE (matched by name)",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              note: { type: "string" },
              picks: { type: "string", description: "Specific producers or wines to look for" },
            },
          },
        },
        vintages: {
          type: "array",
          description: "Vintages to ADD or UPDATE (matched by year)",
          items: {
            type: "object",
            properties: {
              year: { type: "string" },
              verdict: { type: "string" },
              detail: { type: "string" },
            },
          },
        },
      },
      required: ["name"],
    },
  },
  {
    name: "update_label_tip",
    description: "Update an existing label tip matched by flag text, or create a new one. When updating, the detail field REPLACES existing, so include all info.",
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["green", "red"], description: "Green flag (buy signal) or red flag (avoid signal)" },
        flag: { type: "string", description: "The label indicator text" },
        detail: { type: "string", description: "Why this matters — REPLACES existing" },
      },
      required: ["type", "flag", "detail"],
    },
  },
  {
    name: "log_tasting",
    description: "Log a wine the user has tried to their cellar/tasting history",
    input_schema: {
      type: "object",
      properties: {
        wine: { type: "string", description: "Full wine name (producer, appellation, vintage)" },
        rating: { type: "string", description: "Letter grade A+ through F" },
        verdict: { type: "string", enum: ["loved", "liked", "neutral", "disliked", "experiment"], description: "Quick verdict" },
        notes: { type: "string", description: "Tasting notes and palate fit assessment" },
        date: { type: "string", description: "Date tried (ISO format)" },
      },
      required: ["wine", "verdict", "notes"],
    },
  },
  {
    name: "update_palate_note",
    description: "Add an observation about how the user's palate is evolving",
    input_schema: {
      type: "object",
      properties: {
        note: { type: "string", description: "Palate evolution observation" },
        date: { type: "string", description: "Date of observation" },
      },
      required: ["note"],
    },
  },
  {
    name: "delete_entry",
    description: "Delete an entry from a section. Use during cleanup to remove duplicates or outdated entries.",
    input_schema: {
      type: "object",
      properties: {
        section: { type: "string", enum: ["grapes", "regions", "labels", "cellar", "palateNotes"], description: "Which section to delete from" },
        identifier: { type: "string", description: "Name/flag text of entry to delete (case-insensitive match)" },
        label_type: { type: "string", enum: ["green", "red"], description: "Required when section is 'labels' to identify which list" },
      },
      required: ["section", "identifier"],
    },
  },
  {
    name: "rewrite_section",
    description: "Replace ALL entries in a section with a clean, consolidated version. Use when the user asks to 'clean up' a section. Read the section first, then rewrite as a single authoritative version with no duplicates, merged insights, and consistent formatting.",
    input_schema: {
      type: "object",
      properties: {
        section: { type: "string", enum: ["grapes", "regions", "labels", "cellar", "palateNotes"], description: "Which section to rewrite" },
        data: {
          type: "array",
          description: "The complete replacement data as an array of entries. For labels, use an array of objects with a 'category' field ('green' or 'red') — the handler will restructure into {green:[], red:[]}.",
          items: { type: "object" },
        },
      },
      required: ["section", "data"],
    },
  },
];

// --- Read section helper ---
function readSection(section) {
  switch (section) {
    case "grapes": return getGrapes();
    case "regions": return getRegions();
    case "labels": return getLabels();
    case "cellar": return getCellar();
    case "palateNotes": return getPalateNotes();
    default: return null;
  }
}

// --- Delete entry helper ---
function deleteEntry(section, identifier, labelType) {
  switch (section) {
    case "grapes":
      deleteGrape(identifier);
      return { success: true, message: `Deleted "${identifier}" from Grapes` };
    case "regions":
      deleteRegion(identifier);
      return { success: true, message: `Deleted "${identifier}" from Regions` };
    case "labels":
      if (!labelType) return { success: false, message: "label_type required for labels section" };
      deleteLabelTip(labelType, identifier);
      return { success: true, message: `Deleted ${labelType} flag: "${identifier}"` };
    case "cellar":
      deleteCellarEntry(identifier);
      return { success: true, message: `Deleted cellar entry "${identifier}"` };
    case "palateNotes": {
      const notes = getPalateNotes();
      const idx = notes.findIndex(n => n.text.toLowerCase().includes(identifier.toLowerCase()));
      if (idx >= 0) {
        deletePalateNote(idx);
        return { success: true, message: `Deleted palate note` };
      }
      return { success: false, message: `Palate note not found matching "${identifier}"` };
    }
    default:
      return { success: false, message: `Unknown section: ${section}` };
  }
}

// --- Merge helper for region updates ---
function mergeRegionUpdate(existing, update) {
  const merged = { ...existing };
  // Replace string fields if provided
  if (update.tier) merged.tier = update.tier;
  if (update.price) merged.price = update.price;
  if (update.note) merged.note = update.note;
  if (update.soils) merged.soils = update.soils;

  // Merge subEntries by name
  if (update.subEntries?.length) {
    const subs = [...(merged.subEntries || [])];
    for (const newSub of update.subEntries) {
      const idx = subs.findIndex(s => s.name.toLowerCase() === newSub.name.toLowerCase());
      if (idx >= 0) subs[idx] = { ...subs[idx], ...newSub };
      else subs.push(newSub);
    }
    merged.subEntries = subs;
  }

  // Merge vintages by year
  if (update.vintages?.length) {
    const vints = [...(merged.vintages || [])];
    for (const newV of update.vintages) {
      const idx = vints.findIndex(v => v.year === newV.year);
      if (idx >= 0) vints[idx] = { ...vints[idx], ...newV };
      else vints.push(newV);
    }
    merged.vintages = vints;
  }

  return merged;
}

export function executeToolCall(toolName, toolInput) {
  switch (toolName) {
    case "read_section": {
      const data = readSection(toolInput.section);
      if (data === null) return { success: false, message: `Unknown section: ${toolInput.section}` };
      return { success: true, data, message: `Read ${toolInput.section}: ${Array.isArray(data) ? data.length : Object.keys(data).length} entries` };
    }
    case "update_grape": {
      // If only name provided (partial update), read existing and merge
      const grapes = getGrapes();
      const existing = grapes.find(g => g.name.toLowerCase() === toolInput.name.toLowerCase());
      const merged = existing
        ? { ...existing, ...toolInput, safety: toolInput.safety || existing.safety, note: toolInput.note || existing.note }
        : { ...toolInput, safety: toolInput.safety || "sometimes", note: toolInput.note || "" };
      upsertGrape(merged);
      return { success: true, message: `Updated "${toolInput.name}" in Grapes (${merged.safety})` };
    }
    case "update_region": {
      // Merge arrays (subEntries, vintages) instead of replacing
      const regions = getRegions();
      const existing = regions.find(r => r.name.toLowerCase() === toolInput.name.toLowerCase());
      if (existing) {
        const merged = mergeRegionUpdate(existing, toolInput);
        upsertRegion(merged);
        return { success: true, message: `Updated "${toolInput.name}" in Regions (${merged.tier})` };
      }
      upsertRegion({ ...toolInput, tier: toolInput.tier || "good", note: toolInput.note || "" });
      return { success: true, message: `Created "${toolInput.name}" in Regions (${toolInput.tier || "good"})` };
    }
    case "update_label_tip":
      upsertLabelTip(toolInput);
      return { success: true, message: `Updated ${toolInput.type} flag: "${toolInput.flag}"` };
    case "log_tasting":
      addCellarEntry(toolInput);
      return { success: true, message: `Logged "${toolInput.wine}" (${toolInput.verdict}${toolInput.rating ? `, ${toolInput.rating}` : ""})` };
    case "update_palate_note":
      addPalateNote(toolInput.note, toolInput.date);
      return { success: true, message: "Palate note recorded" };
    case "delete_entry":
      return deleteEntry(toolInput.section, toolInput.identifier, toolInput.label_type);
    case "rewrite_section": {
      const result = rewriteSection(toolInput.section, toolInput.data);
      return result;
    }
    default:
      return { success: false, message: `Unknown tool: ${toolName}` };
  }
}
