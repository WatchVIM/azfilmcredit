import { supabaseAdmin } from "./_lib/supabase.js";
import { sendEmail } from "./_lib/mail.js";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

function assertAdmin(req) {
  const pass = process.env.ADMIN_PASSWORD;
  const provided =
    req.headers["x-admin-password"] ||
    req.query?.admin_password ||
    req.body?.admin_password ||
    "";

  if (!pass) {
    const err = new Error("ADMIN_PASSWORD not set on server.");
    err.statusCode = 500;
    throw err;
  }
  if (!provided || String(provided).trim() !== String(pass).trim()) {
    const err = new Error("Unauthorized");
    err.statusCode = 401;
    throw err;
  }
}

async function makeSimplePacketPdf(order) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]); // letter
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const margin = 50;
  let y = 760;

  page.drawText("AZ Film Credit — CPA Packet (MVP Sample)", {
    x: margin,
    y,
    size: 16,
    font: fontBold,
    color: rgb(0, 0, 0),
  });

  y -= 28;

  const lines = [
    `Tracking #: ${order.tracking_number}`,
    `Company: ${order.company_name || ""}`,
    `Contact: ${order.contact_name || ""} (${order.contact_email || ""})`,
    `Project: ${order.project_title || ""}`,
    `Plan: ${order.service_plan || ""}`,
    `Status: ${order.status || ""}`,
    `Generated: ${new Date().toISOString()}`,
    "",
    "This is an MVP placeholder packet.",
    "Next step: populate schedules + attach tax form templates + itemized ledger imports.",
  ];

  for (const line of lines) {
    page.drawText(line, { x: margin, y, size: 11, font });
    y -= 16;
    if (y < 80) break;
  }

  return await pdfDoc.save();
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  try {
    assertAdmin(req);

    if (req.method !== "POST") {
      return res.status(405).json({ success: false, message: "Method not allowed" });
    }

    const tracking = (req.body?.tracking_number || "").trim();
    if (!tracking) {
      return res.status(400).json({ success: false, message: "tracking_number is required" });
    }

    const sb = supabaseAdmin();

    // 1) Fetch order
    const { data: order, error: orderErr } = await sb
      .from("orders")
      .select("*")
      .eq("tracking_number", tracking)
      .single();

    if (orderErr) throw orderErr;

    // 2) Generate PDF (MVP placeholder)
    const pdfBytes = await makeSimplePacketPdf(order);

    // 3) Upload to Supabase Storage
    const bucket = "azfc-packets";
    const fileName = `${tracking}/AZFC_CPA_Packet_${tracking}.pdf`;
    const { error: upErr } = await sb.storage
      .from(bucket)
      .upload(fileName, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (upErr) throw upErr;

    // 4) Insert reference (optional)
    await sb.from("generated_packets").insert({
      tracking_number: tracking,
      packet_path: fileName,
      packet_type: "cpa_packet_pdf",
    }).catch(() => {});

    // 5) Create signed URL (private bucket)
    const { data: signed, error: signErr } = await sb.storage
      .from(bucket)
      .createSignedUrl(fileName, 60 * 60 * 24 * 7); // 7 days

    if (signErr) throw signErr;

    // 6) Update order status
    const { error: updErr } = await sb
      .from("orders")
      .update({
        status: "packet_generated",
        updated_at: new Date().toISOString(),
      })
      .eq("tracking_number", tracking);

    if (updErr) throw updErr;

    // 7) Email customer
    if (order.contact_email) {
      await sendEmail({
        to: order.contact_email,
        subject: `AZ Film Credit — CPA Packet Generated (${tracking})`,
        html: `
          <div style="font-family:Arial,sans-serif">
            <h2>Your CPA Packet is ready</h2>
            <p><b>Tracking #:</b> ${tracking}</p>
            <p>Download your packet here (link expires in 7 days):</p>
            <p><a href="${signed.signedUrl}">Download CPA Packet PDF</a></p>
            <hr/>
            <p style="color:#666;font-size:12px">MVP packet preview. Next update will include full schedules + tax templates.</p>
          </div>
        `,
      });
    }

    return res.status(200).json({
      success: true,
      tracking_number: tracking,
      packet_path: fileName,
      signedUrl: signed.signedUrl,
      newStatus: "packet_generated",
    });
  } catch (e) {
    console.error(e);
    return res.status(e.statusCode || 500).json({
      success: false,
      message: e.message || "Server error",
    });
  }
}
