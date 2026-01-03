export default async function handler(req, res) {
  res.setHeader("Set-Cookie", `azfc_admin=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure`);
  return res.status(200).json({ success: true });
}
