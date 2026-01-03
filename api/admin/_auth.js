import crypto from "crypto";

function hmacHex(secret, value) {
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

function sign(payloadBase64, secret) {
  const sig = hmacHex(secret, payloadBase64);
  return `${payloadBase64}.${sig}`;
}

function verify(token, secret) {
  const parts = (token || "").split(".");
  if (parts.length !== 2) return null;

  const [payloadB64, sig] = parts;
  const expected = hmacHex(secret, payloadB64);

  // timing-safe compare
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;

  const json = Buffer.from(payloadB64, "base64url").toString("utf8");
  const data = JSON.parse(json);

  if (!data?.exp || Date.now() > data.exp) return null;
  if (data.role !== "admin") return null;

  return data;
}

export function parseCookies(req) {
  const header = req.headers.cookie || "";
  const out = {};
  header.split(";").forEach(part => {
    const i = part.indexOf("=");
    if (i === -1) return;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    out[k] = decodeURIComponent(v);
  });
  return out;
}

export function requireAdmin(req) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) return null;

  const cookies = parseCookies(req);
  const token = cookies.azfc_admin;
  if (!token) return null;

  return verify(token, secret);
}

export function makeAdminCookie() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("Missing ADMIN_SESSION_SECRET");

  const exp = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
  const payload = Buffer.from(JSON.stringify({ role: "admin", exp })).toString("base64url");
  const token = sign(payload, secret);

  return `azfc_admin=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}; Secure`;
}
