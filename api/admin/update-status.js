import { updateOrder } from "../_lib/kv.js";
import { requireAdmin } from "../_lib/auth.js";
import { sendEmail } from "../_lib/mail.js";

const STATUS_LABELS = {
  PAID_PENDING_BUILD: "Paid — packet building",
  PACKET_GENERATED: "Packet generated — admin review",
  SENT_TO_CUSTOMER: "Delivered to customer",
  SENT_TO_CPA: "Sent to CPA for review",
  CPA_APPROVED: "CPA approved",
};

export default async function handler(req, res) {
  if (!requireAdmin(req)) return res.status(401).json({ success: false, message: "Unauthorized" });
  if (req.method !== "POST") return res.status(405).json({ success: false });

  const { tracking, status } = req.body || {};
  if (!tracking || !status) return res.status(400).json({ success: false, message: "Missing tracking/status" });

  const updated = await updateOrder(tracking, { status });
  if (!updated) return res.status(404).json({ success: false, message: "Not found" });

  // Optional: auto email customer on certain statuses
  if (["PACKET_GENERATED", "SENT_TO_CUSTOMER", "SENT_TO_CPA", "CPA_APPROVED"].includes(status)) {
    await sendEmail({
      to: updated.customer.contact_email,
      subject: `AZ Film Credit — Status Update (${tracking})`,
      html: `
        <div style="font-family:Arial,sans-serif">
          <h2>Status updated</h2>
          <p><b>Tracking #:</b> ${tracking}</p>
          <p><b>New status:</b> ${STATUS_LABELS[status] || status}</p>
          <p>Check status here: <a href="/thank-you.html?tracking=${encodeURIComponent(tracking)}">View status</a></p>
        </div>
      `,
    });
  }

  return res.status(200).json({ success: true, order: updated });
}
