import crypto from "crypto";

function verify(token, secret) {
  const parts = (token || "").split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;

  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;

  const json = Buffer.from(payload, "base64url").toString("utf8");
  const data = JSON.parse(json);

  if (!data?.exp || Date.now() > data.exp) return null;
  if (data.role !== "admin") return null;

  return data;
}

export function requireAdmin(req) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) return null;

  const cookie = req.headers.cookie || "";
  const match = cookie.match(/(?:^|;\s*)azfc_admin=([^;]+)/);
  const token = match?.[1];
  if (!token) return null;

  return verify(token, secret);
}
