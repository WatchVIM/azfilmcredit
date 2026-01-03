import { supabaseAdmin } from "../_lib/supabase.js";

function assertAdmin(req) {
  const pass = process.env.ADMIN_PASSWORD;
  const provided =
    req.headers["x-admin-password"] ||
    (req.query && req.query.admin_password) ||
    (req.body && req.body.admin_password);

  if (!pass || !provided || String(provided) !== String(pass)) {
    const err = new Error("Unauthorized");
    err.statusCode = 401;
    throw err;
  }
}

export default async function handler(req, res) {
  try {
    assertAdmin(req);

    const sb = supabaseAdmin();

    const status = req.query?.status;
    let q = sb.from("orders").select("*").order("created_at", { ascending: false }).limit(200);
    if (status) q = q.eq("status", status);

    const { data, error } = await q;
    if (error) throw error;

    return res.status(200).json({ success: true, orders: data });
  } catch (e) {
    const code = e.statusCode || 500;
    return res.status(code).json({ success: false, message: e.message || "Server error" });
  }
}
