import { useState, useEffect, useCallback } from "react";
import { C } from "./theme";
import { PALATE_CORE } from "./palateConfig";
import ChatTab from "./ChatTab";
import {
  getGrapes, upsertGrape, deleteGrape,
  getRegions, upsertRegion, deleteRegion,
  getLabels, upsertLabelTip, deleteLabelTip,
  getCellar, addCellarEntry, updateCellarEntry, deleteCellarEntry,
  getPalateNotes, deletePalateNote,
  getHuntList, removeHuntListEntry,
  exportAllData, pullFromCloud, migrateToV2, migrateLabelsV2,
} from "./storage";
import {
  MessageCircle, Grape, Globe, Tag, Wine,
  X, Pencil, Plus, Search, ExternalLink, Target, Download,
} from "lucide-react";
import { GrapeLeaf, GrapeCluster, VineTendril, WineBottle, WineGlassArt, VineDivider } from "./WineArt";

// --- Shared styles ---
const inputStyle = {
  background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8,
  padding: "10px 12px", fontSize: 13, color: C.text, width: "100%",
  fontFamily: "'Nunito Sans', sans-serif", outline: "none",
};
const selectStyle = { ...inputStyle, appearance: "auto" };
const textareaStyle = { ...inputStyle, resize: "vertical", minHeight: 50 };
const btnSave = {
  padding: "8px 18px", borderRadius: 6, fontSize: 13, fontWeight: 600,
  background: C.accent, color: "#fff", border: "none", cursor: "pointer",
};
const btnCancel = {
  padding: "8px 18px", borderRadius: 6, fontSize: 13, fontWeight: 500,
  background: C.card, color: C.textDim, border: `1px solid ${C.border}`, cursor: "pointer",
};
const btnDanger = {
  padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
  background: C.red, color: "#fff", border: "none", cursor: "pointer",
};
const btnSmall = {
  padding: "3px 8px", borderRadius: 4, fontSize: 11, fontWeight: 500,
  background: "transparent", border: `1px solid ${C.border}`, cursor: "pointer", color: C.textDim,
  display: "flex", alignItems: "center", justifyContent: "center",
};
const formRow = { marginBottom: 8 };
const formLabel = { fontSize: 11, fontWeight: 600, color: C.textDim, marginBottom: 3, display: "block" };
const cardBase = {
  padding: "14px 16px", marginBottom: 8, background: C.card, borderRadius: 12,
  border: `1px solid ${C.border}`, boxShadow: C.cardShadow,
};

function getWineLinks(wineName) {
  const encoded = encodeURIComponent(wineName);
  return {
    wineSearcher: `https://www.wine-searcher.com/find/${encoded}`,
    vivino: `https://www.vivino.com/search/wines?q=${encoded}`,
  };
}

