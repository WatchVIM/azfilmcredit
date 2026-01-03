import { getOrder } from "./_lib/kv.js";

export default async function handler(req, res) {
  const tracking = (req.query.tracking || "").trim();
  if (!tracking) return res.status(400).json({ success: false, message: "Missing tracking" });

  const order = await getOrder(tracking);
  if (!order) return res.status(404).json({ success: false, message: "Not found" });

  return res.status(200).json({ success: true, order });
}
