import { upsertGrape, upsertRegion, upsertLabelTip, addCellarEntry, addPalateNote } from "./storage";

export const TOOL_DEFINITIONS = [
  {
    name: "update_grape",
    description: "Add or update a grape variety in the user's grape guide",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Grape variety name" },
        safety: { type: "string", enum: ["always", "sometimes", "avoid"], description: "Safety rating for user's palate" },
        note: { type: "string", description: "Brief note about this grape relevant to user's palate" },
      },
      required: ["name", "safety", "note"],
    },
  },
  {
    name: "update_region",
    description: "Add or update a wine region in the user's region guide",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Region name" },
        tier: { type: "string", enum: ["goldmine", "good", "splurge", "caution", "avoid"], description: "Value tier for user's palate" },
        price: { type: "string", description: "Typical price range" },
        note: { type: "string", description: "Description relevant to user's palate, style, producers, etc." },
        subEntries: {
          type: "array",
          description: "Optional sub-entries for appellations within a region",
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
          description: "Optional vintage guide for this region",
          items: {
            type: "object",
            properties: {
              year: { type: "string" },
              verdict: { type: "string" },
              detail: { type: "string" },
            },
          },
        },
        soils: { type: "string", description: "Optional soil/terroir notes" },
      },
      required: ["name", "tier", "note"],
    },
  },
  {
    name: "update_label_tip",
    description: "Add or update a label reading tip (green flag or red flag)",
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["green", "red"], description: "Green flag (buy signal) or red flag (avoid signal)" },
        flag: { type: "string", description: "The label indicator" },
        detail: { type: "string", description: "Why this matters for user's palate" },
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
];

export function executeToolCall(toolName, toolInput) {
  switch (toolName) {
    case "update_grape":
      upsertGrape(toolInput);
      return { success: true, message: `Added "${toolInput.name}" to Grapes (${toolInput.safety})` };
    case "update_region":
      upsertRegion(toolInput);
      return { success: true, message: `Updated "${toolInput.name}" in Regions (${toolInput.tier})` };
    case "update_label_tip":
      upsertLabelTip(toolInput);
      return { success: true, message: `Added ${toolInput.type} flag: "${toolInput.flag}"` };
    case "log_tasting":
      addCellarEntry(toolInput);
      return { success: true, message: `Logged "${toolInput.wine}" (${toolInput.verdict}${toolInput.rating ? `, ${toolInput.rating}` : ""})` };
    case "update_palate_note":
      addPalateNote(toolInput.note, toolInput.date);
      return { success: true, message: "Palate note recorded" };
    default:
      return { success: false, message: `Unknown tool: ${toolName}` };
  }
}
