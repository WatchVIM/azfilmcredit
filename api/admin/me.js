import { requireAdmin } from "./_auth";

export default async function handler(req, res) {
  const admin = requireAdmin(req);
  if (!admin) return res.status(401).json({ ok: false });
  return res.status(200).json({ ok: true });
}
