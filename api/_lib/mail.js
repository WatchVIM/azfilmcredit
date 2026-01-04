// /api/_lib/mail.js
function requiredEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name} env var`);
  return v;
}

export async function sendEmail({ to, subject, html, replyTo }) {
  const apiKey = requiredEnv("RESEND_API_KEY");

  // Use a verified sender on Resend if possible.
  // While testing, you can keep onboarding@resend.dev
  const from = process.env.MAIL_FROM || "AZ Film Credit <onboarding@resend.dev>";

  const payload = {
    from,
    to,
    subject,
    html,
  };

  // Resend supports reply_to
  if (replyTo) payload.reply_to = replyTo;

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await resp.json().catch(() => ({}));

  if (!resp.ok) {
    // Bubble up useful error text into Vercel logs + API response
    const msg =
      data?.message ||
      data?.error?.message ||
      `Resend API error (HTTP ${resp.status})`;
    throw new Error(msg);
  }

  return data;
}
