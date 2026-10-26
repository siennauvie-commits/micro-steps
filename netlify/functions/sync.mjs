// micro steps sync: stores one small JSON doc per sync code in Netlify Blobs.
// Each section (current, settings, saved) carries a timestamp "t"; newest wins.
import { getStore } from "@netlify/blobs";

const CODE = /^[A-HJ-NP-Z2-9]{8}$/;
const SECTIONS = ["current", "settings", "saved"];
const MAX_BYTES = 300000;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export default async (req) => {
  const url = new URL(req.url);
  if (url.searchParams.get("ping")) return json({ ok: true });

  const code = (url.searchParams.get("code") || "").toUpperCase();
  if (!CODE.test(code)) return json({ error: "bad code" }, 400);

  const store = getStore({ name: "micro-steps", consistency: "strong" });
  const key = "sync/" + code;

  if (req.method === "GET") {
    const doc = await store.get(key, { type: "json" });
    if (!doc) return json({ error: "not found" }, 404);
    return json({ doc });
  }

  if (req.method === "PUT") {
    const text = await req.text();
    if (text.length > MAX_BYTES) return json({ error: "too big" }, 413);
    let incoming;
    try { incoming = JSON.parse(text); } catch { return json({ error: "bad json" }, 400); }

    const doc = (await store.get(key, { type: "json" })) || {};
    for (const s of SECTIONS) {
      const v = incoming && incoming[s];
      if (v && typeof v.t === "number" && v.d && typeof v.d === "object" && (!doc[s] || v.t > doc[s].t)) {
        doc[s] = { t: v.t, d: v.d };
      }
    }
    await store.setJSON(key, doc);
    return json({ doc });
  }

  return json({ error: "method not allowed" }, 405);
};

export const config = { path: "/api/sync" };
