import { saveOrder } from "./_lib/kv.js";
import { sendEmail } from "./_lib/mail.js";

function makeTracking() {
  // ex: AZFC-250102-839217
  const d = new Date();
  const y = String(d.getFullYear()).slice(2);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `AZFC-${y}${m}${day}-${rand}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ success: false, message: "Method not allowed" });

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

    // MVP: assume payment succeeded (you’ll replace this with PayPal capture later)
    const tracking = makeTracking();

    const order = {
      tracking,
      status: "PAID_PENDING_BUILD", // next step: generate packet
      plan,
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveOrder(order);

    // Customer email
    await sendEmail({
      to: order.customer.contact_email,
      subject: `AZ Film Credit — Order Received (${tracking})`,
      html: `
        <div style="font-family:Arial,sans-serif">
          <h2>Order received</h2>
          <p>Thanks, ${order.customer.contact_name}. We received your submission.</p>
          <p><b>Tracking #:</b> ${tracking}</p>
          <p><b>Plan:</b> ${plan === "prep_cpa" ? "Prep + Certified AZ CPA" : "Prep only"}</p>
          <p>You can check status anytime here: <a href="/thank-you.html?tracking=${encodeURIComponent(tracking)}">View status</a></p>
          <hr/>
          <p style="color:#666;font-size:12px">Demo MVP email — your production email template can be upgraded next.</p>
        </div>
      `,
    });

    // Admin alert
    if (process.env.MAIL_ADMIN) {
      await sendEmail({
        to: process.env.MAIL_ADMIN,
        subject: `New AZFC Order: ${tracking}`,
        html: `
          <div style="font-family:Arial,sans-serif">
            <h3>New Order</h3>
            <p><b>Tracking:</b> ${tracking}</p>
            <p><b>Company:</b> ${order.customer.company_name}</p>
            <p><b>Project:</b> ${order.project.project_title} (${order.project.project_type})</p>
            <p><b>Plan:</b> ${order.plan}</p>
            <p>Open Admin Portal → review / update status.</p>
          </div>
        `,
      });
    }

    return res.status(200).json({ success: true, trackingNumber: tracking });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}
