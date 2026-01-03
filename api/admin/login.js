import crypto from "crypto";

function sign(payload, secret) {
  const h = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${h}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { password } = req.body || {};
  if (!password) return res.status(400).json({ error: "Missing password" });

  const adminPass = process.env.ADMIN_PASSWORD;
  const secret = process.env.ADMIN_SESSION_SECRET;

  if (!adminPass || !secret) {
    return res.status(500).json({ error: "Server missing ADMIN env vars" });
  }

  if (password !== adminPass) {
    return res.status(401).json({ error: "Invalid password" });
  }

  // 7-day session token
  const exp = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const payload = JSON.stringify({ role: "admin", exp });
  const token = sign(Buffer.from(payload).toString("base64url"), secret);

  res.setHeader(
    "Set-Cookie",
    [
      `azfc_admin=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}; Secure`
    ]
  );

  return res.status(200).json({ success: true });
}
