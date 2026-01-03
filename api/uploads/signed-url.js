import { supabaseAdmin } from "./_lib/supabase.js";

function safeName(name = "file") {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ success: false, message: "Method not allowed" });

  try {
    const { trackingNumber, type, filename, mime, size } = req.body || {};
    if (!trackingNumber || !type || !filename) {
      return res.status(400).json({ success: false, message: "Missing trackingNumber/type/filename" });
    }

    const sb = supabaseAdmin();

    const { data: order, error: orderErr } = await sb
      .from("orders")
      .select("id")
      .eq("tracking_number", trackingNumber)
      .single();
    if (orderErr) throw orderErr;

    const bucket = "azfc-uploads";
    const path = `${trackingNumber}/${type}/${Date.now()}_${safeName(filename)}`;

    // Create uploads row first
    const { data: uploadRow, error: upErr } = await sb
      .from("uploads")
      .insert({
        order_id: order.id,
        type,
        bucket,
        path,
        original_name: filename,
        mime: mime || null,
        size: size ? Number(size) : null,
        parse_status: "received",
      })
      .select("*")
      .single();
    if (upErr) throw upErr;

    // Create signed URL to upload
    const { data: signed, error: signErr } = await sb.storage
      .from(bucket)
      .createSignedUploadUrl(path);
    if (signErr) throw signErr;

    return res.status(200).json({
      success: true,
      uploadId: uploadRow.id,
      bucket,
      path,
      token: signed.token,
      signedUrl: signed.signedUrl
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}
