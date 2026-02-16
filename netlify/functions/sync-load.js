import { getStore } from "@netlify/blobs";

export default async (req) => {
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const store = getStore({ name: "wine-data", consistency: "strong" });
    const data = await store.get("user-data", { type: "json" });

    return new Response(JSON.stringify(data || { messages: [], tastings: [], palate: [] }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ messages: [], tastings: [], palate: [] }), {
      headers: { "Content-Type": "application/json" },
    });
  }
};
