// /api/_lib/store.js

const memory = new Map();

function getKvConfig() {
  // Prefer Vercel KV vars if present
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    return { url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN };
  }
  // Otherwise Upstash REST vars
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    return { url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN };
  }
  return null;
}

async function restKv(cmdParts) {
  const cfg = getKvConfig();
  if (!cfg) return null;

  const endpoint = `${cfg.url}/${cmdParts.map(encodeURIComponent).join("/")}`;
  const res = await fetch(endpoint, { headers: { Authorization: `Bearer ${cfg.token}` } });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`KV error: ${res.status} ${text}`);
  }
  const data = await res.json();
  return data?.result ?? null;
}

export async function putJSON(key, value, ttlSeconds = 60 * 60 * 24 * 30) {
  const cfg = getKvConfig();
  if (!cfg) {
    memory.set(key, { value, exp: Date.now() + ttlSeconds * 1000 });
    return true;
  }
  // SET key JSON PX ms
  await restKv(["SET", key, JSON.stringify(value), "PX", String(ttlSeconds * 1000)]);
  return true;
}

export async function getJSON(key) {
  const cfg = getKvConfig();
  if (!cfg) {
    const item = memory.get(key);
    if (!item) return null;
    if (Date.now() > item.exp) {
      memory.delete(key);
      return null;
    }
    return item.value;
  }
  const raw = await restKv(["GET", key]);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function delKey(key) {
  const cfg = getKvConfig();
  if (!cfg) {
    memory.delete(key);
    return true;
  }
  await restKv(["DEL", key]);
  return true;
}
