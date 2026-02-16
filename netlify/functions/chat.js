export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "API key not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();

    // Force streaming to prevent Netlify function inactivity timeout.
    // The SSE chunks keep the connection alive so the 10s idle limit is never hit.
    body.stream = true;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    // If Anthropic returned an error, pass it through as JSON
    if (!response.ok) {
      const errorBody = await response.text();
      return new Response(errorBody, {
        status: response.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Stream the SSE response through to the client
    return new Response(response.body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Failed to call API" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
