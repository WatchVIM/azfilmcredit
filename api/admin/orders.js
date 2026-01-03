import { listOrders } from "../_lib/kv.js";
import { requireAdmin } from "../_lib/auth.js";

export default async function handler(req, res) {
  if (!requireAdmin(req)) return res.status(401).json({ success: false, message: "Unauthorized" });

  const orders = await listOrders(200);
  return res.status(200).json({ success: true, orders });
}
