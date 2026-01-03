import { supabaseAdmin } from "../_lib/supabase.js";

/**
 * Option B: Server-side password protection.
 * Password is stored in Vercel env var: ADMIN_PASSWORD
 * Client sends it via header: x-admin-password
 */
function getProvidedPassword(req) {
  // Node/Vercel lowercases header keys, but we handle robustly anyway
  return (
    req.headers?.["x-admin-password"] ||
    req.headers?.["X-Admin-Password"] ||
    req.headers?.["x-admin-password".toLowerCase()] ||
    req.query?.admin_password ||
    req.body?.admin_password ||
    ""
  );
}

function assertAdmin(req) {
  const pass = process.env.ADMIN_PASSWORD;
  const provided = getProvidedPassword(req);

  if (!pass) {
    const err = new Error(
      "ADMIN_PASSWORD is not set on the server. Add it in Vercel → Project → Settings → Environment Variables (Production/Preview/Development), then redeploy."
    );
    err.statusCode = 500;
    throw err;
  }

  if (!provided || String(provided).trim() !== String(pass).trim()) {
    const err = new Error("Unauthorized");
    err.statusCode = 401;
    throw err;
  }
}

function jsonError(res, status, message, extra = {}) {
  return res.status(status).json({ success: false, message, ...extra });
}

export default async function handler(req, res) {
  // Always respond JSON (prevents “non-JSON response” in admin UI)
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  try {
    assertAdmin(req);

    const sb = supabaseAdmin();

    // ----------------------------
    // GET: list orders
    // ----------------------------
    if (req.method === "GET") {
      const status = req.query?.status ? String(req.query.status).trim() : "";
      const limit = Math.min(Math.max(Number(req.query?.limit || 200), 1), 500);

      let q = sb
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (status) q = q.eq("status", status);

      const { data, error } = await q;
      if (error) throw error;

      return res.status(200).json({ success: true, orders: data || [] });
    }

    // ----------------------------
    // PATCH: update status
    // Body: { tracking_number, status }
    // ----------------------------
    if (req.method === "PATCH") {
      const tracking_number = (req.body?.tracking_number || "").trim();
      const status = (req.body?.status || "").trim();

      if (!tracking_number || !status) {
        return jsonError(res, 400, "Missing tracking_number or status.");
      }

      const allowed = new Set([
        "paid",
        "in_review",
        "packet_generated",
        "sent_to_cpa",
        "completed",
        "needs_info"
      ]);

      if (!allowed.has(status)) {
        return jsonError(
          res,
          400,
          `Invalid status. Allowed: ${Array.from(allowed).join(", ")}`
        );
      }

      const { data, error } = await sb
        .from("orders")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("tracking_number", tracking_number)
        .select("*")
        .single();

      if (error) throw error;

      return res.status(200).json({ success: true, order: data });
    }

    // ----------------------------
    // Not allowed
    // ----------------------------
    return jsonError(res, 405, "Method not allowed. Use GET or PATCH.");
  } catch (e) {
    const code = e.statusCode || 500;

    // IMPORTANT: always JSON
    return jsonError(res, code, e.message || "Server error", {
      code
    });
  }
}