function App() {
  const validTabs = ["chat", "grapes", "regions", "labels", "cellar"];
  const urlTab = new URLSearchParams(window.location.search).get("tab");
  const [tab, setTab] = useState(validTabs.includes(urlTab) ? urlTab : "chat");
  const [expandedRegion, setExpandedRegion] = useState(null);
  const [cellarView, setCellarView] = useState("cellar");
  const [cellarSort, setCellarSort] = useState("date");
  const [verdictFilter, setVerdictFilter] = useState(null);
  const [expandedCellarId, setExpandedCellarId] = useState(null);
  const [syncKey, setSyncKey] = useState(0);
  const [dataVersion, setDataVersion] = useState(0);

  // CRUD state
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    migrateToV2();
    migrateLabelsV2();
    pullFromCloud().then((updated) => {
      if (updated) setSyncKey(k => k + 1);
    });
  }, []);

  const onDataUpdated = useCallback(() => setDataVersion(v => v + 1), []);
  const bump = () => setDataVersion(v => v + 1);

  const cancelEdit = () => { setEditing(null); setAdding(null); setConfirmDelete(null); };

  const tabs = [
    { id: "chat", label: "Chat", Icon: MessageCircle },
    { id: "grapes", label: "Grapes", Icon: Grape },
    { id: "regions", label: "Regions", Icon: Globe },
    { id: "labels", label: "Labels", Icon: Tag },
    { id: "cellar", label: "Cellar", Icon: Wine },
  ];

  const selectTab = (id) => {
    setTab(id);
    const url = new URL(window.location); url.searchParams.set("tab", id); window.history.replaceState({}, "", url);
    cancelEdit();
    if (id !== "chat") window.scrollTo(0, 0);
  };

  const safetyColor = (s) => s === "always" ? C.green : s === "sometimes" ? C.yellow : C.red;
  const safetyBg = (s) => s === "always" ? C.greenBg : s === "sometimes" ? C.yellowBg : C.redBg;

  const tierColor = (t) => {
    switch (t) {
      case "goldmine": return C.green;
      case "good": return C.greenLight;
      case "splurge": return C.iceBlue;
      case "caution": return C.red;
      case "avoid": return C.red;
      default: return C.textDim;
    }
  };
  const tierLabel = (t) => {
    switch (t) {
      case "goldmine": return "SAFE BET";
      case "good": return "GOOD BET";
      case "splurge": return "SPLURGE";
      case "caution": return "CAUTION";
      case "avoid": return "AVOID";
      default: return t?.toUpperCase();
    }
  };

  const verdictColor = (v) => {
    switch (v) {
      case "loved": return C.green;
      case "liked": return C.yellow;
      case "neutral": return C.textDim;
      case "disliked": return C.red;
      case "experiment": return C.accent;
      default: return C.textDim;
    }
  };

  const gradeOrder = { "A+": 13, "A": 12, "A-": 11, "B+": 10, "B": 9, "B-": 8, "C+": 7, "C": 6, "C-": 5, "D+": 4, "D": 3, "D-": 2, "F": 1 };
  const gradeOptions = ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "D-", "F"];

  const priorityColor = (p) => {
    switch (p) {
      case "must-buy": return C.green;
      case "try-if-you-see-it": return C.yellow;
      case "worth-exploring": return C.red;
      default: return C.textDim;
    }
  };
  const priorityLabel = (p) => {
    switch (p) {
      case "must-buy": return "Must Buy";
      case "try-if-you-see-it": return "Try If You See It";
      case "worth-exploring": return "Worth Exploring";
      default: return p || "No Priority";
    }
  };
  const priorityOrder = { "must-buy": 0, "try-if-you-see-it": 1, "worth-exploring": 2 };

  const linkStyle = {
    fontSize: 11, padding: "3px 8px", borderRadius: 4, background: C.bg,
    border: `1px solid ${C.border}`, color: C.textDim, textDecoration: "none",
    fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 3,
  };

  const WineLinks = ({ wineName, producerUrl }) => {
    const links = getWineLinks(wineName);
    return (
      <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
        <a href={links.wineSearcher} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={linkStyle}>
          <Search size={12} strokeWidth={2} /> Wine-Searcher
        </a>
        <a href={links.vivino} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={linkStyle}>
          <Wine size={12} strokeWidth={2} /> Vivino
        </a>
        {producerUrl && (
          <a href={producerUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={linkStyle}>
            <ExternalLink size={12} strokeWidth={2} /> Producer
          </a>
        )}
      </div>
    );
  };

  const handleExport = () => {
    const data = exportAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wine-cellar-backup-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const chatBadge = (source) => source === "chat" ? (
    <span style={{ fontSize: 9, color: C.accent, background: C.accentGlow, padding: "2px 6px", borderRadius: 4, fontWeight: 600 }}>from chat</span>
  ) : null;

  // --- Edit/Delete action buttons for a card ---
  const cardActions = (deleteKey, onEdit) => (
    <div style={{ display: "flex", gap: 4, marginLeft: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
      <button onClick={onEdit} style={btnSmall} title="Edit"><Pencil size={14} strokeWidth={1.8} /></button>
      {confirmDelete === deleteKey ? (
        <button onClick={() => { setConfirmDelete(null); }} style={btnDanger}>Confirm?</button>
      ) : (
        <button onClick={() => setConfirmDelete(deleteKey)} style={{ ...btnSmall, color: C.red }} title="Delete"><X size={14} strokeWidth={1.8} /></button>
      )}
    </div>
  );

  const isConfirming = (key) => confirmDelete === key;

  // --- Add button ---
  const addButton = (label, onClick) => (
    <button onClick={onClick} style={{
      padding: "10px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600,
      background: C.card, color: C.accent, border: `1px dashed ${C.accent}`,
      cursor: "pointer", width: "100%", marginBottom: 14, textAlign: "center",
      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
      boxShadow: C.cardShadow,
    }}><Plus size={16} strokeWidth={2} /> {label}</button>
  );

  // --- Grape Form ---
  const GrapeForm = ({ initial, onSave, onCancel }) => {
    const [name, setName] = useState(initial?.name || "");
    const [safety, setSafety] = useState(initial?.safety || "always");
    const [note, setNote] = useState(initial?.note || "");
    return (
      <div style={{ padding: 12, background: C.card, borderRadius: 8, border: `1px solid ${C.accent}`, marginBottom: 8 }}>
        <div style={formRow}><label style={formLabel}>Name</label><input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="Grape variety" /></div>
        <div style={formRow}><label style={formLabel}>Safety</label>
          <select style={selectStyle} value={safety} onChange={e => setSafety(e.target.value)}>
            <option value="always">Always Safe</option><option value="sometimes">Sometimes</option><option value="avoid">Avoid</option>
          </select>
        </div>
        <div style={formRow}><label style={formLabel}>Note</label><textarea style={textareaStyle} value={note} onChange={e => setNote(e.target.value)} placeholder="Tasting notes, regions, style..." /></div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button style={btnCancel} onClick={onCancel}>Cancel</button>
          <button style={btnSave} onClick={() => { if (name.trim()) onSave({ name: name.trim(), safety, note: note.trim() }); }}>Save</button>
        </div>
      </div>
    );
  };

  // --- Label Form ---
  const LabelForm = ({ initial, onSave, onCancel }) => {
    const [flag, setFlag] = useState(initial?.flag || "");
    const [detail, setDetail] = useState(initial?.detail || "");
    return (
      <div style={{ padding: 12, background: C.card, borderRadius: 8, border: `1px solid ${C.accent}`, marginBottom: 8 }}>
        <div style={formRow}><label style={formLabel}>Flag</label><input style={inputStyle} value={flag} onChange={e => setFlag(e.target.value)} placeholder="Label indicator" /></div>
        <div style={formRow}><label style={formLabel}>Detail</label><textarea style={textareaStyle} value={detail} onChange={e => setDetail(e.target.value)} placeholder="Why this matters..." /></div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button style={btnCancel} onClick={onCancel}>Cancel</button>
          <button style={btnSave} onClick={() => { if (flag.trim()) onSave({ flag: flag.trim(), detail: detail.trim() }); }}>Save</button>
        </div>
      </div>
    );
  };

  // --- Region Form ---
  const RegionForm = ({ initial, onSave, onCancel }) => {
    const [name, setName] = useState(initial?.name || "");
    const [tier, setTier] = useState(initial?.tier || "goldmine");
    const [price, setPrice] = useState(initial?.price || "");
    const [note, setNote] = useState(initial?.note || "");
    const [soils, setSoils] = useState(initial?.soils || "");
    const [subs, setSubs] = useState(initial?.subEntries || []);
    const [vintages, setVintages] = useState(initial?.vintages || []);

    const addSub = () => setSubs([...subs, { name: "", note: "", picks: "" }]);
    const updateSub = (i, field, val) => { const n = [...subs]; n[i] = { ...n[i], [field]: val }; setSubs(n); };
    const removeSub = (i) => setSubs(subs.filter((_, idx) => idx !== i));

    const addVintage = () => setVintages([...vintages, { year: "", verdict: "", detail: "" }]);
    const updateVintage = (i, field, val) => { const n = [...vintages]; n[i] = { ...n[i], [field]: val }; setVintages(n); };
    const removeVintage = (i) => setVintages(vintages.filter((_, idx) => idx !== i));

    const handleSave = () => {
      if (!name.trim()) return;
      const region = { name: name.trim(), tier, note: note.trim() };
      if (price.trim()) region.price = price.trim();
      if (soils.trim()) region.soils = soils.trim();
      const validSubs = subs.filter(s => s.name.trim());
      if (validSubs.length) region.subEntries = validSubs.map((s, i) => ({ ...s, rank: s.rank || i + 1 }));
      const validVintages = vintages.filter(v => v.year.trim());
      if (validVintages.length) region.vintages = validVintages;
      onSave(region);
    };

    return (
      <div style={{ padding: 12, background: C.card, borderRadius: 8, border: `1px solid ${C.accent}`, marginBottom: 8 }}>
        <div style={formRow}><label style={formLabel}>Name</label><input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="Region name" /></div>
        <div style={{ display: "flex", gap: 8, ...formRow }}>
          <div style={{ flex: 1 }}><label style={formLabel}>Tier</label>
            <select style={selectStyle} value={tier} onChange={e => setTier(e.target.value)}>
              <option value="goldmine">Safe Bet</option><option value="good">Good</option><option value="splurge">Splurge</option><option value="caution">Caution</option><option value="avoid">Avoid</option>
            </select>
          </div>
          <div style={{ flex: 1 }}><label style={formLabel}>Price</label><input style={inputStyle} value={price} onChange={e => setPrice(e.target.value)} placeholder="$15-25" /></div>
        </div>
        <div style={formRow}><label style={formLabel}>Note</label><textarea style={textareaStyle} value={note} onChange={e => setNote(e.target.value)} placeholder="Description, style, producers..." /></div>
        <div style={formRow}><label style={formLabel}>Soils / Terroir</label><textarea style={{ ...textareaStyle, minHeight: 36 }} value={soils} onChange={e => setSoils(e.target.value)} placeholder="Optional terroir notes" /></div>

        {/* Sub-entries */}
        <div style={{ marginTop: 8, marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <label style={{ ...formLabel, marginBottom: 0 }}>Appellations</label>
            <button onClick={addSub} style={{ ...btnSmall, color: C.accent, borderColor: C.accent, gap: 3 }}><Plus size={12} strokeWidth={2} /> Add</button>
          </div>
          {subs.map((s, i) => (
            <div key={i} style={{ padding: 8, background: C.bg, borderRadius: 6, marginBottom: 4, border: `1px solid ${C.border}` }}>
              <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
                <input style={{ ...inputStyle, flex: 1 }} value={s.name} onChange={e => updateSub(i, "name", e.target.value)} placeholder="Appellation name" />
                <button onClick={() => removeSub(i)} style={{ ...btnSmall, color: C.red }}><X size={14} strokeWidth={1.8} /></button>
              </div>
              <input style={{ ...inputStyle, marginBottom: 4 }} value={s.note} onChange={e => updateSub(i, "note", e.target.value)} placeholder="Note" />
              <input style={inputStyle} value={s.picks} onChange={e => updateSub(i, "picks", e.target.value)} placeholder="Producers to look for" />
            </div>
          ))}
        </div>

        {/* Vintages */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <label style={{ ...formLabel, marginBottom: 0 }}>Vintages</label>
            <button onClick={addVintage} style={{ ...btnSmall, color: C.accent, borderColor: C.accent, gap: 3 }}><Plus size={12} strokeWidth={2} /> Add</button>
          </div>
          {vintages.map((v, i) => (
            <div key={i} style={{ padding: 8, background: C.bg, borderRadius: 6, marginBottom: 4, border: `1px solid ${C.border}`, display: "flex", gap: 6, alignItems: "flex-start" }}>
              <input style={{ ...inputStyle, width: 60 }} value={v.year} onChange={e => updateVintage(i, "year", e.target.value)} placeholder="Year" />
              <input style={{ ...inputStyle, width: 90 }} value={v.verdict} onChange={e => updateVintage(i, "verdict", e.target.value)} placeholder="Verdict" />
              <input style={{ ...inputStyle, flex: 1 }} value={v.detail} onChange={e => updateVintage(i, "detail", e.target.value)} placeholder="Detail" />
              <button onClick={() => removeVintage(i)} style={{ ...btnSmall, color: C.red }}><X size={14} strokeWidth={1.8} /></button>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button style={btnCancel} onClick={onCancel}>Cancel</button>
          <button style={btnSave} onClick={handleSave}>Save</button>
        </div>
      </div>
    );
  };

  // --- Cellar Form ---
  const CellarForm = ({ initial, onSave, onCancel }) => {
    const [wine, setWine] = useState(initial?.wine || "");
    const [rating, setRating] = useState(initial?.rating || "");
    const [verdict, setVerdict] = useState(initial?.verdict || "liked");
    const [notes, setNotes] = useState(initial?.notes || "");
    const [date, setDate] = useState(initial?.date || new Date().toISOString().split("T")[0]);
    return (
      <div style={{ padding: 12, background: C.card, borderRadius: 8, border: `1px solid ${C.accent}`, marginBottom: 8 }}>
        <div style={formRow}><label style={formLabel}>Wine</label><input style={inputStyle} value={wine} onChange={e => setWine(e.target.value)} placeholder="Producer, appellation, vintage" /></div>
        <div style={{ display: "flex", gap: 8, ...formRow }}>
          <div style={{ flex: 1 }}><label style={formLabel}>Rating</label>
            <select style={selectStyle} value={rating} onChange={e => setRating(e.target.value)}>
              <option value="">No rating</option>
              {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}><label style={formLabel}>Verdict</label>
            <select style={selectStyle} value={verdict} onChange={e => setVerdict(e.target.value)}>
              <option value="loved">Loved</option><option value="liked">Liked</option><option value="neutral">Neutral</option><option value="disliked">Disliked</option><option value="experiment">Experiment</option>
            </select>
          </div>
        </div>
        <div style={formRow}><label style={formLabel}>Date</label><input style={inputStyle} type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
        <div style={formRow}><label style={formLabel}>Notes</label><textarea style={textareaStyle} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Tasting notes..." /></div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button style={btnCancel} onClick={onCancel}>Cancel</button>
          <button style={btnSave} onClick={() => { if (wine.trim()) onSave({ wine: wine.trim(), rating: rating || null, verdict, notes: notes.trim(), date }); }}>Save</button>
        </div>
      </div>
    );
  };

  return (
    <div style={{ background: C.bg, minHeight: "100vh", maxWidth: 480, margin: "0 auto", fontFamily: "'Nunito Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", color: C.text, position: "relative", paddingBottom: 72 }}>
      <link href="https://fonts.googleapis.com/css2?family=Nunito+Sans:wght@400;500;600;700&family=Raleway:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ padding: "16px 16px 12px", background: C.accentGradient, position: "sticky", top: 0, zIndex: 50, overflow: "hidden" }}>
        <GrapeLeaf size={90} color="#fff" opacity={0.08} style={{ position: "absolute", right: -10, top: -15, transform: "rotate(25deg)" }} />
        <VineTendril width={150} color="#fff" opacity={0.06} style={{ position: "absolute", left: -20, bottom: -5 }} />
        <div style={{ fontSize: 26, fontWeight: 700, color: "#FFFFFF", lineHeight: 1.1, position: "relative", fontFamily: "'Raleway', 'Nunito Sans', sans-serif", letterSpacing: -0.5 }}>Wine Guide</div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: 3, position: "relative", letterSpacing: 2, textTransform: "uppercase", fontWeight: 500 }}>Your personal sommelier</div>
      </div>

      {/* Chat Tab - always mounted to preserve state */}
      <div style={{ padding: "8px 16px 0", display: tab === "chat" ? "block" : "none" }}>
        <ChatTab syncKey={syncKey} onDataUpdated={onDataUpdated} />
      </div>

      {/* Other Content */}
      <div style={{ padding: "16px 16px 0", display: tab !== "chat" ? "block" : "none" }}>

        {/* ===== GRAPES TAB ===== */}
        {tab === "grapes" && (() => {
          const grapes = getGrapes();
          const isAdding = adding?.tab === "grapes";
          return (
            <div>
              <div style={{ fontSize: 10, letterSpacing: 4, color: C.textDim, textTransform: "uppercase", marginBottom: 16, fontWeight: 700 }}>Grape Variety Guide</div>

              {isAdding ? (
                <GrapeForm onCancel={cancelEdit} onSave={(data) => { upsertGrape(data); setAdding(null); bump(); }} />
              ) : (
                addButton("Add Grape", () => { cancelEdit(); setAdding({ tab: "grapes" }); })
              )}

              {["always", "sometimes", "avoid"].map((safety, safetyIdx) => {
                const filtered = grapes.filter(g => g.safety === safety);
                if (filtered.length === 0) return null;
                return (
                  <div key={safety} style={{ marginBottom: 20 }}>
                    {safetyIdx > 0 && <VineDivider color={C.accent} opacity={0.12} style={{ margin: "18px 0 14px" }} />}
                    <div style={{ fontSize: 12, fontWeight: 600, color: safetyColor(safety), marginBottom: 8, letterSpacing: 1, textTransform: "uppercase" }}>
                      {safety === "always" ? "Always Safe" : safety === "sometimes" ? "Winemaking Dependent" : "Avoid"}
                    </div>
                    {filtered.map(g => {
                      const editKey = `grape:${g.name}`;
                      const isEditing = editing?.tab === "grapes" && editing?.id === g.name;

                      if (isEditing) {
                        return <GrapeForm key={g.name} initial={editing.data} onCancel={cancelEdit} onSave={(data) => { upsertGrape(data); cancelEdit(); bump(); }} />;
                      }

                      return (
                        <div key={g.name} style={{ ...cardBase, background: safetyBg(g.safety), borderLeft: `3px solid ${safetyColor(g.safety)}` }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ fontSize: 16, fontWeight: 600, color: C.text, flex: 1, fontFamily: "'Raleway', 'Nunito Sans', sans-serif" }}>{g.name}</div>
                            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                              {chatBadge(g.source)}
                              {cardActions(editKey, () => { cancelEdit(); setEditing({ tab: "grapes", id: g.name, data: g }); })}
                            </div>
                          </div>
                          <div style={{ fontSize: 12, color: C.textDim, marginTop: 2, lineHeight: 1.6 }}>{g.note}</div>
                          {isConfirming(editKey) && (
                            <div style={{ marginTop: 6, display: "flex", gap: 6, justifyContent: "flex-end" }}>
                              <button onClick={() => setConfirmDelete(null)} style={btnCancel}>Cancel</button>
                              <button onClick={() => { deleteGrape(g.name); setConfirmDelete(null); bump(); }} style={btnDanger}>Delete</button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
              <div style={{ ...cardBase, padding: 14, position: "relative", overflow: "hidden" }}>
                <WineGlassArt size={60} color={C.accent} opacity={0.08} style={{ position: "absolute", right: 8, top: 6 }} />
                <div style={{ fontSize: 16, fontWeight: 700, color: C.accent, marginBottom: 6, position: "relative", fontFamily: "'Raleway', 'Nunito Sans', sans-serif" }}>The Rule</div>
                <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.6, fontStyle: "italic", position: "relative", paddingRight: 36 }}>Thin-skinned, aromatic, high-acid grapes = transparent wines with lift. Thick-skinned grapes = heavy, extracted, jammy.</div>
              </div>
            </div>
          );
        })()}

        {/* ===== REGIONS TAB ===== */}
        {tab === "regions" && (() => {
          const regions = getRegions();
          const tiers = ["goldmine", "good", "splurge", "caution", "avoid"];
          const isAdding = adding?.tab === "regions";
          const isEditingRegion = editing?.tab === "regions";

          return (
            <div>
              <div style={{ fontSize: 10, letterSpacing: 4, color: C.textDim, textTransform: "uppercase", marginBottom: 16, fontWeight: 700 }}>Region Guide</div>

              {isAdding ? (
                <RegionForm onCancel={cancelEdit} onSave={(data) => { upsertRegion(data); setAdding(null); bump(); }} />
              ) : (
                addButton("Add Region", () => { cancelEdit(); setAdding({ tab: "regions" }); })
              )}

              {tiers.map((tier, tierIdx) => {
                const filtered = regions.filter(r => r.tier === tier);
                if (filtered.length === 0) return null;
                return (
                  <div key={tier} style={{ marginBottom: 20 }}>
                    {tierIdx > 0 && <VineDivider color={C.accent} opacity={0.10} style={{ margin: "16px 0 12px" }} />}
                    <div style={{ fontSize: 12, fontWeight: 600, color: tierColor(tier), marginBottom: 8, letterSpacing: 1, textTransform: "uppercase" }}>{tierLabel(tier)}</div>
                    {filtered.map(r => {
                      const editKey = `region:${r.name}`;
                      const isExpanded = expandedRegion === r.name;

                      if (isEditingRegion && editing.id === r.name) {
                        return <RegionForm key={r.name} initial={editing.data} onCancel={cancelEdit} onSave={(data) => { upsertRegion(data); cancelEdit(); bump(); }} />;
                      }

                      return (
                        <div key={r.name} onClick={() => setExpandedRegion(isExpanded ? null : r.name)} style={{ ...cardBase, cursor: "pointer", borderLeft: `3px solid ${tierColor(r.tier)}` }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ fontSize: 16, fontWeight: 600, color: C.text, flex: 1, fontFamily: "'Raleway', 'Nunito Sans', sans-serif" }}>{r.name}</div>
                            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                              {chatBadge(r.source)}
                              {r.price && <span style={{ fontSize: 12, color: C.accent, fontWeight: 500 }}>{r.price}</span>}
                              {cardActions(editKey, () => { cancelEdit(); setEditing({ tab: "regions", id: r.name, data: r }); setExpandedRegion(r.name); })}
                            </div>
                          </div>

                          {isConfirming(editKey) && (
                            <div style={{ marginTop: 6, display: "flex", gap: 6, justifyContent: "flex-end" }} onClick={e => e.stopPropagation()}>
                              <button onClick={() => setConfirmDelete(null)} style={btnCancel}>Cancel</button>
                              <button onClick={() => { deleteRegion(r.name); setConfirmDelete(null); bump(); }} style={btnDanger}>Delete</button>
                            </div>
                          )}

                          {isExpanded && !isConfirming(editKey) && (
                            <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}` }} onClick={e => e.stopPropagation()}>
                              <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.6, marginBottom: 8 }}>{r.note}</div>

                              {r.soils && (
                                <div style={{ marginBottom: 8 }}>
                                  <div style={{ fontSize: 11, fontWeight: 600, color: C.accent, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Terroir</div>
                                  <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.5 }}>{r.soils}</div>
                                </div>
                              )}

                              {r.subEntries?.length > 0 && (
                                <div style={{ marginBottom: 8 }}>
                                  <div style={{ fontSize: 11, fontWeight: 600, color: C.accent, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Appellations</div>
                                  {r.subEntries.map((sub, i) => (
                                    <div key={i} style={{ padding: "8px 10px", marginBottom: 4, background: C.bg, borderRadius: 6, borderLeft: `2px solid ${sub.rank && sub.rank <= 2 ? C.accent : C.border}` }}>
                                      <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
                                        {sub.rank ? `#${sub.rank} ` : ""}{sub.name}
                                      </div>
                                      <div style={{ fontSize: 11.5, color: C.textDim, lineHeight: 1.5, marginTop: 2 }}>{sub.note}</div>
                                      {sub.picks && <div style={{ fontSize: 11, color: C.accent, marginTop: 3 }}>Look for: {sub.picks}</div>}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {r.vintages?.length > 0 && (
                                <div>
                                  <div style={{ fontSize: 11, fontWeight: 600, color: C.accent, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Vintage Guide</div>
                                  {r.vintages.map((v, i) => (
                                    <div key={i} style={{ padding: "6px 10px", marginBottom: 3, background: C.bg, borderRadius: 6, display: "flex", gap: 8, alignItems: "flex-start" }}>
                                      <div style={{ fontSize: 13, fontWeight: 600, color: C.accent, minWidth: 36 }}>{v.year}</div>
                                      <div>
                                        <div style={{ fontSize: 12, fontWeight: 600, color: v.verdict?.includes("YOUR") ? C.accent : C.text }}>{v.verdict}</div>
                                        {v.detail && <div style={{ fontSize: 11, color: C.textDim, lineHeight: 1.4, marginTop: 1 }}>{v.detail}</div>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* ===== LABELS TAB ===== */}
        {tab === "labels" && (() => {
          const labels = getLabels();
          const isAddingGreen = adding?.tab === "labels" && adding?.category === "green";
          const isAddingRed = adding?.tab === "labels" && adding?.category === "red";

          return (
            <div>
              <div style={{ fontSize: 10, letterSpacing: 4, color: C.textDim, textTransform: "uppercase", marginBottom: 16, fontWeight: 700 }}>Label Reading Cheat Sheet</div>

              {/* Green Flags */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: C.green, marginBottom: 10, fontFamily: "'Raleway', 'Nunito Sans', sans-serif" }}>Green Flags</div>
                {isAddingGreen ? (
                  <LabelForm onCancel={cancelEdit} onSave={(data) => { upsertLabelTip({ ...data, type: "green" }); setAdding(null); bump(); }} />
                ) : (
                  addButton("Add Green Flag", () => { cancelEdit(); setAdding({ tab: "labels", category: "green" }); })
                )}
                {labels.green.map((t, i) => {
                  const editKey = `label:green:${t.flag}`;
                  const isEditing = editing?.tab === "labels" && editing?.id === `green:${t.flag}`;

                  if (isEditing) {
                    return <LabelForm key={i} initial={editing.data} onCancel={cancelEdit} onSave={(data) => {
                      if (editing.data.flag !== data.flag) deleteLabelTip("green", editing.data.flag);
                      upsertLabelTip({ ...data, type: "green" }); cancelEdit(); bump();
                    }} />;
                  }

                  return (
                    <div key={i} style={{ ...cardBase, background: C.greenBg, borderLeft: `3px solid ${C.green}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontSize: 15, fontWeight: 600, color: C.text, flex: 1, fontFamily: "'Raleway', 'Nunito Sans', sans-serif" }}>{t.flag}</div>
                        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                          {chatBadge(t.source)}
                          {cardActions(editKey, () => { cancelEdit(); setEditing({ tab: "labels", id: `green:${t.flag}`, data: t }); })}
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: C.textDim, marginTop: 2, lineHeight: 1.6 }}>{t.detail}</div>
                      {isConfirming(editKey) && (
                        <div style={{ marginTop: 6, display: "flex", gap: 6, justifyContent: "flex-end" }}>
                          <button onClick={() => setConfirmDelete(null)} style={btnCancel}>Cancel</button>
                          <button onClick={() => { deleteLabelTip("green", t.flag); setConfirmDelete(null); bump(); }} style={btnDanger}>Delete</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Red Flags */}
              <div>
                <VineDivider color={C.accent} opacity={0.10} style={{ margin: "8px 0 14px" }} />
                <div style={{ fontSize: 18, fontWeight: 700, color: C.red, marginBottom: 10, fontFamily: "'Raleway', 'Nunito Sans', sans-serif" }}>Red Flags</div>
                {isAddingRed ? (
                  <LabelForm onCancel={cancelEdit} onSave={(data) => { upsertLabelTip({ ...data, type: "red" }); setAdding(null); bump(); }} />
                ) : (
                  addButton("Add Red Flag", () => { cancelEdit(); setAdding({ tab: "labels", category: "red" }); })
                )}
                {labels.red.map((t, i) => {
                  const editKey = `label:red:${t.flag}`;
                  const isEditing = editing?.tab === "labels" && editing?.id === `red:${t.flag}`;

                  if (isEditing) {
                    return <LabelForm key={i} initial={editing.data} onCancel={cancelEdit} onSave={(data) => {
                      if (editing.data.flag !== data.flag) deleteLabelTip("red", editing.data.flag);
                      upsertLabelTip({ ...data, type: "red" }); cancelEdit(); bump();
                    }} />;
                  }

                  return (
                    <div key={i} style={{ ...cardBase, background: C.redBg, borderLeft: `3px solid ${C.red}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontSize: 15, fontWeight: 600, color: C.text, flex: 1, fontFamily: "'Raleway', 'Nunito Sans', sans-serif" }}>{t.flag}</div>
                        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                          {chatBadge(t.source)}
                          {cardActions(editKey, () => { cancelEdit(); setEditing({ tab: "labels", id: `red:${t.flag}`, data: t }); })}
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: C.textDim, marginTop: 2, lineHeight: 1.6 }}>{t.detail}</div>
                      {isConfirming(editKey) && (
                        <div style={{ marginTop: 6, display: "flex", gap: 6, justifyContent: "flex-end" }}>
                          <button onClick={() => setConfirmDelete(null)} style={btnCancel}>Cancel</button>
                          <button onClick={() => { deleteLabelTip("red", t.flag); setConfirmDelete(null); bump(); }} style={btnDanger}>Delete</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* ===== CELLAR TAB ===== */}
        {tab === "cellar" && (() => {
          const cellar = getCellar();
          const huntList = getHuntList();
          const palateNotes = getPalateNotes();
          const isAdding = adding?.tab === "cellar";

          const filtered = verdictFilter ? cellar.filter(t => t.verdict === verdictFilter) : cellar;
          const sorted = [...filtered].sort((a, b) =>
            cellarSort === "rating"
              ? (gradeOrder[b.rating] || 0) - (gradeOrder[a.rating] || 0)
              : (b.date || "").localeCompare(a.date || "")
          );

          const sortedHunt = [...huntList].sort((a, b) => {
            const pa = priorityOrder[a.priority] ?? 3;
            const pb = priorityOrder[b.priority] ?? 3;
            if (pa !== pb) return pa - pb;
            return (b.addedDate || "").localeCompare(a.addedDate || "");
          });

          const segBtn = (view) => ({
            padding: "8px 0", fontSize: 13, fontWeight: 600, flex: 1,
            background: cellarView === view ? C.accent : C.card, color: cellarView === view ? "#fff" : C.textDim,
            border: `1px solid ${cellarView === view ? C.accent : C.border}`, cursor: "pointer",
            borderRadius: view === "cellar" ? "8px 0 0 8px" : "0 8px 8px 0",
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
          });

          return (
            <div>
              {/* Segmented toggle: Cellar | Hunt List */}
              <div style={{ display: "flex", marginBottom: 14 }}>
                <button onClick={() => { setCellarView("cellar"); cancelEdit(); }} style={segBtn("cellar")}>
                  <Wine size={14} strokeWidth={2} /> Cellar {cellar.length > 0 ? `(${cellar.length})` : ""}
                </button>
                <button onClick={() => { setCellarView("huntList"); cancelEdit(); }} style={segBtn("huntList")}>
                  <Target size={14} strokeWidth={2} /> Hunt List {huntList.length > 0 ? `(${huntList.length})` : ""}
                </button>
              </div>

              {/* ---- CELLAR VIEW ---- */}
              {cellarView === "cellar" && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 10, letterSpacing: 4, color: C.textDim, textTransform: "uppercase", fontWeight: 700 }}>Tasting Log</div>
                      <div style={{ fontSize: 26, fontWeight: 700, color: C.text, marginTop: 2, fontFamily: "'Raleway', 'Nunito Sans', sans-serif", letterSpacing: -0.5 }}>My Cellar</div>
                    </div>
                    <div style={{ fontSize: 12, color: C.textDim }}>{sorted.length} wines</div>
                  </div>

                  {/* Sort + Export */}
                  <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                    <button onClick={() => setCellarSort("date")} style={{ padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: cellarSort === "date" ? C.accent : C.card, color: cellarSort === "date" ? "#fff" : C.textDim, border: `1px solid ${cellarSort === "date" ? C.accent : C.border}`, cursor: "pointer" }}>Newest</button>
                    <button onClick={() => setCellarSort("rating")} style={{ padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: cellarSort === "rating" ? C.accent : C.card, color: cellarSort === "rating" ? "#fff" : C.textDim, border: `1px solid ${cellarSort === "rating" ? C.accent : C.border}`, cursor: "pointer" }}>Top Rated</button>
                    <button onClick={handleExport} style={{ marginLeft: "auto", padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 500, background: C.card, color: C.accent, border: `1px solid ${C.border}`, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}><Download size={14} strokeWidth={2} /> Export</button>
                  </div>

                  {/* Verdict filter pills */}
                  <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
                    {[null, "loved", "liked", "neutral", "disliked", "experiment"].map(v => (
                      <button key={v || "all"} onClick={() => setVerdictFilter(v)}
                        style={{
                          padding: "4px 10px", borderRadius: 16, fontSize: 11, fontWeight: 600,
                          background: verdictFilter === v ? (v ? verdictColor(v) : C.accent) : C.card,
                          color: verdictFilter === v ? "#fff" : C.textDim,
                          border: `1px solid ${verdictFilter === v ? "transparent" : C.border}`,
                          cursor: "pointer", textTransform: "capitalize",
                        }}>
                        {v || "All"}
                      </button>
                    ))}
                  </div>

                  {/* Add Tasting */}
                  {isAdding ? (
                    <CellarForm onCancel={cancelEdit} onSave={(data) => { addCellarEntry({ ...data, source: "manual" }); setAdding(null); bump(); }} />
                  ) : (
                    addButton("Add Tasting", () => { cancelEdit(); setAdding({ tab: "cellar" }); })
                  )}

                  {/* Tasting entries */}
                  {sorted.length === 0 ? (
                    <div style={{ padding: 32, textAlign: "center", color: C.textDim, fontSize: 14 }}>
                      <WineGlassArt size={64} color={C.accent} opacity={0.15} style={{ margin: "0 auto 12px", display: "block" }} />
                      {verdictFilter ? `No "${verdictFilter}" wines yet.` : "No tastings logged yet. Chat with the sommelier about wines you've tried and they'll appear here automatically."}
                    </div>
                  ) : sorted.map((t) => {
                    const entryId = t.id || t.wine;
                    const isExpanded = expandedCellarId === entryId;
                    const editKey = `cellar:${entryId}`;
                    const isEditing = editing?.tab === "cellar" && editing?.id === entryId;

                    if (isEditing) {
                      return <CellarForm key={entryId} initial={editing.data} onCancel={cancelEdit} onSave={(data) => { updateCellarEntry(entryId, data); cancelEdit(); bump(); }} />;
                    }

                    return (
                      <div key={entryId} onClick={() => setExpandedCellarId(isExpanded ? null : entryId)}
                        style={{ ...cardBase, borderLeft: `3px solid ${verdictColor(t.verdict)}`, cursor: "pointer" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div style={{ fontSize: 16, fontWeight: 600, color: C.text, flex: 1, fontFamily: "'Raleway', 'Nunito Sans', sans-serif" }}>{t.wine}</div>
                          <div style={{ display: "flex", gap: 8, alignItems: "center", marginLeft: 8, flexShrink: 0 }}>
                            {t.rating && <div style={{ fontSize: 16, fontWeight: 700, color: C.accent }}>{t.rating}</div>}
                            <div style={{
                              fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 10,
                              background: verdictColor(t.verdict), color: "#fff", textTransform: "uppercase", whiteSpace: "nowrap",
                            }}>{t.verdict}</div>
                          </div>
                        </div>
                        <div style={{ fontSize: 11, color: C.textFaint, marginTop: 4 }}>{t.date}</div>

                        {isExpanded && (
                          <div style={{ marginTop: 8, borderTop: `1px solid ${C.border}`, paddingTop: 8 }} onClick={e => e.stopPropagation()}>
                            {t.notes && <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.6, fontStyle: "italic", marginBottom: 8 }}>{t.notes}</div>}
                            <WineLinks wineName={t.wine} producerUrl={t.producerUrl} />
                            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginTop: 6 }}>
                              <button onClick={() => { cancelEdit(); setEditing({ tab: "cellar", id: entryId, data: t }); }} style={{ ...btnSmall, gap: 4 }}><Pencil size={12} strokeWidth={1.8} /> Edit</button>
                              {isConfirming(editKey) ? (
                                <>
                                  <button onClick={() => setConfirmDelete(null)} style={btnCancel}>Cancel</button>
                                  <button onClick={() => { deleteCellarEntry(entryId); setConfirmDelete(null); setExpandedCellarId(null); bump(); }} style={btnDanger}>Delete</button>
                                </>
                              ) : (
                                <button onClick={() => setConfirmDelete(editKey)} style={{ ...btnSmall, color: C.red, gap: 4 }}><X size={12} strokeWidth={1.8} /> Delete</button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Palate Notes */}
                  {palateNotes.length > 0 && (
                    <div style={{ marginTop: 24 }}>
                      <VineTendril width={140} color={C.accent} opacity={0.12} style={{ margin: "0 auto 8px", display: "block" }} />
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.accent, marginBottom: 10, letterSpacing: 1, textTransform: "uppercase" }}>Palate Evolution</div>
                      {palateNotes.map((n, i) => (
                        <div key={i} style={{ ...cardBase, background: C.accentGlow, borderLeft: `3px solid ${C.accent}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, color: C.text, lineHeight: 1.5 }}>{n.text}</div>
                            <div style={{ fontSize: 10, color: C.textFaint, marginTop: 4 }}>{n.date}</div>
                          </div>
                          {confirmDelete === `palate:${i}` ? (
                            <div style={{ display: "flex", gap: 4 }}>
                              <button onClick={() => setConfirmDelete(null)} style={{ ...btnSmall, fontSize: 10 }}>No</button>
                              <button onClick={() => { deletePalateNote(i); setConfirmDelete(null); bump(); }} style={{ ...btnDanger, fontSize: 10 }}>Yes</button>
                            </div>
                          ) : (
                            <button onClick={() => setConfirmDelete(`palate:${i}`)} style={{ ...btnSmall, color: C.red, flexShrink: 0 }}><X size={14} strokeWidth={1.8} /></button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ---- HUNT LIST VIEW ---- */}
              {cellarView === "huntList" && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 10, letterSpacing: 4, color: C.textDim, textTransform: "uppercase", fontWeight: 700 }}>Shopping List</div>
                      <div style={{ fontSize: 26, fontWeight: 700, color: C.text, marginTop: 2, fontFamily: "'Raleway', 'Nunito Sans', sans-serif", letterSpacing: -0.5 }}>Hunt List</div>
                    </div>
                    <div style={{ fontSize: 12, color: C.textDim }}>{huntList.length} wines</div>
                  </div>

                  {sortedHunt.length === 0 ? (
                    <div style={{ padding: 32, textAlign: "center", color: C.textDim, fontSize: 14 }}>
                      <WineBottle size={64} color={C.accent} opacity={0.15} style={{ margin: "0 auto 12px", display: "block" }} />
                      No wines on your hunt list yet. Ask the sommelier for recommendations and they'll add them here.
                    </div>
                  ) : sortedHunt.map((h) => {
                    const hId = h.id || h.wine;
                    const isExpanded = expandedCellarId === `hunt:${hId}`;
                    const deleteKey = `hunt:${hId}`;

                    return (
                      <div key={hId} onClick={() => setExpandedCellarId(isExpanded ? null : `hunt:${hId}`)}
                        style={{ ...cardBase, borderLeft: `3px solid ${priorityColor(h.priority)}`, cursor: "pointer" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div style={{ fontSize: 16, fontWeight: 600, color: C.text, flex: 1, fontFamily: "'Raleway', 'Nunito Sans', sans-serif" }}>{h.wine}</div>
                          <div style={{ display: "flex", gap: 8, alignItems: "center", marginLeft: 8, flexShrink: 0 }}>
                            {h.priceRange && <span style={{ fontSize: 12, color: C.accent, fontWeight: 500 }}>{h.priceRange}</span>}
                            <div style={{
                              fontSize: 9, fontWeight: 600, padding: "2px 8px", borderRadius: 10,
                              background: priorityColor(h.priority), color: "#fff", textTransform: "uppercase", whiteSpace: "nowrap",
                            }}>{priorityLabel(h.priority)}</div>
                          </div>
                        </div>
                        <div style={{ fontSize: 12, color: C.textDim, marginTop: 4, lineHeight: 1.6 }}>{h.why}</div>

                        {isExpanded && (
                          <div style={{ marginTop: 8, borderTop: `1px solid ${C.border}`, paddingTop: 8 }} onClick={e => e.stopPropagation()}>
                            {h.addedDate && <div style={{ fontSize: 11, color: C.textFaint, marginBottom: 6 }}>Added {new Date(h.addedDate).toLocaleDateString()}</div>}
                            <WineLinks wineName={h.wine} producerUrl={h.producerUrl} />
                            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginTop: 6 }}>
                              {isConfirming(deleteKey) ? (
                                <>
                                  <button onClick={() => setConfirmDelete(null)} style={btnCancel}>Cancel</button>
                                  <button onClick={() => { removeHuntListEntry(h.wine); setConfirmDelete(null); setExpandedCellarId(null); bump(); }} style={btnDanger}>Remove</button>
                                </>
                              ) : (
                                <button onClick={() => setConfirmDelete(deleteKey)} style={{ ...btnSmall, color: C.red, gap: 4 }}><X size={12} strokeWidth={1.8} /> Remove</button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Bottom Tab Bar */}
      <div style={{
        position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: "100%", maxWidth: 480, background: C.tabBar,
        borderTop: `1px solid ${C.tabBarBorder}`,
        display: "flex", justifyContent: "space-around", alignItems: "center",
        padding: "6px 0 calc(6px + env(safe-area-inset-bottom, 0px))",
        zIndex: 100, boxShadow: "0 -2px 8px rgba(0,0,0,0.06)",
      }}>
        {tabs.map(t => {
          const isActive = tab === t.id;
          return (
            <button key={t.id} onClick={() => selectTab(t.id)}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                padding: "4px 12px", background: "none", border: "none", cursor: "pointer",
                color: isActive ? C.tabActive : C.tabInactive, transition: "color 0.15s",
              }}>
              <t.Icon size={20} strokeWidth={isActive ? 2.2 : 1.6} color={isActive ? C.tabActive : C.tabInactive} />
              <span style={{ fontSize: 10, fontWeight: isActive ? 600 : 400, letterSpacing: 0.3 }}>{t.label}</span>
            </button>
          );
        })}
      </div>

      <style>{`
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        ::-webkit-scrollbar { display: none; }
        body { margin: 0; background: ${C.bg}; }
        textarea::placeholder { color: ${C.textFaint}; font-family: 'Nunito Sans', sans-serif; }
        input::placeholder { color: ${C.textFaint}; font-family: 'Nunito Sans', sans-serif; }
      `}</style>
    </div>
  );
}

export default App;
