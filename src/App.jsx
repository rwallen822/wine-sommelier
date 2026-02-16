import { useState, useEffect, useCallback } from "react";
import { C } from "./theme";
import { PALATE_CORE } from "./palateConfig";
import ChatTab from "./ChatTab";
import { getGrapes, getRegions, getLabels, getCellar, getPalateNotes, exportAllData, pullFromCloud, migrateToV2 } from "./storage";

function App() {
  const [tab, setTab] = useState("chat");
  const [expandedRegion, setExpandedRegion] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [cellarSort, setCellarSort] = useState("date");
  const [verdictFilter, setVerdictFilter] = useState(null);
  const [expandedCellarId, setExpandedCellarId] = useState(null);
  const [syncKey, setSyncKey] = useState(0);
  const [dataVersion, setDataVersion] = useState(0);

  // Migrate v1 → v2, then pull cloud data
  useEffect(() => {
    migrateToV2();
    pullFromCloud().then((updated) => {
      if (updated) setSyncKey(k => k + 1);
    });
  }, []);

  const onDataUpdated = useCallback(() => setDataVersion(v => v + 1), []);

  const tabs = [
    { id: "chat", label: "Chat", icon: "💬" },
    { id: "grapes", label: "Grapes", icon: "🍇" },
    { id: "regions", label: "Regions", icon: "🗺" },
    { id: "labels", label: "Labels", icon: "🏷" },
    { id: "cellar", label: "Cellar", icon: "🍷" },
  ];

  const selectTab = (id) => {
    setTab(id);
    setDrawerOpen(false);
    if (id !== "chat") window.scrollTo(0, 0);
  };

  const safetyColor = (s) => s === "always" ? C.green : s === "sometimes" ? C.gold : C.red;
  const safetyBg = (s) => s === "always" ? C.greenBg : s === "sometimes" ? C.yellowBg : C.redBg;

  const tierColor = (t) => {
    switch (t) {
      case "goldmine": return C.gold;
      case "good": return C.green;
      case "splurge": return C.accentLight;
      case "caution": return C.yellow || C.gold;
      case "avoid": return C.red;
      default: return C.textDim;
    }
  };
  const tierLabel = (t) => {
    switch (t) {
      case "goldmine": return "GOLDMINE";
      case "good": return "GOOD BET";
      case "splurge": return "SPLURGE";
      case "caution": return "CAUTION";
      case "avoid": return "AVOID";
      default: return t?.toUpperCase();
    }
  };

  const verdictColor = (v) => {
    switch (v) {
      case "loved": return C.gold;
      case "liked": return C.green;
      case "neutral": return C.textDim;
      case "disliked": return C.red;
      case "experiment": return C.accent;
      default: return C.textDim;
    }
  };

  const gradeOrder = { "A+": 13, "A": 12, "A-": 11, "B+": 10, "B": 9, "B-": 8, "C+": 7, "C": 6, "C-": 5, "D+": 4, "D": 3, "D-": 2, "F": 1 };

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

  return (
    <div style={{ background: C.bg, minHeight: "100vh", maxWidth: 480, margin: "0 auto", fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", color: C.text, position: "relative" }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ padding: "16px 16px 12px", background: C.card, borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 50 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.accent, lineHeight: 1.1 }}>Wine Guide</div>
          <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>Your personal sommelier</div>
        </div>
        <button
          onClick={() => setDrawerOpen(true)}
          style={{
            width: 40, height: 40, borderRadius: 10, background: C.bg, border: `1px solid ${C.border}`,
            fontSize: 22, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            color: C.text,
          }}
        >☰</button>
      </div>

      {/* Drawer overlay */}
      {drawerOpen && (
        <div
          onClick={() => setDrawerOpen(false)}
          style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.4)", zIndex: 200,
          }}
        />
      )}

      {/* Slide-out drawer */}
      <div style={{
        position: "fixed", top: 0, right: drawerOpen ? 0 : -280, bottom: 0, width: 280,
        background: C.card, zIndex: 300, transition: "right 0.25s ease",
        boxShadow: drawerOpen ? "-4px 0 20px rgba(0,0,0,0.15)" : "none",
        display: "flex", flexDirection: "column",
      }}>
        <div style={{ padding: "20px 20px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.accent }}>Menu</div>
          <button
            onClick={() => setDrawerOpen(false)}
            style={{ width: 32, height: 32, borderRadius: 8, background: C.bg, border: `1px solid ${C.border}`, fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: C.textDim }}
          >✕</button>
        </div>
        <div style={{ padding: "12px 0", flex: 1 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => selectTab(t.id)}
              style={{
                display: "flex", alignItems: "center", gap: 14, width: "100%",
                padding: "14px 24px", border: "none", cursor: "pointer",
                background: tab === t.id ? C.accentGlow : "transparent",
                borderRight: tab === t.id ? `3px solid ${C.accent}` : "3px solid transparent",
                transition: "all 0.15s",
              }}>
              <span style={{ fontSize: 22 }}>{t.icon}</span>
              <span style={{ fontSize: 15, fontWeight: tab === t.id ? 600 : 400, color: tab === t.id ? C.accent : C.text }}>{t.label}</span>
            </button>
          ))}
        </div>
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
          return (
            <div>
              <div style={{ fontSize: 11, letterSpacing: 3, color: C.goldDim, textTransform: "uppercase", marginBottom: 16 }}>Grape Variety Guide</div>
              {["always", "sometimes", "avoid"].map(safety => {
                const filtered = grapes.filter(g => g.safety === safety);
                if (filtered.length === 0) return null;
                return (
                  <div key={safety} style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: safetyColor(safety), marginBottom: 8, letterSpacing: 1, textTransform: "uppercase" }}>
                      {safety === "always" ? "Always Safe" : safety === "sometimes" ? "Winemaking Dependent" : "Avoid"}
                    </div>
                    {filtered.map(g => (
                      <div key={g.name} style={{ padding: "10px 12px", marginBottom: 6, background: safetyBg(g.safety), borderRadius: 8, borderLeft: `3px solid ${safetyColor(g.safety)}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{g.name}</div>
                          {chatBadge(g.source)}
                        </div>
                        <div style={{ fontSize: 12.5, color: C.textDim, marginTop: 2, lineHeight: 1.5 }}>{g.note}</div>
                      </div>
                    ))}
                  </div>
                );
              })}
              <div style={{ padding: 14, background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, marginTop: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.gold, marginBottom: 6 }}>The Rule</div>
                <div style={{ fontSize: 12.5, color: C.textDim, lineHeight: 1.6, fontStyle: "italic" }}>Thin-skinned, aromatic, high-acid grapes = transparent wines with lift. Thick-skinned grapes = heavy, extracted, jammy.</div>
              </div>
            </div>
          );
        })()}

        {/* ===== REGIONS TAB ===== */}
        {tab === "regions" && (() => {
          const regions = getRegions();
          const tiers = ["goldmine", "good", "splurge", "caution", "avoid"];
          return (
            <div>
              <div style={{ fontSize: 11, letterSpacing: 3, color: C.goldDim, textTransform: "uppercase", marginBottom: 16 }}>Region Guide</div>
              {tiers.map(tier => {
                const filtered = regions.filter(r => r.tier === tier);
                if (filtered.length === 0) return null;
                return (
                  <div key={tier} style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: tierColor(tier), marginBottom: 8, letterSpacing: 1, textTransform: "uppercase" }}>{tierLabel(tier)}</div>
                    {filtered.map(r => (
                      <div key={r.name} onClick={() => setExpandedRegion(expandedRegion === r.name ? null : r.name)} style={{ padding: "12px", marginBottom: 6, background: C.card, borderRadius: 8, border: `1px solid ${C.border}`, cursor: "pointer", borderLeft: `3px solid ${tierColor(r.tier)}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{r.name}</div>
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            {chatBadge(r.source)}
                            {r.price && <span style={{ fontSize: 12, color: C.gold, fontWeight: 500 }}>{r.price}</span>}
                          </div>
                        </div>
                        {expandedRegion === r.name && (
                          <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
                            <div style={{ fontSize: 12.5, color: C.textDim, lineHeight: 1.6, marginBottom: 8 }}>{r.note}</div>

                            {/* Soils */}
                            {r.soils && (
                              <div style={{ marginBottom: 8 }}>
                                <div style={{ fontSize: 11, fontWeight: 600, color: C.gold, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Terroir</div>
                                <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.5 }}>{r.soils}</div>
                              </div>
                            )}

                            {/* Sub-entries (appellations) */}
                            {r.subEntries?.length > 0 && (
                              <div style={{ marginBottom: 8 }}>
                                <div style={{ fontSize: 11, fontWeight: 600, color: C.gold, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Appellations</div>
                                {r.subEntries.map((sub, i) => (
                                  <div key={i} style={{ padding: "8px 10px", marginBottom: 4, background: C.bg, borderRadius: 6, borderLeft: `2px solid ${sub.rank && sub.rank <= 2 ? C.gold : C.border}` }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
                                      {sub.rank ? `#${sub.rank} ` : ""}{sub.name}
                                    </div>
                                    <div style={{ fontSize: 11.5, color: C.textDim, lineHeight: 1.5, marginTop: 2 }}>{sub.note}</div>
                                    {sub.picks && <div style={{ fontSize: 11, color: C.gold, marginTop: 3 }}>Look for: {sub.picks}</div>}
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Vintages */}
                            {r.vintages?.length > 0 && (
                              <div>
                                <div style={{ fontSize: 11, fontWeight: 600, color: C.gold, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Vintage Guide</div>
                                {r.vintages.map((v, i) => (
                                  <div key={i} style={{ padding: "6px 10px", marginBottom: 3, background: C.bg, borderRadius: 6, display: "flex", gap: 8, alignItems: "flex-start" }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: C.gold, minWidth: 36 }}>{v.year}</div>
                                    <div>
                                      <div style={{ fontSize: 12, fontWeight: 600, color: v.verdict?.includes("YOUR") ? C.gold : C.text }}>{v.verdict}</div>
                                      {v.detail && <div style={{ fontSize: 11, color: C.textDim, lineHeight: 1.4, marginTop: 1 }}>{v.detail}</div>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* ===== LABELS TAB ===== */}
        {tab === "labels" && (() => {
          const labels = getLabels();
          return (
            <div>
              <div style={{ fontSize: 11, letterSpacing: 3, color: C.goldDim, textTransform: "uppercase", marginBottom: 16 }}>Label Reading Cheat Sheet</div>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.green, marginBottom: 10 }}>Green Flags</div>
                {labels.green.map((t, i) => (
                  <div key={i} style={{ padding: "10px 12px", marginBottom: 5, background: C.greenBg, borderRadius: 8, borderLeft: `3px solid ${C.green}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: C.text }}>{t.flag}</div>
                      {chatBadge(t.source)}
                    </div>
                    <div style={{ fontSize: 12, color: C.textDim, marginTop: 2, lineHeight: 1.5 }}>{t.detail}</div>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.red, marginBottom: 10 }}>Red Flags</div>
                {labels.red.map((t, i) => (
                  <div key={i} style={{ padding: "10px 12px", marginBottom: 5, background: C.redBg, borderRadius: 8, borderLeft: `3px solid ${C.red}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: C.text }}>{t.flag}</div>
                      {chatBadge(t.source)}
                    </div>
                    <div style={{ fontSize: 12, color: C.textDim, marginTop: 2, lineHeight: 1.5 }}>{t.detail}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* ===== CELLAR TAB ===== */}
        {tab === "cellar" && (() => {
          const cellar = getCellar();
          const palateNotes = getPalateNotes();

          const filtered = verdictFilter ? cellar.filter(t => t.verdict === verdictFilter) : cellar;
          const sorted = [...filtered].sort((a, b) =>
            cellarSort === "rating"
              ? (gradeOrder[b.rating] || 0) - (gradeOrder[a.rating] || 0)
              : (b.date || "").localeCompare(a.date || "")
          );

          return (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 11, letterSpacing: 3, color: C.goldDim, textTransform: "uppercase" }}>Tasting Log</div>
                  <div style={{ fontSize: 20, fontWeight: 500, color: C.text, marginTop: 2 }}>My Cellar</div>
                </div>
                <div style={{ fontSize: 12, color: C.textDim }}>{sorted.length} wines</div>
              </div>

              {/* Sort + Export */}
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <button onClick={() => setCellarSort("date")} style={{ padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: cellarSort === "date" ? C.accent : C.card, color: cellarSort === "date" ? "#fff" : C.textDim, border: `1px solid ${cellarSort === "date" ? C.accent : C.border}`, cursor: "pointer" }}>Newest</button>
                <button onClick={() => setCellarSort("rating")} style={{ padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: cellarSort === "rating" ? C.accent : C.card, color: cellarSort === "rating" ? "#fff" : C.textDim, border: `1px solid ${cellarSort === "rating" ? C.accent : C.border}`, cursor: "pointer" }}>Top Rated</button>
                <button onClick={handleExport} style={{ marginLeft: "auto", padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 500, background: C.card, color: C.gold, border: `1px solid ${C.border}`, cursor: "pointer" }}>Export</button>
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

              {/* Tasting entries */}
              {sorted.length === 0 ? (
                <div style={{ padding: 24, textAlign: "center", color: C.textDim, fontSize: 14 }}>
                  {verdictFilter ? `No "${verdictFilter}" wines yet.` : "No tastings logged yet. Chat with the sommelier about wines you've tried and they'll appear here automatically."}
                </div>
              ) : sorted.map((t) => {
                const entryId = t.id || t.wine;
                const isExpanded = expandedCellarId === entryId;
                return (
                  <div key={entryId} onClick={() => setExpandedCellarId(isExpanded ? null : entryId)}
                    style={{ padding: "14px 16px", marginBottom: 8, background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, borderLeft: `3px solid ${verdictColor(t.verdict)}`, cursor: "pointer" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: C.text, flex: 1 }}>{t.wine}</div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginLeft: 8, flexShrink: 0 }}>
                        {t.rating && <div style={{ fontSize: 16, fontWeight: 700, color: C.gold }}>{t.rating}</div>}
                        <div style={{
                          fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 10,
                          background: verdictColor(t.verdict), color: "#fff", textTransform: "uppercase", whiteSpace: "nowrap",
                        }}>{t.verdict}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: C.textFaint, marginTop: 4 }}>{t.date}</div>

                    {/* Expandable notes */}
                    {isExpanded && t.notes && (
                      <div style={{ fontSize: 12.5, color: C.textDim, marginTop: 8, lineHeight: 1.5, borderTop: `1px solid ${C.border}`, paddingTop: 8, fontStyle: "italic" }}>
                        {t.notes}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Palate Notes */}
              {palateNotes.length > 0 && (
                <div style={{ marginTop: 24 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.gold, marginBottom: 10, letterSpacing: 1, textTransform: "uppercase" }}>Palate Evolution</div>
                  {palateNotes.map((n, i) => (
                    <div key={i} style={{ padding: "10px 12px", marginBottom: 5, background: C.accentGlow, borderRadius: 8, borderLeft: `3px solid ${C.gold}` }}>
                      <div style={{ fontSize: 13, color: C.text, lineHeight: 1.5 }}>{n.text}</div>
                      <div style={{ fontSize: 10, color: C.textFaint, marginTop: 4 }}>{n.date}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}
      </div>

      <style>{`
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        ::-webkit-scrollbar { display: none; }
        body { margin: 0; background: ${C.bg}; }
        textarea::placeholder { color: ${C.textFaint}; font-family: 'Inter', sans-serif; }
      `}</style>
    </div>
  );
}

export default App;
