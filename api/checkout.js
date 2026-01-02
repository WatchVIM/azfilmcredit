// /api/checkout.js

import crypto from "crypto";
import { putJSON } from "./_lib/store.js";
import { paypalAccessToken, paypalCreateOrder, getBaseUrl } from "./_lib/paypal.js";

function send(res, code, obj) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(obj));
}

function makeTrackingNumber() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const rand = crypto.randomBytes(3).toString("hex").toUpperCase(); // 6 chars
  return `AZFC-${y}${m}${day}-${rand}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { success: false, message: "Method not allowed" });

  try {
    const payload = req.body || {};

    // Required fields
    const required = ["service_plan", "amount", "company_name", "contact_name", "contact_email", "project_title"];
    for (const k of required) {
      if (!payload[k]) return send(res, 400, { success: false, message: `Missing required field: ${k}` });
    }

    const trackingNumber = makeTrackingNumber();
    const baseUrl = getBaseUrl(req);

    // PayPal redirect returns token=PAYPAL_ORDER_ID
    const returnUrl = `${baseUrl}/thank-you.html?tracking=${encodeURIComponent(trackingNumber)}`;
    const cancelUrl = `${baseUrl}/cpa-processing.html?cancel=1&tracking=${encodeURIComponent(trackingNumber)}`;

    const plan = payload.service_plan;
    const amount = Number(payload.amount);

    const description =
      plan === "prep"
        ? "AZ Film Credit - Document Prep Only"
        : "AZ Film Credit - Document Prep + Certified AZ CPA Sign-Off";

    const token = await paypalAccessToken();
    const { paypalOrderId, approveUrl } = await paypalCreateOrder({
      token,
      amount,
      trackingNumber,
      returnUrl,
      cancelUrl,
      description,
    });

    // Store order record (MVP)
    const order = {
      id: crypto.randomUUID(),
      trackingNumber,
      paypalOrderId,
      status: "AWAITING_PAYMENT_APPROVAL",
      plan,
      amount,
      currency: "USD",
      customer: {
        company_name: payload.company_name,
        contact_name: payload.contact_name,
        contact_email: payload.contact_email,
        contact_phone: payload.contact_phone || "",
      },
      project: {
        project_title: payload.project_title,
        project_type: payload.project_type || "",
        aca_id: payload.aca_id || "",
        est_qualified_costs: payload.est_qualified_costs || "",
        prod_start: payload.prod_start || "",
        prod_end: payload.prod_end || "",
        notes: payload.notes || "",
      },
      exports: null,
      timeline: [{ at: new Date().toISOString(), status: "AWAITING_PAYMENT_APPROVAL", note: "PayPal order created" }],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await putJSON(`order:${trackingNumber}`, order);

    return send(res, 200, {
      success: true,
      trackingNumber,
      paypalOrderId,
      approveUrl,
    });
  } catch (e) {
    console.error(e);
    return send(res, 500, { success: false, message: e.message || "Server error" });
  }
}
