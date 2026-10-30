import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Notificação do Mercado Pago (Checkout Pro). Não confia no corpo recebido:
// busca o pagamento direto na API do MP com o nosso token e, se aprovado e
// com o valor certo, marca o checkout como pago e libera os pedidos
// (Pendente -> Em produção). Publicada com verify_jwt = false (o MP não manda JWT).

const MP_TOKEN = Deno.env.get("MP_ACCESS_TOKEN") ?? "";
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const ok = () => new Response("ok", { status: 200 });

Deno.serve(async (req: Request) => {
  try {
    const url = new URL(req.url);
    const body = await req.json().catch(() => ({} as any));
    const type = body.type ?? body.topic ?? url.searchParams.get("type") ?? url.searchParams.get("topic");
    const paymentId = body.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id");
    if (type !== "payment" || !paymentId || !MP_TOKEN) return ok();

    const res = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(String(paymentId))}`, {
      headers: { Authorization: `Bearer ${MP_TOKEN}` },
    });
    if (!res.ok) {
      console.error("MP payment fetch", res.status, await res.text());
      return new Response("retry", { status: 500 }); // MP tenta de novo
    }
    const payment = await res.json();
    const checkoutId = payment.external_reference;
    if (!checkoutId) return ok();

    const { data: checkout } = await admin.from("store_checkouts").select("id, total, status").eq("id", checkoutId).maybeSingle();
    if (!checkout) return ok();

    const update: Record<string, unknown> = {
      mp_payment_id: String(payment.id),
      mp_status: payment.status,
      updated_at: new Date().toISOString(),
    };

    const paidEnough = Number(payment.transaction_amount) + 0.01 >= Number(checkout.total);
    if (payment.status === "approved" && paidEnough && checkout.status !== "paid") {
      update.status = "paid";
      update.paid_at = new Date().toISOString();
      await admin.from("orders").update({ status: "producing" }).eq("checkout_id", checkoutId).eq("status", "pending");
    } else if (payment.status === "approved" && !paidEnough) {
      console.error("Valor pago menor que o total", checkoutId, payment.transaction_amount, checkout.total);
    }

    await admin.from("store_checkouts").update(update).eq("id", checkoutId);
    return ok();
  } catch (err) {
    console.error(err);
    return new Response("error", { status: 500 });
  }
});
