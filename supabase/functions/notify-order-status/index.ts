import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Notifica a unidade (revendedor) por WhatsApp quando o status de um pedido
// muda. Usa a API oficial (Meta WhatsApp Cloud API) — o token fica em segredo
// do Supabase (WHATSAPP_TOKEN), nunca no frontend. Mensagens iniciadas pela
// empresa só podem ir por TEMPLATE aprovado, então cada status aponta pra um
// template pré-cadastrado na Meta.
//
// Fica INERTE até os segredos existirem: sem WHATSAPP_TOKEN/PHONE_NUMBER_ID
// devolve { sent:false, reason:'not_configured' } e nada quebra.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// status do pedido -> nome do template aprovado na Meta (idioma pt_BR).
const TEMPLATE_BY_STATUS: Record<string, string> = {
  pending: "pedido_pendente",
  canceled: "pedido_cancelado",
  completed: "pedido_concluido",
};

const GRAPH_VERSION = "v22.0";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await callerClient.auth.getUser();
    if (!user) {
      return json({ sent: false, reason: "unauthenticated" });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Só master ou staff com a seção "orders" pode disparar.
    const { data: callerProfile } = await admin
      .from("profiles")
      .select("role, permissions")
      .eq("id", user.id)
      .single();
    const canNotify =
      callerProfile?.role === "master" ||
      (callerProfile?.role === "staff" && (callerProfile?.permissions ?? []).includes("orders"));
    if (!canNotify) {
      return json({ sent: false, reason: "forbidden" });
    }

    const { orderId } = await req.json();
    if (!orderId) return json({ sent: false, reason: "no_order" });

    // Lê o pedido + telefone da unidade no servidor (fonte autoritativa).
    const { data: order, error: orderErr } = await admin
      .from("orders")
      .select("status, customer_name, sequence_number, reseller:resellers ( phone )")
      .eq("id", orderId)
      .single();
    if (orderErr || !order) return json({ sent: false, reason: "order_not_found" });

    const template = TEMPLATE_BY_STATUS[order.status as string];
    if (!template) return json({ sent: false, reason: "no_notification_for_status" });

    const rawPhone = (order.reseller as { phone?: string } | null)?.phone ?? "";
    const phone = rawPhone.replace(/\D/g, ""); // só dígitos (E.164 sem '+')
    if (!phone) return json({ sent: false, reason: "no_phone" });

    const token = Deno.env.get("WHATSAPP_TOKEN");
    const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
    if (!token || !phoneNumberId) {
      return json({ sent: false, reason: "not_configured" });
    }

    const orderNumber = `#${String(order.sequence_number).padStart(4, "0")}`;

    const resp = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: phone,
          type: "template",
          template: {
            name: template,
            language: { code: "pt_BR" },
            components: [
              {
                type: "body",
                parameters: [
                  { type: "text", text: order.customer_name },
                  { type: "text", text: orderNumber },
                ],
              },
            ],
          },
        }),
      },
    );

    const result = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      console.error("WhatsApp API error:", result);
      return json({ sent: false, reason: "whatsapp_error", detail: result?.error?.message ?? null });
    }

    return json({ sent: true });
  } catch (err) {
    return json({ sent: false, reason: "exception", detail: (err as Error).message });
  }
});
