import { saveOrder, getOrder } from "./_lib/kv.js";
import { sendEmail } from "./_lib/mail.js";

/**
 * Tracking format: AZFC-YYMMDD-XXXXXX
 * Example: AZFC-260102-839217
 */
function makeTracking() {
  const d = new Date();
  const y = String(d.getFullYear()).slice(2);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `AZFC-${y}${m}${day}-${rand}`;
}

function planLabel(plan) {
  return plan === "prep_cpa" ? "Prep + Certified AZ CPA" : "Document Prep Only";
}

/**
 * New statuses (align these with admin portal):
 * - paid
 * - in_review
 * - packet_generated
 * - sent_to_cpa
 * - completed
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const body = req.body || {};
    const plan = body.service_plan === "prep_cpa" ? "prep_cpa" : "prep";

    // Pricing locked server-side
    const PRICES = { prep: 79.0, prep_cpa: 478.0 };
    const amount = PRICES[plan];

    // Basic validation
    if (!body.company_name || !body.contact_name || !body.contact_email || !body.project_title) {
      return res.status(400).json({ success: false, message: "Missing required fields." });
    }

    // Create a tracking number (ensure it’s unique in KV)
    let tracking = makeTracking();
    // In the rare case of a collision, retry a few times
    for (let i = 0; i < 3; i++) {
      const existing = await getOrder(tracking).catch(() => null);
      if (!existing) break;
      tracking = makeTracking();
    }

    // MVP: assume payment succeeded (replace with PayPal create/capture next)
    const now = new Date().toISOString();

    const order = {
      trackingNumber: tracking,     // ✅ normalized key for frontend/admin
      tracking,                     // ✅ keep legacy field for backwards compatibility
      status: "paid",               // ✅ aligns with admin portal filters
      plan,                         // legacy
      service_plan: plan,           // ✅ matches frontend payload
      amount,

      customer: {
        company_name: body.company_name,
        contact_name: body.contact_name,
        contact_email: body.contact_email,
        contact_phone: body.contact_phone || "",
      },

      project: {
        project_title: body.project_title,
        project_type: body.project_type || "",
        aca_id: body.aca_id || "",
        est_qualified_costs: body.est_qualified_costs || "",
        prod_start: body.prod_start || "",
        prod_end: body.prod_end || "",
        notes: body.notes || "",
      },

      uploads: {
        has_ledger_file: !!body.has_ledger_file,
        payroll_files_count: Number(body.payroll_files_count || 0),
        supporting_docs_count: Number(body.supporting_docs_count || 0),
      },

      createdAt: now,
      updatedAt: now,
    };

    await saveOrder(order);

    // -----------------------------
    // Email: Customer confirmation
    // -----------------------------
    await sendEmail({
      to: order.customer.contact_email,
      subject: `AZ Film Credit — Order Received (${tracking})`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.5">
          <h2 style="margin:0 0 8px 0;">Order received</h2>
          <p style="margin:0 0 10px 0;">Thanks, ${order.customer.contact_name}. We received your submission.</p>

          <div style="padding:12px;border:1px solid #e5e7eb;border-radius:10px;background:#fafafa;">
            <p style="margin:0;"><b>Tracking #:</b> ${tracking}</p>
            <p style="margin:6px 0 0 0;"><b>Plan:</b> ${planLabel(plan)}</p>
            <p style="margin:6px 0 0 0;"><b>Total:</b> $${Number(amount).toFixed(2)}</p>
            <p style="margin:6px 0 0 0;"><b>Status:</b> paid</p>
          </div>

          <p style="margin:14px 0 0 0;">
            Check your status anytime here:
            <a href="/thank-you.html?tracking=${encodeURIComponent(tracking)}">View status</a>
          </p>

          <hr style="margin:16px 0;border:none;border-top:1px solid #e5e7eb;" />
          <p style="color:#6b7280;font-size:12px;margin:0;">
            This is an automated confirmation. For support, reply to this email or visit /support.html.
          </p>
        </div>
      `,
    });

    // -----------------------------
    // Email: Admin notification
    // -----------------------------
    const adminTo = process.env.MAIL_ADMIN || process.env.ADMIN_NOTIFY_EMAIL;
    if (adminTo) {
      await sendEmail({
        to: adminTo,
        subject: `New AZ Film Credit Order: ${tracking}`,
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.5">
            <h3 style="margin:0 0 8px 0;">New Order Received</h3>
            <p style="margin:0;"><b>Tracking:</b> ${tracking}</p>
            <p style="margin:6px 0 0 0;"><b>Company:</b> ${order.customer.company_name}</p>
            <p style="margin:6px 0 0 0;"><b>Project:</b> ${order.project.project_title} ${order.project.project_type ? `(${order.project.project_type})` : ""}</p>
            <p style="margin:6px 0 0 0;"><b>Plan:</b> ${planLabel(plan)}</p>
            <p style="margin:6px 0 0 0;"><b>Amount:</b> $${Number(amount).toFixed(2)}</p>
            <p style="margin:10px 0 0 0;">
              Admin Portal: <a href="/admin.html">Open Admin</a>
            </p>
          </div>
        `,
      });
    }

    return res.status(200).json({
      success: true,
      trackingNumber: tracking, // ✅ what your frontend expects
      status: "paid",
      amount,
      plan,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}
