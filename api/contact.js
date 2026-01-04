// /api/contact.js
import { sendEmail } from "./_lib/mail.js";

function clean(s, max = 4000) {
  return String(s || "").trim().slice(0, max);
}

function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: "Invalid email address." });
    }

    const to = process.env.SUPPORT_EMAIL || "support@azfilmcredit.org";

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
        </div>
      `,
    });

    return res.status(200).json({ success: true });
  } catch (e) {
    console.error("CONTACT_API_ERROR:", e);
    return res.status(500).json({
      success: false,
      message: "Support request failed.",
      detail: e?.message || "Unknown server error",
    });
  }
}
