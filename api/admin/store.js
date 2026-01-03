import fs from "fs";
import path from "path";

const FILE = path.join("/tmp", "azfc_orders.json");

export function readOrders() {
  try {
    if (!fs.existsSync(FILE)) return [];
    const raw = fs.readFileSync(FILE, "utf8");
    return JSON.parse(raw || "[]");
  } catch {
    return [];
  }
}

export function writeOrders(orders) {
  fs.writeFileSync(FILE, JSON.stringify(orders, null, 2), "utf8");
}

export function upsertOrder(order) {
  const orders = readOrders();
  const idx = orders.findIndex(o => o.trackingNumber === order.trackingNumber);
  if (idx >= 0) orders[idx] = { ...orders[idx], ...order };
  else orders.unshift(order);
  writeOrders(orders);
  return order;
}

export function updateOrder(trackingNumber, patch) {
  const orders = readOrders();
  const idx = orders.findIndex(o => o.trackingNumber === trackingNumber);
  if (idx === -1) return null;
  orders[idx] = { ...orders[idx], ...patch, updatedAt: new Date().toISOString() };
  writeOrders(orders);
  return orders[idx];
}
