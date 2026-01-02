// /api/track.js

import { getJSON } from "./_lib/store.js";

function send(res, code, obj) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(obj));
}

export default async function handler(req, res) {
  if (req.method !== "GET") return send(res, 405, { success: false, message: "Method not allowed" });

  const tracking = req.query?.tracking;
  if (!tracking) return send(res, 400, { success: false, message: "Missing tracking parameter" });

  const order = await getJSON(`order:${tracking}`);
  if (!order) return send(res, 404, { success: false, message: "Tracking number not found" });

  return send(res, 200, { success: true, order });
}
