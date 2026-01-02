// /api/_lib/paypal.js

export function paypalBase() {
  const env = (process.env.PAYPAL_ENV || "sandbox").toLowerCase();
  return env === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}

export async function paypalAccessToken() {
  const client = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_SECRET;

  if (!client || !secret) throw new Error("Missing PAYPAL_CLIENT_ID or PAYPAL_SECRET");

  const auth = Buffer.from(`${client}:${secret}`).toString("base64");
  const res = await fetch(`${paypalBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error_description || "PayPal token error");
  }
  return data.access_token;
}

export function getBaseUrl(req) {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}

export async function paypalCreateOrder({ token, amount, trackingNumber, returnUrl, cancelUrl, description }) {
  const res = await fetch(`${paypalBase()}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: trackingNumber,
          amount: { currency_code: "USD", value: Number(amount).toFixed(2) },
          description,
        },
      ],
      application_context: {
        brand_name: "AZ Film Credit",
        user_action: "PAY_NOW",
        return_url: returnUrl,
        cancel_url: cancelUrl,
      },
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`PayPal order create failed: ${JSON.stringify(data)}`);

  const approveUrl = (data.links || []).find((l) => l.rel === "approve")?.href;
  return { paypalOrderId: data.id, approveUrl };
}

export async function paypalCaptureOrder({ token, paypalOrderId }) {
  const res = await fetch(`${paypalBase()}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`PayPal capture failed: ${JSON.stringify(data)}`);
  return data;
}
