import { useState, useEffect, useRef, useCallback } from "react";
import { C } from "./theme";
import { buildSystemPrompt } from "./systemPrompt";
import { getMessages, saveMessages } from "./storage";
import { TOOL_DEFINITIONS, executeToolCall } from "./toolDefinitions";

const DEFAULT_GREETING = { role: "assistant", text: "Hey Rich. What are we drinking tonight? Send me a photo or tell me what's in the glass." };
const MAX_TOOL_LOOPS = 8;

export default function ChatTab({ syncKey, onDataUpdated }) {
  const [messages, setMessages] = useState(() => {
    const stored = getMessages();
    return stored.length > 0 ? stored : [DEFAULT_GREETING];
  });
  const [input, setInput] = useState("");
  const [pendingImage, setPendingImage] = useState(null);
  const [pendingImageData, setPendingImageData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("deep");

  const models = {
    quick: "claude-sonnet-4-20250514",
    deep: "claude-opus-4-5-20251101"
  };
  const chatEndRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Re-read messages from localStorage after cloud sync
  useEffect(() => {
    if (syncKey > 0) {
      const stored = getMessages();
      if (stored.length > 0) setMessages(stored);
    }
  }, [syncKey]);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      const toSave = messages.map(m => ({ role: m.role, text: m.text }));
      saveMessages(toSave);
    }
  }, [messages]);

  // API call helper with logging
  const callAPI = useCallback(async (apiMessages, maxTokens = 4096) => {
    const requestBody = {
      model: models[mode],
      max_tokens: maxTokens,
      system: buildSystemPrompt(),
      messages: apiMessages,
      tools: TOOL_DEFINITIONS,
    };

    console.log("[chat] API request:", {
      model: requestBody.model,
      max_tokens: requestBody.max_tokens,
      messageCount: apiMessages.length,
      toolCount: TOOL_DEFINITIONS.length,
      lastMessage: apiMessages[apiMessages.length - 1],
    });

    const resp = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    const responseText = await resp.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseErr) {
      console.error("[chat] Failed to parse API response:", responseText.slice(0, 500));
      throw new Error(`API returned invalid JSON (status ${resp.status})`);
    }

    console.log("[chat] API response:", {
      status: resp.status,
      stop_reason: data.stop_reason,
      contentTypes: data.content?.map(b => b.type),
      error: data.error,
    });

    if (data.error) {
      console.error("[chat] API error detail:", data.error);
      const msg = typeof data.error === "string" ? data.error : data.error.message || JSON.stringify(data.error);
      throw new Error(msg);
    }

    return data;
  }, [mode]);

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
      // Build API messages (exclude system tool confirmations)
      const buildApiMessages = (msgs) => {
        return msgs
          .filter(m => m.role !== "system")
          .map((m, i) => {
            if (m.role === "user" && m.image && i === msgs.length - 1 && imgData) {
              return {
                role: "user",
                content: [
                  { type: "image", source: { type: "base64", media_type: "image/jpeg", data: imgData } },
                  { type: "text", text: text || "What do you think of this bottle? Give me your honest assessment." },
                ],
              };
            }
            return { role: m.role, content: m.text };
          });
      };

      let apiMessages = buildApiMessages(newMessages);
      const trimmed = apiMessages.length > 12 ? apiMessages.slice(-12) : apiMessages;

      // Tool use loop
      let response = await callAPI(trimmed);
      let toolConfirmations = [];
      let loopMessages = [...trimmed];
      let loops = 0;

      while (loops < MAX_TOOL_LOOPS) {
        // Check if the response wants tool use
        if (response.stop_reason !== "tool_use") break;

        // Guard: make sure content is an array with tool_use blocks
        if (!Array.isArray(response.content)) {
          console.warn("[chat] stop_reason is tool_use but content is not an array:", response.content);
          break;
        }

        const toolUseBlocks = response.content.filter(b => b.type === "tool_use");
        if (toolUseBlocks.length === 0) {
          console.warn("[chat] stop_reason is tool_use but no tool_use blocks found in content");
          break;
        }

        loops++;
        console.log(`[chat] Tool loop iteration ${loops}:`, toolUseBlocks.map(b => `${b.name}(${JSON.stringify(b.input).slice(0, 100)}...)`));

        const toolResults = [];

        for (const block of toolUseBlocks) {
          try {
            const result = executeToolCall(block.name, block.input);
            console.log(`[chat] Tool ${block.name} result:`, { success: result.success, message: result.message, hasData: !!result.data });

            // For tool results with large data (read_section), truncate if needed
            let resultContent = JSON.stringify(result);
            if (resultContent.length > 50000) {
              console.warn(`[chat] Tool result very large (${resultContent.length} chars), truncating data`);
              const truncated = { ...result, data: result.data, _note: "Full data included" };
              resultContent = JSON.stringify(truncated);
              // If still too large, summarize
              if (resultContent.length > 50000) {
                const summary = {
                  success: result.success,
                  message: result.message,
                  entryCount: Array.isArray(result.data) ? result.data.length : "object",
                  entries: Array.isArray(result.data)
                    ? result.data.map(e => ({ name: e.name || e.wine || e.flag || e.text, ...(e.safety && { safety: e.safety }), ...(e.tier && { tier: e.tier }) }))
                    : result.data,
                };
                resultContent = JSON.stringify(summary);
                console.log(`[chat] Summarized to ${resultContent.length} chars`);
              }
            }

            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: resultContent,
            });

            // Only show confirmations for write operations, not reads
            if (block.name !== "read_section") {
              toolConfirmations.push({
                role: "system",
                text: result.message,
                toolName: block.name,
              });
            }
          } catch (toolErr) {
            console.error(`[chat] Tool ${block.name} execution error:`, toolErr);
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: JSON.stringify({ success: false, message: `Tool error: ${toolErr.message}` }),
              is_error: true,
            });
          }
        }

        // Continue conversation with tool results
        loopMessages = [
          ...loopMessages,
          { role: "assistant", content: response.content },
          { role: "user", content: toolResults },
        ];

        // Use higher token limit for tool loop follow-ups (AI may need to generate large rewrite payloads)
        response = await callAPI(loopMessages, 8192);
      }

      if (loops >= MAX_TOOL_LOOPS) {
        console.warn("[chat] Hit max tool loop limit");
      }

      // Handle stop_reason === "max_tokens" — the response was cut off
      if (response.stop_reason === "max_tokens") {
        console.warn("[chat] Response truncated (max_tokens). Content:", response.content);
      }

      // Extract text from final response
      let replyText = "";
      if (Array.isArray(response.content)) {
        replyText = response.content
          .filter(b => b.type === "text")
          .map(b => b.text)
          .filter(Boolean)
          .join("\n");
      } else if (typeof response.content === "string") {
        replyText = response.content;
      }

      if (!replyText) {
        console.warn("[chat] No text in final response. stop_reason:", response.stop_reason, "content:", response.content);
        // If we got tool confirmations but no final text, provide a fallback
        if (toolConfirmations.length > 0) {
          replyText = "Done.";
        } else {
          replyText = "Sorry, I didn't get a response. Try again?";
        }
      }

      // Add confirmations + reply
      setMessages(prev => [
        ...prev,
        ...toolConfirmations,
        { role: "assistant", text: replyText },
      ]);

      // Notify parent if tools were executed
      if (toolConfirmations.length > 0 && onDataUpdated) {
        onDataUpdated();
      }
    } catch (err) {
      console.error("[chat] sendMessage error:", err);
      setMessages(prev => [...prev, { role: "assistant", text: `Error: ${err.message}` }]);
    }
    setLoading(false);
  }, [input, pendingImageData, pendingImage, messages, mode, callAPI, onDataUpdated]);

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
          <div key={i} style={{ padding: m.role === "system" ? "2px 0" : "4px 0" }}>
            {/* Tool confirmation (system message) */}
            {m.role === "system" && (
              <div style={{
                padding: "6px 12px",
                fontSize: 12,
                color: C.green,
                background: C.greenBg,
                borderRadius: 8,
                borderLeft: `3px solid ${C.green}`,
                fontWeight: 500,
                maxWidth: "85%",
              }}>
                {m.text}
              </div>
            )}
            {/* User or assistant message */}
            {m.role !== "system" && (
              <>
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
              </>
            )}
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
            >x</button>
          </div>
          <div style={{ fontSize: 12, color: C.textDim, fontStyle: "italic" }}>Photo attached</div>
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
          {mode === "deep" ? "Opus" : "Sonnet"}
        </span>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", padding: "8px 0 8px" }}>
        <button
          onClick={() => fileRef.current?.click()}
          style={{ width: 44, height: 44, borderRadius: 22, background: C.card, border: `1px solid ${C.border}`, color: C.accent, fontSize: 20, cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
        >{"\u{1F4F7}"}</button>
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
        >{"\u2191"}</button>
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
