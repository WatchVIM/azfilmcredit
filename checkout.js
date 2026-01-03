import { supabaseAdmin } from "./_lib/supabase.js";
import { sendEmail } from "./_lib/mail.js";

function makeTracking() {
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

    const PRICES = { prep: 79.0, prep_cpa: 478.0 };
    const amount = PRICES[plan];

    if (!body.company_name || !body.contact_name || !body.contact_email || !body.project_title) {
      return res.status(400).json({ success: false, message: "Missing required fields." });
    }

    const sb = supabaseAdmin();

    // Unique tracking
    let tracking = makeTracking();
    for (let i = 0; i < 3; i++) {
      const { data: existing } = await sb
        .from("orders")
        .select("id")
        .eq("tracking_number", tracking)
        .maybeSingle();
      if (!existing) break;
      tracking = makeTracking();
    }

    const orderInsert = {
      tracking_number: tracking,
      status: "paid",
      service_plan: plan,
      amount,

      company_name: body.company_name,
      contact_name: body.contact_name,
      contact_email: body.contact_email,
      contact_phone: body.contact_phone || null,

      project_title: body.project_title,
      project_type: body.project_type || null,
      tax_year: body.tax_year ? Number(body.tax_year) : null,
      entity_type: body.entity_type || null,
      entity_tax_type: body.entity_tax_type || null,
      ein_last4: body.ein_last4 || null,

      aca_pre_approval_id: body.aca_id || null,
      aca_post_cert_id: body.aca_post_cert_id || null,

      prod_start: body.prod_start || null,
      prod_end: body.prod_end || null,

      notes: body.notes || null,
    };

    const { data: order, error } = await sb.from("orders").insert(orderInsert).select("*").single();
    if (error) throw error;

    // create calc_totals row (so packet generator always has a row)
    await sb.from("calc_totals").upsert({ order_id: order.id });

    // Emails
    await sendEmail({
      to: order.contact_email,
      subject: `AZ Film Credit — Order Received (${tracking})`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.5">
          <h2>Order received</h2>
          <p>Thanks, ${order.contact_name}. We received your submission.</p>
          <p><b>Tracking #:</b> ${tracking}</p>
          <p><b>Plan:</b> ${plan === "prep_cpa" ? "Prep + Certified AZ CPA" : "Document Prep Only"}</p>
          <p><b>Total:</b> $${Number(amount).toFixed(2)}</p>
          <p>Status: <b>paid</b></p>
          <p>Check status: <a href="/thank-you.html?tracking=${encodeURIComponent(tracking)}">View status</a></p>
        </div>
      `,
    });

    if (process.env.MAIL_ADMIN) {
      await sendEmail({
        to: process.env.MAIL_ADMIN,
        subject: `New AZFC Order: ${tracking}`,
        html: `
          <div style="font-family:Arial,sans-serif">
            <h3>New Order</h3>
            <p><b>Tracking:</b> ${tracking}</p>
            <p><b>Company:</b> ${order.company_name}</p>
            <p><b>Project:</b> ${order.project_title}</p>
            <p><b>Plan:</b> ${order.service_plan}</p>
            <p><a href="/admin.html">Open Admin Portal</a></p>
          </div>
        `,
      });
    }

    return res.status(200).json({ success: true, trackingNumber: tracking, status: "paid" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}
