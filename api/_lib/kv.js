import { kv } from "@vercel/kv";

export async function saveOrder(order) {
  await kv.set(`order:${order.tracking}`, order);
  await kv.lpush("orders:all", order.tracking);
}

export async function getOrder(tracking) {
  return await kv.get(`order:${tracking}`);
}

export async function updateOrder(tracking, patch) {
  const existing = await getOrder(tracking);
  if (!existing) return null;
  const updated = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  await kv.set(`order:${tracking}`, updated);
  return updated;
}

export async function listOrders(limit = 100) {
  const ids = await kv.lrange("orders:all", 0, limit - 1);
  const orders = [];
  for (const id of ids) {
    const o = await kv.get(`order:${id}`);
    if (o) orders.push(o);
  }
  // newest first
  orders.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return orders;
}
