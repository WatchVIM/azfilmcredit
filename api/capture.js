// /api/capture.js

import { getJSON, putJSON } from "./_lib/store.js";
import { paypalAccessToken, paypalCaptureOrder } from "./_lib/paypal.js";

function send(res, code, obj) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(obj));
}

function pushTimeline(order, status, note) {
  order.timeline = order.timeline || [];
  order.timeline.push({ at: new Date().toISOString(), status, note });
  order.status = status;
  order.updated_at = new Date().toISOString();
}

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { success: false, message: "Method not allowed" });

  try {
    const { tracking, paypalOrderId } = req.body || {};
    if (!tracking || !paypalOrderId) {
      return send(res, 400, { success: false, message: "Missing tracking or paypalOrderId" });
    }

    const key = `order:${tracking}`;
    const order = await getJSON(key);
    if (!order) return send(res, 404, { success: false, message: "Order not found" });

    // Prevent double capture
    if (order.status && ["PAID", "PROCESSING", "READY_FOR_ADMIN_REVIEW", "ADMIN_APPROVED", "SENT_TO_CUSTOMER", "SENT_TO_CPA", "COMPLETED"].includes(order.status)) {
      return send(res, 200, { success: true, alreadyCaptured: true, order });
    }

    const token = await paypalAccessToken();
    const capture = await paypalCaptureOrder({ token, paypalOrderId });

    // Update order statuses (MVP pipeline)
    pushTimeline(order, "PAID", "Payment captured");
    order.paypalCapture = {
      id: capture?.purchase_units?.[0]?.payments?.captures?.[0]?.id || null,
      status: capture?.status || null,
    };

    // Immediately move to processing
    pushTimeline(order, "PROCESSING", "Auto-building CPA package (MVP simulation)");

    // For MVP, attach “draft exports” after capture (you’ll replace this with real generation)
    // You can point these to your sample PDFs for now.
    const isPrepCpa = order.plan === "prep_cpa";
    order.exports = {
      audit_pdf: isPrepCpa
        ? "/samples/AZ_Film_Credit_Full_CPA_Audit_Sample_Series.pdf"
        : "/samples/AZ_Film_Credit_Full_CPA_Audit_Sample_Feature.pdf",
      state_forms_pdf: "/samples/AZ_Film_Credit_Full_CPA_Audit_Sample_Commercial.pdf",
    };

    // After a short simulated delay, mark ready for admin review.
    // (Serverless can’t “sleep” reliably, so we mark it ready immediately in MVP.)
    pushTimeline(order, "READY_FOR_ADMIN_REVIEW", "Draft generated; awaiting admin review");

    await putJSON(key, order);

    return send(res, 200, { success: true, order });
  } catch (e) {
    console.error(e);
    return send(res, 500, { success: false, message: e.message || "Capture failed" });
  }
}

