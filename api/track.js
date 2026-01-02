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
  if (req.method !== "GET") return res.status(405).json({ success: false });

  const tracking = req.query.tracking;
  if (!tracking) return res.status(400).json({ success: false, message: "Missing tracking" });

  const orderKey = `order:${tracking}`;
  const order = await kvGet(orderKey);

  if (!order) {
    return res.status(404).json({ success: false, message: "Order not found (KV not set up yet?)" });
  }

  // MVP “fake processing”: after first tracking hit, advance status and attach mock export links.
  // This lets you test the full flow today.
  const now = Date.now();
  const created = Date.parse(order.created_at || new Date().toISOString());
  const ageMs = now - created;

  // After ~30 seconds, mark ready for admin review
  if (order.status === "PROCESSING" && ageMs > 30_000) {
    order.status = "READY_FOR_ADMIN_REVIEW";
    order.exports = {
      audit_pdf: `/samples/AZ_Film_Credit_Full_CPA_Audit_Sample_${order.plan === "prep_cpa" ? "Series" : "Feature"}.pdf`,
      state_forms_pdf: `/samples/AZ_Film_Credit_Full_CPA_Audit_Sample_Commercial.pdf`
    };
    order.updated_at = new Date().toISOString();
    await kvSet(orderKey, order);
  }

  return res.json({
    success: true,
    trackingNumber: order.tracking_number,
    status: order.status,
    plan: order.plan,
    exports: order.exports,
    updated_at: order.updated_at
  });
}
