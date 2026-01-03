async function sendWithResend({ to, subject, html }) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.FROM_EMAIL || "no-reply@azfilmcredit.com";
  if (!key) return { ok: false, skipped: true, reason: "Missing RESEND_API_KEY" };

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ from, to, subject, html })
  });

  const data = await r.json().catch(() => ({}));
  if (!r.ok) return { ok: false, error: data };
  return { ok: true, data };
}

export async function notifyAdminNewOrder(order) {
  const to = process.env.ADMIN_NOTIFY_EMAIL;
  if (!to) return { ok: false, skipped: true, reason: "Missing ADMIN_NOTIFY_EMAIL" };

  return sendWithResend({
    to,
    subject: `New AZ Film Credit Order: ${order.trackingNumber}`,
    html: `
      <div style="font-family:system-ui;">
        <h2>New Order Received</h2>
        <p><b>Tracking:</b> ${order.trackingNumber}</p>
        <p><b>Company:</b> ${order.company_name || ""}</p>
        <p><b>Project:</b> ${order.project_title || ""}</p>
        <p><b>Plan:</b> ${order.service_plan} ($${Number(order.amount||0).toFixed(2)})</p>
        <p>Status: <b>${order.status}</b></p>
      </div>
    `
  });
}

export async function notifyCustomerStatus(order) {
  if (!order.contact_email) return { ok: false, skipped: true, reason: "No customer email" };

  return sendWithResend({
    to: order.contact_email,
    subject: `AZ Film Credit Update: ${order.trackingNumber}`,
    html: `
      <div style="font-family:system-ui;">
        <h2>Your order status has been updated</h2>
        <p><b>Tracking:</b> ${order.trackingNumber}</p>
        <p><b>Status:</b> ${order.status}</p>
        <p>You can track progress on the Thank You / Tracking page.</p>
      </div>
    `
  });
}
