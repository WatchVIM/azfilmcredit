import { requireAdmin } from "./_auth";
import { updateOrder } from "./_store";

export default async function handler(req, res) {
  const admin = requireAdmin(req);
  if (!admin) return res.status(401).json({ error: "Unauthorized" });
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { trackingNumber, status, notes, assignedTo } = req.body || {};
  if (!trackingNumber) return res.status(400).json({ error: "Missing trackingNumber" });

  const updated = updateOrder(trackingNumber, {
    status,
    adminNotes: notes,
    assignedTo
  });

  if (!updated) return res.status(404).json({ error: "Order not found" });
  return res.status(200).json({ success: true, order: updated });
}
