import { useState, useEffect, useRef, useCallback } from "react";
import { C } from "./theme";
import { buildSystemPrompt } from "./systemPrompt";

export default function ChatTab() {
  const [messages, setMessages] = useState([
    { role: "assistant", text: "Hey Rich. What are we drinking tonight? Send me a photo or tell me what's in the glass." }
  ]);
  const [input, setInput] = useState("");
  const [pendingImage, setPendingImage] = useState(null);
  const [pendingImageData, setPendingImageData] = useState(null);
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

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

      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: buildSystemPrompt(),
          messages: trimmed,
        })
      });
      const data = await resp.json();
      const reply = data.content?.map(i => i.text || "").filter(Boolean).join("\n") || "Sorry, couldn't process that. Try again?";
      setMessages(prev => [...prev, { role: "assistant", text: reply }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", text: "Connection issue — try again in a sec." }]);
    }
    setLoading(false);
  }, [input, pendingImageData, pendingImage, messages]);

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
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 140px)", position: "relative" }}>
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 0", WebkitOverflowScrolling: "touch" }}>
        {messages.map((m, i) => (
          <div key={i} style={{ padding: "4px 0" }}>
            <div style={{
              maxWidth: "85%",
              marginLeft: m.role === "user" ? "auto" : 0,
              marginRight: m.role === "user" ? 0 : "auto",
              padding: "10px 14px",
              borderRadius: m.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
              background: m.role === "user" ? C.chatUser : C.chatBot,
              border: `1px solid ${m.role === "user" ? "rgba(201,168,76,0.15)" : C.border}`,
            }}>
              {m.image && (
                <img src={m.image} alt="" style={{ maxWidth: "100%", maxHeight: 200, borderRadius: 8, marginBottom: m.text && m.text !== "(photo)" ? 8 : 0, display: "block" }} />
              )}
              {m.text && m.text !== "(photo)" && (
                <div style={{ fontSize: 13.5, lineHeight: 1.6, color: C.text, whiteSpace: "pre-wrap" }}>{m.text}</div>
              )}
            </div>
            <div style={{ fontSize: 9, color: C.textFaint, marginTop: 2, textAlign: m.role === "user" ? "right" : "left", paddingLeft: m.role === "user" ? 0 : 4, paddingRight: m.role === "user" ? 4 : 0 }}>
              {m.role === "user" ? "you" : "sommelier"}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ padding: "4px 0" }}>
            <div style={{ maxWidth: "85%", padding: "12px 14px", borderRadius: "14px 14px 14px 4px", background: C.chatBot, border: `1px solid ${C.border}` }}>
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                {[0, 1, 2].map(d => (
                  <div key={d} style={{
                    width: 6, height: 6, borderRadius: "50%", background: C.goldDim,
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

      <div style={{ display: "flex", gap: 8, alignItems: "flex-end", padding: "8px 0 4px", borderTop: `1px solid ${C.border}` }}>
        <button
          onClick={() => fileRef.current?.click()}
          style={{ width: 40, height: 40, borderRadius: 10, background: C.card, border: `1px solid ${C.border}`, color: C.gold, fontSize: 18, cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
        >📷</button>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleImage} style={{ display: "none" }} />
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="What are we drinking?"
          rows={1}
          style={{
            flex: 1, padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.border}`,
            background: C.card, color: C.text, fontSize: 14, fontFamily: "inherit",
            resize: "none", outline: "none", lineHeight: 1.4, maxHeight: 80,
          }}
        />
        <button
          onClick={sendMessage}
          disabled={loading || (!input.trim() && !pendingImageData)}
          style={{
            width: 40, height: 40, borderRadius: 10,
            background: (input.trim() || pendingImageData) ? C.gold : C.border,
            border: "none", color: C.bg, fontSize: 16, cursor: "pointer", flexShrink: 0,
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
