// /api/contact.js
import { sendEmail } from "./_lib/mail.js";

function clean(s, max = 4000) {
  return String(s || "").trim().slice(0, max);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const body = req.body || {};

    const name = clean(body.name, 120);
    const email = clean(body.email, 200);
    const project = clean(body.project, 200);
    const topic = clean(body.topic, 120);
    const message = clean(body.message, 6000);

    if (!name || !email || !message) {
      return res.status(400).json({ success: false, message: "Missing required fields." });
    }

    // Simple email sanity check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: "Invalid email address." });
    }

    const to = process.env.SUPPORT_EMAIL || "support@azfilmcredit.org";

    // Send to support inbox
    await sendEmail({
      to,
      subject: `AZFC Support — ${topic || "Request"}${project ? ` (${project})` : ""}`,
      replyTo: email,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.45">
          <h2 style="margin:0 0 10px 0">New Support Request</h2>

          <p style="margin:0 0 10px 0">
            <b>Name:</b> ${escapeHtml(name)}<br/>
            <b>Email:</b> ${escapeHtml(email)}<br/>
            <b>Topic:</b> ${escapeHtml(topic || "—")}<br/>
            <b>Project:</b> ${escapeHtml(project || "—")}
          </p>

          <hr style="border:none;border-top:1px solid #ddd;margin:12px 0"/>

          <p style="white-space:pre-wrap;margin:0">${escapeHtml(message)}</p>

          <hr style="border:none;border-top:1px solid #eee;margin:12px 0"/>

          <p style="color:#666;font-size:12px;margin:0">
            Sent from support.html • ${escapeHtml(clean(body.userAgent, 500)) || ""}
          </p>
        </div>
      `,
    });

    // Optional: confirmation email back to customer
    if (process.env.SUPPORT_SEND_CONFIRMATION === "true") {
      await sendEmail({
        to: email,
        subject: "AZ Film Credit — Support request received",
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.45">
            <p>Hi ${escapeHtml(name)},</p>
            <p>We received your support request and will reply as soon as possible.</p>
            <p style="color:#666;font-size:12px">
              Topic: ${escapeHtml(topic || "—")}<br/>
              Project: ${escapeHtml(project || "—")}
            </p>
            <hr style="border:none;border-top:1px solid #eee;margin:12px 0"/>
            <p style="white-space:pre-wrap;margin:0">${escapeHtml(message)}</p>
            <p style="color:#666;font-size:12px;margin-top:12px">
              — AZ Film Credit Support
            </p>
          </div>
        `,
      });
    }

    return res.status(200).json({ success: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, message: "Failed to send support email." });
  }
}

// Minimal escaping to avoid HTML injection in email
function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
