import { requireAdmin } from "./_auth";

export default async function handler(req, res) {
  const admin = requireAdmin(req);
  if (!admin) return res.status(401).json({ error: "Unauthorized" });

  // TODO: load orders from your DB/storage
  return res.status(200).json({ success: true, orders: [] });
}
