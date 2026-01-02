import crypto from "crypto";

function trackingNumber() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const rand = crypto.randomBytes(3).toString("hex").toUpperCase(); // 6 chars
  return `AZFC-${y}${m}${day}-${rand}`;
}

async function kvGet(key) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;

  const res = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  return data?.result ?? null;
}

async function kvSet(key, value) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return false;

  const res = await fetch(`${url}/set/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(value)
  });
  return res.ok;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ success: false, message: "Method not allowed" });

  try {
    const payload = req.body || {};

    // Minimal validation
    const required = ["company_name", "contact_name", "contact_email", "project_title", "service_plan", "amount"];
    for (const k of required) {
      if (!payload[k]) {
        return res.status(400).json({ success: false, message: `Missing required field: ${k}` });
      }
    }

    const t = trackingNumber();

    const order = {
      tracking_number: t,
      status: "PAID",
      plan: payload.service_plan,           // prep | prep_cpa
      amount: Number(payload.amount),
      currency: "USD",
      customer: {
        company_name: payload.company_name,
        contact_name: payload.contact_name,
        contact_email: payload.contact_email,
        contact_phone: payload.contact_phone || ""
      },
      project: {
        title: payload.project_title,
        type: payload.project_type || "",
        aca_id: payload.aca_id || "",
        est_qualified_costs: payload.est_qualified_costs || "",
        prod_start: payload.prod_start || "",
        prod_end: payload.prod_end || "",
        notes: payload.notes || ""
      },
      exports: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Store in KV (recommended). If KV isn’t configured yet, still return success for frontend testing.
    await kvSet(`order:${t}`, order);

    // Simulate processing in background-ish way:
    // (Serverless can’t truly run a background job reliably, but MVP: update status on next poll if not updated yet.)
    // We'll mark it "PROCESSING" immediately so tracking changes.
    order.status = "PROCESSING";
    order.updated_at = new Date().toISOString();
    await kvSet(`order:${t}`, order);

    return res.json({
      success: true,
      trackingNumber: t,
      status: order.status,
      redirect: `/thank-you.html?tracking=${encodeURIComponent(t)}&plan=${encodeURIComponent(order.plan)}`
    });

  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, message: "Checkout failed" });
  }
}
