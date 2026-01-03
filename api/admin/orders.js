import { requireAdmin } from "./_auth";
import { readOrders } from "./_store";

export default async function handler(req, res) {
  const admin = requireAdmin(req);
  if (!admin) return res.status(401).json({ error: "Unauthorized" });

  const orders = readOrders();
  return res.status(200).json({ success: true, orders });
}
