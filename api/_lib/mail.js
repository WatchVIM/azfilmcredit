import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function sendEmail({ to, subject, html }) {
  if (!resend) {
    console.warn("RESEND_API_KEY not set — email disabled (dev mode).");
    return { ok: true, dev: true };
  }

  const from = process.env.MAIL_FROM || "AZ Film Credit <no-reply@example.com>";
  const resp = await resend.emails.send({ from, to, subject, html });
  return resp;
}
