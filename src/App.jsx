import { useState, useEffect } from "react";
import { C } from "./theme";
import { GRAPE_GUIDE, REGIONS, BORDEAUX_GUIDE, LABEL_TIPS, SHOP_SCRIPTS, PALATE_CORE } from "./palateConfig";
import ChatTab from "./ChatTab";
import { getTastingLog, getPalateNotes, exportAllData, pullFromCloud } from "./storage";

function App() {
  const [tab, setTab] = useState("chat");
  const [expandedRegion, setExpandedRegion] = useState(null);
  const [expandedBdx, setExpandedBdx] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [cellarSort, setCellarSort] = useState("date"); // "date" or "rating"

  // Pull cloud data on startup
  useEffect(() => { pullFromCloud(); }, []);

  const tabs = [
    { id: "chat", label: "Chat", icon: "💬" },
    { id: "cellar", label: "My Cellar", icon: "🍷" },
    { id: "grapes", label: "Grapes", icon: "🍇" },
    { id: "regions", label: "Regions", icon: "🗺" },
    { id: "bordeaux", label: "Bordeaux", icon: "🏰" },
    { id: "labels", label: "Labels", icon: "🏷" },
    { id: "talk", label: "Scripts", icon: "🗣" },
  ];

  const selectTab = (id) => {
    setTab(id);
    setDrawerOpen(false);
    if (id !== "chat") window.scrollTo(0, 0);
  };

  const safetyColor = (s) => s === "always" ? C.green : s === "sometimes" ? C.gold : C.red;
  const safetyBg = (s) => s === "always" ? C.greenBg : s === "sometimes" ? C.yellowBg : C.redBg;
  const tierColor = (t) => t === "goldmine" ? C.gold : t === "good" ? C.green : C.accentLight;
  const tierLabel = (t) => t === "goldmine" ? "💰 GOLDMINE" : t === "good" ? "👍 GOOD BET" : "💎 SPLURGE";

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
        <ChatTab />
      </div>

      {/* Other Content */}
      <div style={{ padding: "16px 16px 0", display: tab !== "chat" ? "block" : "none" }}>

        {tab === "cellar" && (() => {
          const tastings = getTastingLog();
          const palateNotes = getPalateNotes();
          const parseRating = (r) => parseFloat((r || "0").toString().replace("/10", ""));
          const sorted = [...tastings].sort((a, b) =>
            cellarSort === "rating" ? parseRating(b.rating) - parseRating(a.rating) : (b.date || "").localeCompare(a.date || "")
          );

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

          return (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 11, letterSpacing: 3, color: C.goldDim, textTransform: "uppercase" }}>Tasting Log</div>
                  <div style={{ fontSize: 20, fontWeight: 500, color: C.text, marginTop: 2 }}>My Cellar</div>
                </div>
                <div style={{ fontSize: 12, color: C.textDim }}>{sorted.length} wines</div>
              </div>

              {/* Sort + Export */}
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                <button onClick={() => setCellarSort("date")} style={{ padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: cellarSort === "date" ? C.accent : C.card, color: cellarSort === "date" ? "#fff" : C.textDim, border: `1px solid ${cellarSort === "date" ? C.accent : C.border}`, cursor: "pointer" }}>Newest</button>
                <button onClick={() => setCellarSort("rating")} style={{ padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: cellarSort === "rating" ? C.accent : C.card, color: cellarSort === "rating" ? "#fff" : C.textDim, border: `1px solid ${cellarSort === "rating" ? C.accent : C.border}`, cursor: "pointer" }}>Top Rated</button>
                <button onClick={handleExport} style={{ marginLeft: "auto", padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 500, background: C.card, color: C.gold, border: `1px solid ${C.border}`, cursor: "pointer" }}>Export JSON</button>
              </div>

              {/* Tasting entries */}
              {sorted.length === 0 ? (
                <div style={{ padding: 24, textAlign: "center", color: C.textDim, fontSize: 14 }}>
                  No tastings logged yet. Chat with the sommelier about wines you've tried and they'll appear here automatically.
                </div>
              ) : sorted.map((t, i) => (
                <div key={i} style={{ padding: "14px 16px", marginBottom: 8, background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.accent}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: C.text, flex: 1 }}>{t.wine}</div>
                    {t.rating && <div style={{ fontSize: 14, fontWeight: 700, color: C.gold, marginLeft: 8, whiteSpace: "nowrap" }}>{t.rating}</div>}
                  </div>
                  {t.notes && <div style={{ fontSize: 12.5, color: C.textDim, marginTop: 6, lineHeight: 1.5, fontStyle: "italic" }}>{t.notes}</div>}
                  <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                    {t.region && <div style={{ fontSize: 11, color: C.textFaint }}>{t.region}</div>}
                    {t.grape && <div style={{ fontSize: 11, color: C.textFaint }}>{t.grape}</div>}
                    <div style={{ fontSize: 11, color: C.textFaint, marginLeft: "auto" }}>{t.date}</div>
                  </div>
                </div>
              ))}

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

        {tab === "grapes" && (
          <div>
            <div style={{ fontSize: 11, letterSpacing: 3, color: C.goldDim, textTransform: "uppercase", marginBottom: 16 }}>Grape Variety Guide</div>
            {["always", "sometimes", "avoid"].map(safety => (
              <div key={safety} style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: safetyColor(safety), marginBottom: 8, letterSpacing: 1, textTransform: "uppercase" }}>
                  {safety === "always" ? "✓ Always Safe" : safety === "sometimes" ? "~ Winemaking Dependent" : "✗ Avoid"}
                </div>
                {GRAPE_GUIDE.filter(g => g.safety === safety).map(g => (
                  <div key={g.name} style={{ padding: "10px 12px", marginBottom: 6, background: safetyBg(g.safety), borderRadius: 8, borderLeft: `3px solid ${safetyColor(g.safety)}` }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{g.name}</div>
                    <div style={{ fontSize: 12.5, color: C.textDim, marginTop: 2, lineHeight: 1.5 }}>{g.note}</div>
                  </div>
                ))}
              </div>
            ))}
            <div style={{ padding: 14, background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, marginTop: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.gold, marginBottom: 6 }}>The Rule</div>
              <div style={{ fontSize: 12.5, color: C.textDim, lineHeight: 1.6, fontStyle: "italic" }}>Thin-skinned, aromatic, high-acid grapes = transparent wines with lift. Thick-skinned grapes = heavy, extracted, jammy.</div>
            </div>
          </div>
        )}

        {tab === "regions" && (
          <div>
            <div style={{ fontSize: 11, letterSpacing: 3, color: C.goldDim, textTransform: "uppercase", marginBottom: 16 }}>Region Guide</div>
            {["goldmine", "good", "splurge"].map(tier => (
              <div key={tier} style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: tierColor(tier), marginBottom: 8, letterSpacing: 1 }}>{tierLabel(tier)}</div>
                {REGIONS.filter(r => r.tier === tier).map(r => (
                  <div key={r.name} onClick={() => setExpandedRegion(expandedRegion === r.name ? null : r.name)} style={{ padding: "12px", marginBottom: 6, background: C.card, borderRadius: 8, border: `1px solid ${C.border}`, cursor: "pointer" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{r.name}</div>
                      <div style={{ fontSize: 12, color: C.gold, fontWeight: 500 }}>{r.price}</div>
                    </div>
                    {expandedRegion === r.name && (
                      <div style={{ fontSize: 12.5, color: C.textDim, marginTop: 8, lineHeight: 1.6, borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>{r.note}</div>
                    )}
                  </div>
                ))}
              </div>
            ))}
            <div style={{ padding: 14, background: C.redBg, borderRadius: 10, border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.red, marginBottom: 6 }}>Regions to Avoid Under $30</div>
              <div style={{ fontSize: 12.5, color: C.textDim, lineHeight: 1.6 }}>Argentina (Malbec), most Australia (Shiraz), most California, Chile, South Africa (Pinotage)</div>
            </div>
          </div>
        )}

        {tab === "bordeaux" && (
          <div>
            <div style={{ fontSize: 11, letterSpacing: 3, color: C.goldDim, textTransform: "uppercase", marginBottom: 4 }}>Left Bank Only</div>
            <div style={{ fontSize: 20, fontWeight: 500, color: C.text, marginBottom: 16 }}>Your Bordeaux Strategy</div>
            <div style={{ padding: 12, background: C.redBg, borderRadius: 10, border: `1px solid ${C.border}`, marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.red, marginBottom: 4 }}>❌ Right Bank — Skip</div>
              <div style={{ fontSize: 12, color: C.textDim }}>{BORDEAUX_GUIDE.avoid.join(" · ")}</div>
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.gold, marginBottom: 8, letterSpacing: 1, textTransform: "uppercase" }}>Appellations by Priority</div>
            {BORDEAUX_GUIDE.priority.map(a => (
              <div key={a.rank} onClick={() => setExpandedBdx(expandedBdx === a.rank ? null : a.rank)} style={{ padding: "12px", marginBottom: 6, background: C.card, borderRadius: 8, border: `1px solid ${C.border}`, cursor: "pointer", borderLeft: `3px solid ${a.rank <= 2 ? C.gold : a.rank <= 4 ? C.green : C.textFaint}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ fontSize: 18, fontWeight: 300, color: a.rank <= 2 ? C.gold : C.textFaint, minWidth: 24 }}>#{a.rank}</div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{a.name}</div>
                    <div style={{ fontSize: 12, color: C.textDim, fontStyle: "italic" }}>{a.personality.split(".")[0]}.</div>
                  </div>
                </div>
                {expandedBdx === a.rank && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 12.5, color: C.textDim, lineHeight: 1.6, marginBottom: 8 }}>{a.personality}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.gold, marginBottom: 4 }}>Look For:</div>
                    <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.7 }}>{a.picks}</div>
                  </div>
                )}
              </div>
            ))}
            <div style={{ fontSize: 12, fontWeight: 600, color: C.gold, marginBottom: 8, marginTop: 20, letterSpacing: 1, textTransform: "uppercase" }}>Vintage Guide</div>
            {BORDEAUX_GUIDE.vintages.map(v => (
              <div key={v.year} style={{ padding: "10px 12px", marginBottom: 5, background: C.card, borderRadius: 8, border: `1px solid ${C.border}`, display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: C.gold, minWidth: 42 }}>{v.year}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: v.verdict.includes("YOUR") ? C.gold : C.text }}>{v.verdict}</div>
                  <div style={{ fontSize: 11.5, color: C.textDim, lineHeight: 1.5, marginTop: 2 }}>{v.detail}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "labels" && (
          <div>
            <div style={{ fontSize: 11, letterSpacing: 3, color: C.goldDim, textTransform: "uppercase", marginBottom: 16 }}>Label Reading Cheat Sheet</div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.green, marginBottom: 10 }}>✓ Green Flags</div>
              {LABEL_TIPS.green.map((t, i) => (
                <div key={i} style={{ padding: "10px 12px", marginBottom: 5, background: C.greenBg, borderRadius: 8, borderLeft: `3px solid ${C.green}` }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: C.text }}>{t.flag}</div>
                  <div style={{ fontSize: 12, color: C.textDim, marginTop: 2, lineHeight: 1.5 }}>{t.detail}</div>
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.red, marginBottom: 10 }}>✗ Red Flags</div>
              {LABEL_TIPS.red.map((t, i) => (
                <div key={i} style={{ padding: "10px 12px", marginBottom: 5, background: C.redBg, borderRadius: 8, borderLeft: `3px solid ${C.red}` }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: C.text }}>{t.flag}</div>
                  <div style={{ fontSize: 12, color: C.textDim, marginTop: 2, lineHeight: 1.5 }}>{t.detail}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "talk" && (
          <div>
            <div style={{ fontSize: 11, letterSpacing: 3, color: C.goldDim, textTransform: "uppercase", marginBottom: 6 }}>At the Wine Shop</div>
            <div style={{ fontSize: 18, fontWeight: 500, color: C.text, marginBottom: 16 }}>Conversation Scripts</div>
            {SHOP_SCRIPTS.map((s, i) => (
              <div key={i} style={{ padding: "14px 16px", marginBottom: 10, background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.gold}` }}>
                <div style={{ fontSize: 13.5, color: C.text, lineHeight: 1.65, fontStyle: "italic" }}>{s}</div>
              </div>
            ))}
            <div style={{ padding: 14, background: C.accentGlow, borderRadius: 10, border: `1px solid ${C.border}`, marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.gold, marginBottom: 6 }}>What These Communicate</div>
              <div style={{ fontSize: 12.5, color: C.textDim, lineHeight: 1.7 }}>Elegance over power · Old World over New World · Cool climate over warm · Mineral over fruit · Transparency over extraction</div>
            </div>
            <div style={{ padding: 14, background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.gold, marginBottom: 6 }}>Your Palate in One Sentence</div>
              <div style={{ fontSize: 13.5, color: C.text, lineHeight: 1.65, fontStyle: "italic" }}>{PALATE_CORE.oneSentence}</div>
            </div>
          </div>
        )}
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
