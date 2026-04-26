import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const textEncoder = new TextEncoder();
const SEND_LOCK_MS = 2 * 60 * 1000;

type SmsStatus = "NOT_SENT" | "SENDING" | "SENT" | "FAILED" | "SEND_UNKNOWN";

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
  return `공룡 축제 식품관 브뤼셀입니다
음식이 준비되었습니다
주문번호 : ${orderNumber}`;
}

function isRecentSmsAttempt(lastSmsAt: string | null) {
  if (!lastSmsAt) return false;
  const lastAttemptTime = new Date(lastSmsAt).getTime();
  if (Number.isNaN(lastAttemptTime)) return false;
  return Date.now() - lastAttemptTime < SEND_LOCK_MS;
}

async function updateSmsStatus(
  supabase: ReturnType<typeof createClient>,
  orderId: string,
  smsStatus: SmsStatus,
) {
  return supabase
    .from("orders")
    .update({ sms_status: smsStatus, last_sms_at: new Date().toISOString() })
    .eq("id", orderId);
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
    .select("id, order_number, phone_number, status, sms_status, last_sms_at")
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

  if (order.sms_status === "SENT") {
    return jsonResponse({
      ok: true,
      status: "SENT",
      alreadySent: true,
      message: "이미 발송 완료된 주문입니다.",
    });
  }

  if (order.sms_status === "SENDING" && isRecentSmsAttempt(order.last_sms_at)) {
    return jsonResponse(
      {
        ok: false,
        status: "SENDING",
        error: "이미 SMS 발송을 처리 중입니다. 잠시 후 상태를 확인하세요.",
      },
      409,
    );
  }

  if (order.sms_status === "SENDING" || order.sms_status === "SEND_UNKNOWN") {
    await updateSmsStatus(supabase, order.id, "SEND_UNKNOWN");
    return jsonResponse(
      {
        ok: false,
        status: "SEND_UNKNOWN",
        error:
          "이전 SMS 요청의 결과를 확인하지 못했습니다. 중복 발송을 막기 위해 재발송하지 않았습니다.",
      },
      409,
    );
  }

  const recipientPhone = normalizePhone(order.phone_number);
  if (!recipientPhone) {
    return jsonResponse({
      ok: false,
      error: "수신 전화번호가 올바르지 않습니다.",
    });
  }

  const { data: lockedOrder, error: lockError } = await supabase
    .from("orders")
    .update({ sms_status: "SENDING", last_sms_at: new Date().toISOString() })
    .eq("id", order.id)
    .in("sms_status", ["NOT_SENT", "FAILED"])
    .select("id")
    .maybeSingle();

  if (lockError || !lockedOrder) {
    return jsonResponse(
      {
        ok: false,
        status: "SEND_UNKNOWN",
        error: "SMS 발송 상태를 잠글 수 없어 전송하지 않았습니다.",
        detail: lockError?.message,
      },
      409,
    );
  }

  try {
    const date = new Date().toISOString();
    const salt = makeSalt();
    const signature = await hmacSha256Hex(solapiApiSecret, date + salt);
    const authorization = `HMAC-SHA256 apiKey=${solapiApiKey}, date=${date}, salt=${salt}, signature=${signature}`;

    let solapiResponse: Response;
    try {
      solapiResponse = await fetch("https://api.solapi.com/messages/v4/send", {
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
      });
    } catch (error) {
      await updateSmsStatus(supabase, order.id, "SEND_UNKNOWN");
      return jsonResponse(
        {
          ok: false,
          status: "SEND_UNKNOWN",
          error:
            error instanceof Error
              ? error.message
              : "SMS 요청 결과를 확인하지 못했습니다.",
        },
        502,
      );
    }

    const responseText = await solapiResponse.text();
    let responseBody: unknown = null;
    try {
      responseBody = JSON.parse(responseText);
    } catch {
      responseBody = responseText;
    }

    if (!solapiResponse.ok) {
      await updateSmsStatus(supabase, order.id, "FAILED");
      throw new Error(
        typeof responseBody === "string"
          ? responseBody
          : JSON.stringify(responseBody),
      );
    }

    const { error: sentUpdateError } = await updateSmsStatus(
      supabase,
      order.id,
      "SENT",
    );

    if (sentUpdateError) {
      return jsonResponse(
        {
          ok: false,
          status: "SEND_UNKNOWN",
          error:
            "SMS 요청은 접수됐지만 발송 상태를 저장하지 못했습니다. 상태 확인이 필요합니다.",
          detail: sentUpdateError.message,
        },
        500,
      );
    }

    return jsonResponse({ ok: true, status: "SENT", result: responseBody });
  } catch (error) {
    await updateSmsStatus(supabase, order.id, "FAILED");

    return jsonResponse({
      ok: false,
      status: "FAILED",
      error:
        error instanceof Error ? error.message : "SMS 발송에 실패했습니다.",
    });
  }
});
