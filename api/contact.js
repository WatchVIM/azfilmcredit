import { sendEmail } from "./_lib/mail.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const body = req.body || {};
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim();
    const role = String(body.role || "").trim();
    const message = String(body.message || "").trim();

    if (!name || !email || !message) {
      return res.status(400).json({ success: false, message: "Missing required fields." });
    }

    // Basic anti-spam / safety limits
    if (message.length > 5000) {
      return res.status(400).json({ success: false, message: "Message too long." });
    }

    const SUPPORT_TO = "support@azfilmcredit.org";

    // Email to support
    await sendEmail({
      to: SUPPORT_TO,
      subject: `AZ Film Credit — Contact Form (${name})`,
      // If your mail provider supports it, your sendEmail helper may accept "replyTo".
      // If it doesn't, we include reply instructions in the body.
      replyTo: email,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.45">
          <h2>New Contact Form Submission</h2>
          <p><b>Name:</b> ${escapeHtml(name)}</p>
          <p><b>Email:</b> ${escapeHtml(email)}</p>
          <p><b>Role:</b> ${escapeHtml(role || "—")}</p>
          <hr/>
          <p><b>Message:</b></p>
          <pre style="white-space:pre-wrap;background:#f6f6f6;padding:12px;border-radius:8px;border:1px solid #ddd">${escapeHtml(message)}</pre>
          <p style="color:#666;font-size:12px">Reply directly to: ${escapeHtml(email)}</p>
        </div>
      `,
    });

    // Optional: confirmation email to the user (nice UX)
    await sendEmail({
      to: email,
      subject: "AZ Film Credit — We received your message",
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.45">
          <h2>Thanks for reaching out</h2>
          <p>Hi ${escapeHtml(name)},</p>
          <p>We received your message and our team will reply as soon as possible.</p>
          <hr/>
          <p style="color:#666;font-size:12px">
            This mailbox is not monitored for replies. If you need to add details, submit the form again.
          </p>
        </div>
      `,
    });

    return res.status(200).json({ success: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

// Minimal HTML escaping to prevent injection in email body
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
