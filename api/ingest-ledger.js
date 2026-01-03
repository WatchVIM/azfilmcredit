import { supabaseAdmin } from "./_lib/supabase.js";

function toBool(v) {
  if (typeof v === "boolean") return v;
  if (v == null) return null;
  const s = String(v).trim().toLowerCase();
  return s === "true" || s === "1" || s === "yes" || s === "y";
}

function parseCSV(text) {
  // Simple CSV parser for MVP (handles quoted fields)
  const rows = [];
  let cur = "";
  let inQ = false;
  let row = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"' && inQ && next === '"') { cur += '"'; i++; continue; }
    if (ch === '"') { inQ = !inQ; continue; }

    if (!inQ && ch === ",") { row.push(cur); cur = ""; continue; }
    if (!inQ && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cur);
      if (row.some(c => c !== "")) rows.push(row);
      row = [];
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ success: false, message: "Method not allowed" });

  try {
    const { trackingNumber, uploadId } = req.body || {};
    if (!trackingNumber || !uploadId) {
      return res.status(400).json({ success: false, message: "Missing trackingNumber/uploadId" });
    }

    const sb = supabaseAdmin();

    const { data: order, error: oErr } = await sb
      .from("orders")
      .select("id")
      .eq("tracking_number", trackingNumber)
      .single();
    if (oErr) throw oErr;

    const { data: upload, error: uErr } = await sb
      .from("uploads")
      .select("*")
      .eq("id", uploadId)
      .single();
    if (uErr) throw uErr;

    // Download CSV from Storage
    const { data: file, error: dlErr } = await sb.storage
      .from(upload.bucket)
      .download(upload.path);
    if (dlErr) throw dlErr;

    const csvText = await file.text();
    const rows = parseCSV(csvText);
    if (rows.length < 2) {
      return res.status(400).json({ success: false, message: "CSV appears empty." });
    }

    const headers = rows[0].map(h => String(h).trim());
    const idx = Object.fromEntries(headers.map((h, i) => [h, i]));

    const required = ["txn_date", "vendor_name", "description", "amount"];
    for (const r of required) {
      if (!(r in idx)) {
        return res.status(400).json({ success: false, message: `Missing required column: ${r}` });
      }
    }

    const inserts = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const get = (k) => (idx[k] != null ? (r[idx[k]] ?? "").toString().trim() : "");

      const amount = Number(get("amount") || 0);
      if (!amount) continue;

      inserts.push({
        order_id: order.id,
        source_upload_id: upload.id,

        txn_date: get("txn_date") || null,
        vendor_name: get("vendor_name"),
        vendor_address: get("vendor_address") || null,
        vendor_city: get("vendor_city") || null,
        vendor_state: get("vendor_state") || null,
        vendor_zip: get("vendor_zip") || null,

        invoice_number: get("invoice_number") || null,
        description: get("description"),

        category: get("category") || null,
        department: get("department") || null,
        cost_type: get("cost_type") || null,
        episode: get("episode") || null,

        payment_method: get("payment_method") || null,
        amount,
        currency: get("currency") || "USD",

        az_work_performed: toBool(get("az_work_performed")) ?? true,
        az_vendor: toBool(get("az_vendor")) ?? true,
        qualified_flag: toBool(get("qualified_flag")) ?? true,
        nonqualified_reason: get("nonqualified_reason") || null,

        receipt_filename: get("receipt_filename") || null,
        contract_filename: get("contract_filename") || null,
        location_agreement_filename: get("location_agreement_filename") || null,
        notes: get("notes") || null,
      });
    }

    if (!inserts.length) {
      return res.status(400).json({ success: false, message: "No valid transactions found to import." });
    }

    // Bulk insert (chunk for safety)
    const chunkSize = 500;
    for (let i = 0; i < inserts.length; i += chunkSize) {
      const chunk = inserts.slice(i, i + chunkSize);
      const { error: insErr } = await sb.from("transactions").insert(chunk);
      if (insErr) throw insErr;
    }

    // Mark upload parsed
    await sb.from("uploads").update({ parse_status: "parsed" }).eq("id", upload.id);

    // Recalculate totals (simple MVP)
    const { data: sums, error: sumErr } = await sb
      .from("transactions")
      .select("amount, qualified_flag")
      .eq("order_id", order.id);
    if (sumErr) throw sumErr;

    let qualified = 0, nonQualified = 0;
    for (const t of sums || []) {
      const amt = Number(t.amount || 0);
      if (t.qualified_flag) qualified += amt;
      else nonQualified += amt;
    }

    const creditRate = 0.15;
    const creditComputed = qualified * creditRate;

    await sb.from("calc_totals").upsert({
      order_id: order.id,
      qualified_costs_total: qualified,
      nonqualified_costs_total: nonQualified,
      credit_rate: creditRate,
      credit_computed: creditComputed,
      claim_this_year: creditComputed,
      carryforward: 0
    });

    return res.status(200).json({
      success: true,
      imported: inserts.length,
      totals: {
        qualified_costs_total: qualified,
        nonqualified_costs_total: nonQualified,
        credit_rate: creditRate,
        credit_computed: creditComputed
      }
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}
