import { useState } from "react";
import { C } from "./theme";
import { GRAPE_GUIDE, REGIONS, BORDEAUX_GUIDE, LABEL_TIPS, SHOP_SCRIPTS, PALATE_CORE } from "./palateConfig";
import ChatTab from "./ChatTab";

function App() {
  const [tab, setTab] = useState("chat");
  const [expandedRegion, setExpandedRegion] = useState(null);
  const [expandedBdx, setExpandedBdx] = useState(null);

  const tabs = [
    { id: "chat", label: "Chat", icon: "💬" },
    { id: "grapes", label: "Grapes", icon: "🍇" },
    { id: "regions", label: "Regions", icon: "🗺" },
    { id: "bordeaux", label: "Bdx", icon: "🏰" },
    { id: "labels", label: "Labels", icon: "🏷" },
    { id: "talk", label: "Scripts", icon: "🗣" },
  ];

  const safetyColor = (s) => s === "always" ? C.green : s === "sometimes" ? C.gold : C.red;
  const safetyBg = (s) => s === "always" ? C.greenBg : s === "sometimes" ? C.yellowBg : C.redBg;
  const tierColor = (t) => t === "goldmine" ? C.gold : t === "good" ? C.green : C.accentLight;
  const tierLabel = (t) => t === "goldmine" ? "💰 GOLDMINE" : t === "good" ? "👍 GOOD BET" : "💎 SPLURGE";

  return (
    <div style={{ background: C.bg, minHeight: "100vh", maxWidth: 480, margin: "0 auto", fontFamily: "'Cormorant Garamond', Georgia, serif", color: C.text, position: "relative", paddingBottom: 72 }}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,500&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ padding: "20px 16px 12px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: 4, color: C.goldDim, textTransform: "uppercase", fontWeight: 500 }}>Personal Sommelier</div>
          <div style={{ fontSize: 24, fontWeight: 300, letterSpacing: 1, color: C.gold, lineHeight: 1.1 }}>Rich's Wine Guide</div>
        </div>
        <div style={{ fontSize: 11, color: C.textFaint, fontStyle: "italic", textAlign: "right", lineHeight: 1.3 }}>texture & finesse<br />wines that glide</div>
      </div>

      {/* Content */}
      <div style={{ padding: tab === "chat" ? "8px 16px 0" : "16px 16px 0" }}>

        {tab === "chat" && <ChatTab />}

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

      {/* Bottom Nav */}
      <div style={{
        position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: "100%", maxWidth: 480, background: C.bg,
        borderTop: `1px solid ${C.border}`,
        display: "flex", justifyContent: "space-around",
        padding: "6px 0 env(safe-area-inset-bottom, 8px)", zIndex: 100,
      }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); if (t.id !== "chat") window.scrollTo(0, 0); }}
            style={{
              background: "none", border: "none", padding: "6px 4px", cursor: "pointer",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
              opacity: tab === t.id ? 1 : 0.45, transition: "opacity 0.15s", minWidth: 0, flex: 1,
            }}>
            <span style={{ fontSize: 18 }}>{t.icon}</span>
            <span style={{ fontSize: 9.5, color: tab === t.id ? C.gold : C.textDim, fontFamily: "inherit", letterSpacing: 0.5, fontWeight: tab === t.id ? 600 : 400 }}>{t.label}</span>
          </button>
        ))}
      </div>

      <style>{`
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        ::-webkit-scrollbar { display: none; }
        body { margin: 0; background: ${C.bg}; }
        textarea::placeholder { color: ${C.textFaint}; font-family: 'Cormorant Garamond', Georgia, serif; }
      `}</style>
    </div>
  );
}

export default App;
