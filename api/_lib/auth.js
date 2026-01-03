export function requireAdmin(req) {
  const token = process.env.ADMIN_TOKEN;
  const auth = req.headers.authorization || "";
  const got = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  return token && got && got === token;
}
