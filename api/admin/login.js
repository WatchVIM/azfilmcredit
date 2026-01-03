import { makeAdminCookie } from "./_auth";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { password } = req.body || {};
  if (!password) return res.status(400).json({ error: "Missing password" });

  const adminPass = process.env.ADMIN_PASSWORD;
  if (!adminPass) return res.status(500).json({ error: "Missing ADMIN_PASSWORD env var" });

  if (password !== adminPass) return res.status(401).json({ error: "Invalid password" });

  res.setHeader("Set-Cookie", makeAdminCookie());
  return res.status(200).json({ success: true });
}
