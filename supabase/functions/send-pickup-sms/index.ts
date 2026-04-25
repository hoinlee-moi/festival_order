import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const textEncoder = new TextEncoder();

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacSha256Hex(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    textEncoder.encode(message),
  );
  return toHex(signature);
}

function makeSalt() {
  return crypto.randomUUID().replaceAll("-", "");
}

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

function buildMessageText(orderNumber: number) {
  return `안녕하세요.
공룡 축제 식품관 브뤼셀입니다
주문해주신 식사가 준비 되었습니다
와서 수령 부탁드립니다
주문 번호 : ${orderNumber}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" });
  }

  const solapiApiKey = Deno.env.get("SOLAPI_API_KEY");
  const solapiApiSecret = Deno.env.get("SOLAPI_API_SECRET");
  const senderPhone = normalizePhone(Deno.env.get("SOLAPI_SENDER_PHONE") ?? "");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    Deno.env.get("SUPABASE_ANON_KEY");

  if (!solapiApiKey || !solapiApiSecret || !senderPhone) {
    return jsonResponse({
      ok: false,
      error: "SOLAPI 환경변수가 설정되지 않았습니다.",
      detail: {
        hasApiKey: Boolean(solapiApiKey),
        hasApiSecret: Boolean(solapiApiSecret),
        hasSenderPhone: Boolean(senderPhone),
      },
    });
  }

  if (!supabaseUrl || !supabaseKey) {
    return jsonResponse({
      ok: false,
      error: "Supabase 환경변수가 설정되지 않았습니다.",
    });
  }

  const { orderId } = await req.json().catch(() => ({ orderId: null }));
  if (!orderId || typeof orderId !== "string") {
    return jsonResponse({ ok: false, error: "orderId가 필요합니다." });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, order_number, phone_number, status")
    .eq("id", orderId)
    .single();

  if (orderError || !order) {
    return jsonResponse({
      ok: false,
      error: "주문을 찾을 수 없습니다.",
      detail: orderError?.message,
    });
  }

  if (order.status !== "READY") {
    return jsonResponse({
      ok: false,
      error: "준비 완료 상태의 주문만 SMS를 발송할 수 있습니다.",
      detail: { currentStatus: order.status },
    });
  }

  const recipientPhone = normalizePhone(order.phone_number);
  if (!recipientPhone) {
    return jsonResponse({
      ok: false,
      error: "수신 전화번호가 올바르지 않습니다.",
    });
  }

  await supabase
    .from("orders")
    .update({ sms_status: "SENDING", last_sms_at: new Date().toISOString() })
    .eq("id", order.id);

  try {
    const date = new Date().toISOString();
    const salt = makeSalt();
    const signature = await hmacSha256Hex(solapiApiSecret, date + salt);
    const authorization = `HMAC-SHA256 apiKey=${solapiApiKey}, date=${date}, salt=${salt}, signature=${signature}`;

    const solapiResponse = await fetch(
      "https://api.solapi.com/messages/v4/send",
      {
        method: "POST",
        headers: {
          Authorization: authorization,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            to: recipientPhone,
            from: senderPhone,
            text: buildMessageText(order.order_number),
          },
        }),
      },
    );

    const responseText = await solapiResponse.text();
    let responseBody: unknown = null;
    try {
      responseBody = JSON.parse(responseText);
    } catch {
      responseBody = responseText;
    }

    if (!solapiResponse.ok) {
      throw new Error(
        typeof responseBody === "string"
          ? responseBody
          : JSON.stringify(responseBody),
      );
    }

    await supabase
      .from("orders")
      .update({ sms_status: "SENT", last_sms_at: new Date().toISOString() })
      .eq("id", order.id);

    return jsonResponse({ ok: true, result: responseBody });
  } catch (error) {
    await supabase
      .from("orders")
      .update({ sms_status: "FAILED", last_sms_at: new Date().toISOString() })
      .eq("id", order.id);

    return jsonResponse({
      ok: false,
      error:
        error instanceof Error ? error.message : "SMS 발송에 실패했습니다.",
    });
  }
});
