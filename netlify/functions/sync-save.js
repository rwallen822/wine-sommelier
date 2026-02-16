import { getStore } from "@netlify/blobs";

export default async (req, context) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body = await req.json();
    const store = getStore({ name: "wine-data", consistency: "strong" });
    await store.setJSON("user-data", {
      ...body,
      updatedAt: new Date().toISOString(),
    });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Failed to save" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
