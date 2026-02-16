import { useState, useEffect, useRef, useCallback } from "react";
import { C } from "./theme";
import { buildSystemPrompt } from "./systemPrompt";
import { getMessages, saveMessages, addTastingEntry, addPalateNote } from "./storage";

const DEFAULT_GREETING = { role: "assistant", text: "Hey Rich. What are we drinking tonight? Send me a photo or tell me what's in the glass." };

function parseAndStripTags(text) {
  let cleanText = text;
  const tastingMatch = text.match(/<!--TASTING:(.*?)-->/s);
  const palateMatch = text.match(/<!--PALATE:(.*?)-->/s);

  if (tastingMatch) {
    try {
      const entry = JSON.parse(tastingMatch[1]);
      addTastingEntry(entry);
    } catch {}
    cleanText = cleanText.replace(tastingMatch[0], "").trim();
  }

  if (palateMatch) {
    try {
      const data = JSON.parse(palateMatch[1]);
      addPalateNote(data.text);
    } catch {}
    cleanText = cleanText.replace(palateMatch[0], "").trim();
  }

  return cleanText;
}

export default function ChatTab({ syncKey }) {
  const [messages, setMessages] = useState(() => {
    const stored = getMessages();
    return stored.length > 0 ? stored : [DEFAULT_GREETING];
  });
  const [input, setInput] = useState("");
  const [pendingImage, setPendingImage] = useState(null);
  const [pendingImageData, setPendingImageData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("deep"); // "quick" = Sonnet, "deep" = Opus

  const models = {
    quick: "claude-sonnet-4-20250514",
    deep: "claude-opus-4-5-20251101"
  };
  const chatEndRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Re-read messages from localStorage after cloud sync completes
  useEffect(() => {
    if (syncKey > 0) {
      const stored = getMessages();
      if (stored.length > 0) {
        setMessages(stored);
      }
    }
  }, [syncKey]);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      // Don't save images to localStorage (too large), just save text
      const toSave = messages.map(m => ({ role: m.role, text: m.text }));
      saveMessages(toSave);
    }
  }, [messages]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text && !pendingImageData) return;

    const userMsg = { role: "user", text: text || "(photo)", image: pendingImage || null };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    const imgData = pendingImageData;
    setPendingImage(null);
    setPendingImageData(null);
    setLoading(true);

    try {
      const apiMessages = newMessages.filter(m => m.role !== "system").map(m => {
        if (m.role === "user" && m.image && m === userMsg && imgData) {
          const content = [];
          content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: imgData } });
          content.push({ type: "text", text: text || "What do you think of this bottle? Give me your honest assessment." });
          return { role: "user", content };
        }
        return { role: m.role, content: m.text };
      });

      const trimmed = apiMessages.length > 12 ? apiMessages.slice(-12) : apiMessages;

      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: models[mode],
          max_tokens: 1000,
          system: buildSystemPrompt(),
          messages: trimmed,
        })
      });
      const data = await resp.json();
      if (data.error) {
        throw new Error(data.error.message || data.error || "API error");
      }
      const rawReply = data.content?.map(i => i.text || "").filter(Boolean).join("\n") || "No response from API";
      const reply = parseAndStripTags(rawReply);
      setMessages(prev => [...prev, { role: "assistant", text: reply }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", text: `Error: ${err.message}` }]);
    }
    setLoading(false);
  }, [input, pendingImageData, pendingImage, messages, mode]);

  const handleImage = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPendingImage(ev.target.result);
      setPendingImageData(ev.target.result.split(",")[1]);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 70px)", position: "relative" }}>
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 0", WebkitOverflowScrolling: "touch" }}>
        {messages.map((m, i) => (
          <div key={i} style={{ padding: "4px 0" }}>
            <div style={{
              maxWidth: "85%",
              marginLeft: m.role === "user" ? "auto" : 0,
              marginRight: m.role === "user" ? 0 : "auto",
              padding: "12px 16px",
              borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
              background: m.role === "user" ? C.chatUser : C.chatBot,
              border: m.role === "user" ? "none" : `1px solid ${C.border}`,
              boxShadow: m.role === "user" ? "none" : "0 1px 3px rgba(0,0,0,0.06)",
            }}>
              {m.image && (
                <img src={m.image} alt="" style={{ maxWidth: "100%", maxHeight: 200, borderRadius: 8, marginBottom: m.text && m.text !== "(photo)" ? 8 : 0, display: "block" }} />
              )}
              {m.text && m.text !== "(photo)" && (
                <div style={{ fontSize: 14, lineHeight: 1.6, color: m.role === "user" ? "#FFFFFF" : C.text, whiteSpace: "pre-wrap" }}>{m.text}</div>
              )}
            </div>
            <div style={{ fontSize: 9, color: C.textFaint, marginTop: 2, textAlign: m.role === "user" ? "right" : "left", paddingLeft: m.role === "user" ? 0 : 4, paddingRight: m.role === "user" ? 4 : 0 }}>
              {m.role === "user" ? "you" : "sommelier"}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ padding: "4px 0" }}>
            <div style={{ maxWidth: "85%", padding: "14px 16px", borderRadius: "18px 18px 18px 4px", background: C.chatBot, border: `1px solid ${C.border}`, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
              <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                {[0, 1, 2].map(d => (
                  <div key={d} style={{
                    width: 8, height: 8, borderRadius: "50%", background: C.accent,
                    animation: `dotPulse 1.2s ${d * 0.2}s infinite`,
                  }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {pendingImage && (
        <div style={{ padding: "8px 4px", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ position: "relative" }}>
            <img src={pendingImage} alt="" style={{ height: 52, width: 52, objectFit: "cover", borderRadius: 8, border: `1px solid ${C.border}` }} />
            <button
              onClick={() => { setPendingImage(null); setPendingImageData(null); }}
              style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: "50%", background: C.red, border: "none", color: "#fff", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}
            >×</button>
          </div>
          <div style={{ fontSize: 12, color: C.textDim, fontStyle: "italic" }}>Photo attached — add a message or just send</div>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 0", borderTop: `1px solid ${C.border}` }}>
        <button
          onClick={() => setMode(mode === "quick" ? "deep" : "quick")}
          style={{
            padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600,
            background: mode === "deep" ? C.accent : C.card,
            color: mode === "deep" ? "#FFFFFF" : C.textDim,
            border: `1px solid ${mode === "deep" ? C.accent : C.border}`,
            cursor: "pointer", transition: "all 0.15s",
          }}
        >
          {mode === "deep" ? "Deep" : "Quick"}
        </button>
        <span style={{ fontSize: 11, color: C.textFaint }}>
          {mode === "deep" ? "Opus — thorough" : "Sonnet — fast"}
        </span>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", padding: "8px 0 8px" }}>
        <button
          onClick={() => fileRef.current?.click()}
          style={{ width: 44, height: 44, borderRadius: 22, background: C.card, border: `1px solid ${C.border}`, color: C.accent, fontSize: 20, cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
        >📷</button>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleImage} style={{ display: "none" }} />
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="What are we drinking?"
          rows={1}
          style={{
            flex: 1, padding: "12px 16px", borderRadius: 22, border: `1px solid ${C.border}`,
            background: C.card, color: C.text, fontSize: 15, fontFamily: "inherit",
            resize: "none", outline: "none", lineHeight: 1.4, maxHeight: 80,
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          }}
        />
        <button
          onClick={sendMessage}
          disabled={loading || (!input.trim() && !pendingImageData)}
          style={{
            width: 44, height: 44, borderRadius: 22,
            background: (input.trim() || pendingImageData) ? C.accent : C.border,
            border: "none", color: "#FFFFFF", fontSize: 18, cursor: "pointer", flexShrink: 0,
            opacity: loading ? 0.5 : 1, display: "flex", alignItems: "center", justifyContent: "center",
            transition: "background 0.15s",
          }}
        >↑</button>
      </div>

      <style>{`
        @keyframes dotPulse {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
