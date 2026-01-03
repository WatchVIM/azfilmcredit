import { requireAdmin } from "./_auth";
import { readOrders } from "./_store";
import { notifyCustomerStatus } from "./_email";

export default async function handler(req, res) {
  const admin = requireAdmin(req);
  if (!admin) return res.status(401).json({ error: "Unauthorized" });
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { trackingNumber } = req.body || {};
  if (!trackingNumber) return res.status(400).json({ error: "Missing trackingNumber" });

  const order = readOrders().find(o => o.trackingNumber === trackingNumber);
  if (!order) return res.status(404).json({ error: "Order not found" });

  const r = await notifyCustomerStatus(order);
  return res.status(200).json({ success: true, result: r });
}
