import { useState, useEffect, useRef, useCallback } from "react";
import { C } from "./theme";
import { Camera, ArrowUp, X } from "lucide-react";
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
  const [pendingMediaType, setPendingMediaType] = useState("image/jpeg");
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const MODEL = "claude-sonnet-4-6";
  const chatEndRef = useRef(null);
  const fileRef = useRef(null);

  // Scroll to bottom on new messages or loading state change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Scroll during streaming (throttled via React batching)
  useEffect(() => {
    if (streamingText) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [streamingText]);

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

  // --- SSE Stream Parser ---
  // Reads the fetch Response as an SSE stream, reconstructs the full message object,
  // and calls onDelta for each text chunk so we can show streaming text in the UI.
  const parseSSEStream = async (resp, onDelta) => {
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();

    const message = { content: [], stop_reason: null };
    const contentBlocks = [];
    const inputJsonBuffers = {}; // index -> accumulated partial JSON for tool_use inputs
    let buffer = "";

    // Process a single SSE line
    const processLine = (line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("event:")) return;
      if (!trimmed.startsWith("data: ")) return;

      const jsonStr = trimmed.slice(6);
      try {
        const event = JSON.parse(jsonStr);

        switch (event.type) {
          case "message_start":
            message.id = event.message.id;
            message.model = event.message.model;
            break;

          case "content_block_start":
            contentBlocks[event.index] = { ...event.content_block };
            if (event.content_block.type === "tool_use") {
              inputJsonBuffers[event.index] = "";
            }
            break;

          case "content_block_delta":
            if (event.delta.type === "text_delta") {
              contentBlocks[event.index].text =
                (contentBlocks[event.index].text || "") + event.delta.text;
              if (onDelta) onDelta(event.delta.text);
            } else if (event.delta.type === "input_json_delta") {
              inputJsonBuffers[event.index] =
                (inputJsonBuffers[event.index] || "") + event.delta.partial_json;
            }
            break;

          case "content_block_stop":
            if (
              contentBlocks[event.index]?.type === "tool_use" &&
              inputJsonBuffers[event.index] != null
            ) {
              try {
                contentBlocks[event.index].input = JSON.parse(
                  inputJsonBuffers[event.index] || "{}"
                );
              } catch {
                console.error("[stream] Failed to parse tool input:", inputJsonBuffers[event.index]?.slice(0, 200));
                contentBlocks[event.index].input = {};
              }
            }
            break;

          case "message_delta":
            if (event.delta?.stop_reason) {
              message.stop_reason = event.delta.stop_reason;
            }
            break;

          case "error":
            throw new Error(event.error?.message || "Stream error from API");

          default:
            break; // ping, message_stop, etc.
        }
      } catch (e) {
        if (e.message?.includes("Stream error")) throw e;
        // Skip unparseable SSE lines
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        // Flush decoder and process any remaining data in buffer
        buffer += decoder.decode();
        if (buffer.trim()) {
          const remaining = buffer.split("\n");
          for (const line of remaining) processLine(line);
        }
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // keep incomplete line in buffer

      for (const line of lines) processLine(line);
    }

    message.content = contentBlocks.filter(Boolean);

    // Fallback: if stop_reason is null but content has tool_use blocks, infer it
    if (!message.stop_reason && message.content.some(b => b.type === "tool_use")) {
      console.warn("[stream] stop_reason was null but tool_use blocks found — inferring stop_reason: tool_use");
      message.stop_reason = "tool_use";
    }

    return message;
  };

  // --- Compact old tool results to reduce token usage in multi-step tool loops ---
  // Replaces full data in earlier tool_result messages with short summaries.
  // The AI already consumed the data in previous iterations, so it only needs
  // the most recent tool result in full.
  const compactToolHistory = (messages) => {
    // Find indices of user messages containing tool_result blocks
    const toolResultIndices = [];
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (msg.role === "user" && Array.isArray(msg.content) && msg.content.some(b => b.type === "tool_result")) {
        toolResultIndices.push(i);
      }
    }
    // Nothing to compact if 1 or fewer tool result messages
    if (toolResultIndices.length <= 1) return messages;

    // Compact all but the most recent tool_result message
    const lastIdx = toolResultIndices[toolResultIndices.length - 1];
    return messages.map((msg, i) => {
      if (!toolResultIndices.includes(i) || i === lastIdx) return msg;
      return {
        ...msg,
        content: msg.content.map(block => {
          if (block.type !== "tool_result") return block;
          try {
            const parsed = JSON.parse(block.content);
            return { ...block, content: JSON.stringify({ success: parsed.success, message: parsed.message }) };
          } catch {
            return { ...block, content: JSON.stringify({ success: true, message: "(compacted)" }) };
          }
        }),
      };
    });
  };

  // --- API call helper (now streaming, with 429 retry) ---
  const callAPI = useCallback(async (apiMessages, maxTokens = 4096, onDelta) => {
    const requestBody = {
      model: MODEL,
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
    });

    const doFetch = () => fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    let resp = await doFetch();

    // Auto-retry once on 429 (rate limit) after a short wait
    if (resp.status === 429) {
      const wait = Math.min(parseInt(resp.headers.get("retry-after") || "8", 10), 30);
      console.warn(`[chat] Rate limited (429). Waiting ${wait}s before retry...`);
      await new Promise(r => setTimeout(r, wait * 1000));
      resp = await doFetch();
    }

    const contentType = resp.headers.get("content-type") || "";

    // Non-streaming response (error from Netlify function or Anthropic)
    if (!contentType.includes("text/event-stream")) {
      const responseText = await resp.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch {
        console.error("[chat] Failed to parse response:", responseText.slice(0, 500));
        throw new Error(`API returned invalid response (status ${resp.status})`);
      }
      if (data.error) {
        const msg = typeof data.error === "string" ? data.error : data.error.message || JSON.stringify(data.error);
        throw new Error(msg);
      }
      // Fallback: non-streaming response (shouldn't normally happen)
      console.log("[chat] Non-streaming response (fallback):", { stop_reason: data.stop_reason });
      return data;
    }

    // Parse SSE stream
    const message = await parseSSEStream(resp, onDelta);

    console.log("[chat] Stream complete:", {
      stop_reason: message.stop_reason,
      contentTypes: message.content.map(b => b.type),
      textLength: message.content.filter(b => b.type === "text").reduce((sum, b) => sum + (b.text?.length || 0), 0),
      toolUseCount: message.content.filter(b => b.type === "tool_use").length,
    });

    return message;
  }, []);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text && !pendingImageData) return;

    const userMsg = { role: "user", text: text || "(photo)", image: pendingImage || null };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    const imgData = pendingImageData;
    const mediaType = pendingMediaType;
    setPendingImage(null);
    setPendingImageData(null);
    setPendingMediaType("image/jpeg");
    setLoading(true);
    setStreamingText("");

    try {
      // Build API messages (exclude system tool confirmations)
      const buildApiMessages = (msgs) => {
        const filtered = msgs.filter(m => m.role !== "system");
        return filtered.map((m, i) => {
          if (m.role === "user" && m.image && i === filtered.length - 1 && imgData) {
            return {
              role: "user",
              content: [
                { type: "image", source: { type: "base64", media_type: mediaType, data: imgData } },
                { type: "text", text: text || "What do you think of this bottle? Give me your honest assessment." },
              ],
            };
          }
          return { role: m.role, content: m.text };
        });
      };

      let apiMessages = buildApiMessages(newMessages);
      const trimmed = apiMessages.length > 12 ? apiMessages.slice(-12) : apiMessages;

      // Initial call — stream text to UI
      let response = await callAPI(trimmed, 4096, (delta) => {
        setStreamingText(prev => prev + delta);
      });

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

            // For tool results with large data, truncate if needed
            let resultContent = JSON.stringify(result);
            if (resultContent.length > 50000) {
              console.warn(`[chat] Tool result very large (${resultContent.length} chars), summarizing`);
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

        // Clear streaming text before next API call
        setStreamingText("");

        // Compact older tool results to keep token count low
        const compacted = compactToolHistory(loopMessages);
        console.log(`[chat] Compacted tool history: ${loopMessages.length} msgs, trimmed old results`);

        // Use higher token limit for tool loop follow-ups
        response = await callAPI(compacted, 8192, (delta) => {
          setStreamingText(prev => prev + delta);
        });
      }

      if (loops >= MAX_TOOL_LOOPS) {
        console.warn("[chat] Hit max tool loop limit");
      }

      if (response.stop_reason === "max_tokens") {
        console.warn("[chat] Response truncated (max_tokens).");
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
    setStreamingText("");
    setLoading(false);
  }, [input, pendingImageData, pendingImage, messages, callAPI, onDataUpdated]);

  const handleImage = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const mediaType = file.type || "image/jpeg";
    console.log("[chat] Image selected:", { name: file.name, type: file.type, size: file.size, mediaType });
    setPendingMediaType(mediaType);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPendingImage(ev.target.result);
      setPendingImageData(ev.target.result.split(",")[1]);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }, []);

  // Enter always inserts a newline — only the send button triggers sendMessage()

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100dvh - 70px - 72px)", position: "relative" }}>
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

        {/* Loading / streaming indicator */}
        {loading && (
          <div style={{ padding: "4px 0" }}>
            <div style={{
              maxWidth: "85%",
              padding: "14px 16px",
              borderRadius: "18px 18px 18px 4px",
              background: C.chatBot,
              border: `1px solid ${C.border}`,
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            }}>
              {streamingText ? (
                <div style={{ fontSize: 14, lineHeight: 1.6, color: C.text, whiteSpace: "pre-wrap" }}>
                  {streamingText}
                  <span style={{
                    display: "inline-block",
                    width: 2,
                    height: 14,
                    background: C.accent,
                    marginLeft: 1,
                    verticalAlign: "text-bottom",
                    animation: "cursorBlink 0.8s step-end infinite",
                  }} />
                </div>
              ) : (
                <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                  {[0, 1, 2].map(d => (
                    <div key={d} style={{
                      width: 8, height: 8, borderRadius: "50%", background: C.accent,
                      animation: `dotPulse 1.2s ${d * 0.2}s infinite`,
                    }} />
                  ))}
                </div>
              )}
            </div>
            {streamingText && (
              <div style={{ fontSize: 9, color: C.textFaint, marginTop: 2, paddingLeft: 4 }}>
                sommelier
              </div>
            )}
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Bottom controls — pinned, never scroll */}
      <div style={{ flexShrink: 0, paddingBottom: 0 }}>
        {pendingImage && (
          <div style={{ padding: "8px 4px", display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ position: "relative" }}>
              <img src={pendingImage} alt="" style={{ height: 52, width: 52, objectFit: "cover", borderRadius: 8, border: `1px solid ${C.border}` }} />
              <button
                onClick={() => { setPendingImage(null); setPendingImageData(null); setPendingMediaType("image/jpeg"); }}
                style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: "50%", background: C.red, border: "none", color: "#fff", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}
              ><X size={10} strokeWidth={2.5} /></button>
            </div>
            <div style={{ fontSize: 12, color: C.textDim, fontStyle: "italic" }}>Photo attached</div>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", padding: "8px 0 8px", borderTop: `1px solid ${C.border}` }}>
          <button
            onClick={() => fileRef.current?.click()}
            style={{ width: 44, height: 44, borderRadius: 22, background: C.card, border: `1px solid ${C.border}`, color: C.accent, cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
          ><Camera size={20} strokeWidth={1.8} /></button>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleImage} style={{ display: "none" }} />
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="What are we drinking?"
            rows={1}
            style={{
              flex: 1, padding: "12px 16px", borderRadius: 22, border: `1px solid ${C.border}`,
              background: C.card, color: C.text, fontSize: 15, fontFamily: "inherit",
              resize: "none", outline: "none", lineHeight: 1.4, maxHeight: 120,
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            }}
          />
          <button
            onClick={sendMessage}
            disabled={loading || (!input.trim() && !pendingImageData)}
            style={{
              width: 44, height: 44, borderRadius: 22,
              background: (input.trim() || pendingImageData) ? C.accent : C.border,
              border: "none", color: "#FFFFFF", cursor: "pointer", flexShrink: 0,
              opacity: loading ? 0.5 : 1, display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.15s",
            }}
          ><ArrowUp size={18} strokeWidth={2.5} /></button>
        </div>
        <div style={{ fontSize: 10, color: C.textFaint, textAlign: "center", paddingBottom: 2 }}>Landscape photos work best for shelf scanning</div>
      </div>

      <style>{`
        @keyframes dotPulse {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
        @keyframes cursorBlink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
