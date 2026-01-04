// /api/_lib/mail.js
import { Resend } from "resend";

function requiredEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name} env var`);
  return v;
}

export async function sendEmail({ to, subject, html, replyTo }) {
  const apiKey = requiredEnv("RESEND_API_KEY");

  // You can use either:
  // - A domain you've verified in Resend, like "support@azfilmcredit.org"
  // - Or Resend's onboarding sender while testing
  const from = process.env.MAIL_FROM || "AZ Film Credit <onboarding@resend.dev>";

  const resend = new Resend(apiKey);

  const payload = {
    from,
    to,
    subject,
    html,
  };

  if (replyTo) payload.reply_to = replyTo;

  const { error } = await resend.emails.send(payload);
  if (error) throw new Error(error.message || "Resend send failed");
}
