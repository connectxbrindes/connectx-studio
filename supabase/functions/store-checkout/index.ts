import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Loja virtual (/store) — duas ações:
//  - action "quote": cota o frete (Correios PAC/SEDEX via Melhor Envio) pro CEP.
//  - action "checkout": grava o pedido (RPC place_store_order, com a sessão do
//    cliente), RECALCULA o frete aqui no servidor e cria a preferência do
//    Mercado Pago (Checkout Pro). Devolve o link de pagamento.
// Segredos: MELHOR_ENVIO_TOKEN, MP_ACCESS_TOKEN (opcionais: MELHOR_ENVIO_SANDBOX,
// MELHOR_ENVIO_CONTACT_EMAIL, STORE_URL). Sem eles a loja segue funcionando
// só com retirada e pagamento combinado com a equipe.
// Responde sempre 200 com { ... } ou { error } (padrão das outras functions).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ME_TOKEN = Deno.env.get("MELHOR_ENVIO_TOKEN") ?? "";
const ME_BASE = Deno.env.get("MELHOR_ENVIO_SANDBOX") === "true"
  ? "https://sandbox.melhorenvio.com.br"
  : "https://melhorenvio.com.br";
const ME_CONTACT = Deno.env.get("MELHOR_ENVIO_CONTACT_EMAIL") ?? "";
const MP_TOKEN = Deno.env.get("MP_ACCESS_TOKEN") ?? "";
const STORE_URL = Deno.env.get("STORE_URL") ?? "https://www.connectxbrindes.com.br/store";
const PERSONALIZATION_FEE = 19.9; // igual a src/utils/price.js
const CORREIOS_SERVICES = "1,2"; // 1 = PAC, 2 = SEDEX

const admin = createClient(SUPABASE_URL, SERVICE_KEY);
const onlyDigits = (s: unknown) => String(s ?? "").replace(/\D/g, "");
const money = (n: number) => Math.round(n * 100) / 100;
const brl = (n: number) => `R$ ${n.toFixed(2).replace(".", ",")}`;

type CartLine = { product_id: string; quantity: number; personalized?: boolean };
type ShippingOption = { id: number; name: string; company: string; price: number; days: number | null };

const ERROR_MESSAGES: Record<string, string> = {
  TOKEN_INVALIDO: "Código não encontrado. Confira os caracteres do seu cartão.",
  TOKEN_JA_USADO: "Este código já foi utilizado.",
  TOKEN_INATIVO: "Este código não está ativo.",
  TOKEN_PRODUTO_AUSENTE: "Este código não vale para os produtos do seu carrinho.",
  NAO_AUTENTICADO: "Entre na sua conta para finalizar a compra.",
  NOME_OBRIGATORIO: "Informe seu nome.",
  CARRINHO_VAZIO: "Seu carrinho está vazio.",
  PRODUTO_INDISPONIVEL: "Um dos produtos do carrinho não está mais disponível.",
  ENDERECO_INCOMPLETO: "Preencha o endereço completo para entrega.",
  ENTREGA_INVALIDA: "Forma de entrega inválida.",
};
const friendly = (msg: string, fallback: string) => {
  const code = Object.keys(ERROR_MESSAGES).find((k) => msg.includes(k));
  return code ? ERROR_MESSAGES[code] : fallback;
};

async function quoteShipping(cep: string, lines: CartLine[]): Promise<{ options?: ShippingOption[]; error?: string }> {
  if (!ME_TOKEN) return { error: "Entrega pelos Correios ainda não está disponível. Escolha retirar na loja." };
  const toCep = onlyDigits(cep);
  if (toCep.length !== 8) return { error: "CEP inválido." };

  const { data: settings } = await admin.from("store_settings").select("*").eq("id", 1).single();
  if (!settings?.shipping_enabled || onlyDigits(settings?.origin_cep).length !== 8) {
    return { error: "Entrega pelos Correios ainda não está disponível. Escolha retirar na loja." };
  }

  const ids = [...new Set(lines.map((l) => l.product_id))];
  const { data: products } = await admin
    .from("products")
    .select("id, base_price, ship_weight_kg, ship_height_cm, ship_width_cm, ship_length_cm")
    .in("id", ids);
  const byId = new Map((products ?? []).map((p) => [p.id, p]));

  const meProducts = lines.map((l) => {
    const p = byId.get(l.product_id);
    if (!p) throw new Error("PRODUTO_INDISPONIVEL");
    return {
      id: l.product_id,
      width: Number(p.ship_width_cm ?? settings.default_width_cm),
      height: Number(p.ship_height_cm ?? settings.default_height_cm),
      length: Number(p.ship_length_cm ?? settings.default_length_cm),
      weight: Number(p.ship_weight_kg ?? settings.default_weight_kg),
      insurance_value: money(Number(p.base_price) + (l.personalized ? PERSONALIZATION_FEE : 0)),
      quantity: Math.max(1, Math.floor(Number(l.quantity) || 1)),
    };
  });

  const res = await fetch(`${ME_BASE}/api/v2/me/shipment/calculate`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${ME_TOKEN}`,
      "User-Agent": `ConnectX Brindes Loja${ME_CONTACT ? ` (${ME_CONTACT})` : ""}`,
    },
    body: JSON.stringify({
      from: { postal_code: onlyDigits(settings.origin_cep) },
      to: { postal_code: toCep },
      products: meProducts,
      options: { receipt: false, own_hand: false },
      services: CORREIOS_SERVICES,
    }),
  });
  if (!res.ok) {
    console.error("Melhor Envio", res.status, await res.text());
    return { error: "Não foi possível calcular o frete agora. Tente novamente ou escolha retirar na loja." };
  }
  const data = await res.json();
  const options: ShippingOption[] = (Array.isArray(data) ? data : [])
    .filter((s: any) => !s.error && (s.custom_price ?? s.price))
    .map((s: any) => ({
      id: Number(s.id),
      name: String(s.name),
      company: String(s.company?.name ?? "Correios"),
      price: money(Number(s.custom_price ?? s.price)),
      days: s.custom_delivery_time ?? s.delivery_time ?? null,
    }))
    .sort((a, b) => a.price - b.price);
  if (options.length === 0) return { error: "Nenhuma opção de entrega para este CEP. Escolha retirar na loja." };
  return { options };
}

const linesFromRows = (rows: any[]): CartLine[] =>
  rows.map((r) => ({
    product_id: String(r.product_id),
    quantity: Number(r.quantity) || 1,
    personalized: Array.isArray(r.personalization_snapshot) && r.personalization_snapshot.length > 0,
  }));

async function handleCheckout(req: Request, body: any) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: ERROR_MESSAGES.NAO_AUTENTICADO });

  const rows = Array.isArray(body.order_rows) ? body.order_rows : [];
  if (rows.length === 0) return json({ error: ERROR_MESSAGES.CARRINHO_VAZIO });
  const delivery = body.delivery === "shipping" ? "shipping" : "pickup";

  // Frete recalculado aqui — o valor mostrado no navegador não é confiável.
  let shipping: ShippingOption | null = null;
  if (delivery === "shipping") {
    const quote = await quoteShipping(body.address?.cep, linesFromRows(rows));
    if (quote.error) return json({ error: quote.error });
    shipping = quote.options!.find((o) => o.id === Number(body.shipping_service_id)) ?? null;
    if (!shipping) return json({ error: "Escolha novamente a forma de entrega (o frete foi atualizado)." });
  }

  const { data: placed, error: rpcError } = await userClient.rpc("place_store_order", {
    order_rows: rows,
    p_token: body.token || null,
    p_customer: body.customer ?? {},
    p_delivery: delivery,
    p_address: delivery === "shipping" ? body.address : null,
  });
  if (rpcError) {
    console.error("place_store_order", rpcError);
    return json({ error: friendly(rpcError.message ?? "", "Não foi possível enviar o pedido. Tente novamente.") });
  }

  const checkoutId: string = placed.checkout_id;
  const orderNumbers: string[] = placed.order_numbers ?? [];
  const itemsTotal = Number(placed.total ?? 0);

  if (shipping) {
    const label = `${shipping.company} ${shipping.name}`;
    await admin.from("store_checkouts")
      .update({ shipping_service: label, shipping_price: shipping.price, updated_at: new Date().toISOString() })
      .eq("id", checkoutId);
    const { data: orders } = await admin.from("orders").select("id, customer_note").eq("checkout_id", checkoutId);
    const freteNote = `FRETE: ${label} — ${brl(shipping.price)}${shipping.days ? ` (${shipping.days} dias úteis)` : ""}`;
    for (const o of orders ?? []) {
      await admin.from("orders").update({ customer_note: [o.customer_note, freteNote].filter(Boolean).join("\n") }).eq("id", o.id);
    }
  }

  const total = money(itemsTotal + (shipping?.price ?? 0));
  if (total <= 0) return json({ status: "free", order_numbers: orderNumbers, total: 0 });

  if (!MP_TOKEN) {
    await admin.from("store_checkouts").update({ status: "manual" }).eq("id", checkoutId);
    return json({ status: "manual", order_numbers: orderNumbers, total });
  }

  const { data: orderLines } = await admin
    .from("orders")
    .select("order_number, quantity, line_total, product:products ( name )")
    .eq("checkout_id", checkoutId)
    .order("sequence_number");
  const items = (orderLines ?? [])
    .filter((o: any) => Number(o.line_total) > 0)
    .map((o: any) => ({
      id: o.order_number,
      title: `${o.product?.name ?? "Produto"} personalizado (${o.quantity} un.)`,
      quantity: 1,
      unit_price: money(Number(o.line_total)),
      currency_id: "BRL",
    }));
  if (shipping) {
    items.push({ id: "frete", title: `Frete ${shipping.company} ${shipping.name}`, quantity: 1, unit_price: shipping.price, currency_id: "BRL" });
  }

  const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${MP_TOKEN}`, "X-Idempotency-Key": checkoutId },
    body: JSON.stringify({
      items,
      payer: { email: user.email, name: body.customer?.name },
      external_reference: checkoutId,
      notification_url: `${SUPABASE_URL}/functions/v1/mp-webhook`,
      back_urls: {
        success: `${STORE_URL}?pagamento=aprovado`,
        pending: `${STORE_URL}?pagamento=pendente`,
        failure: `${STORE_URL}?pagamento=falhou`,
      },
      auto_return: "approved",
      statement_descriptor: "CONNECTXBRINDES",
    }),
  });
  const pref = await mpRes.json().catch(() => ({}));
  if (!mpRes.ok || !pref.init_point) {
    console.error("Mercado Pago preference", mpRes.status, JSON.stringify(pref));
    await admin.from("store_checkouts").update({ status: "manual" }).eq("id", checkoutId);
    return json({ status: "manual", order_numbers: orderNumbers, total });
  }

  await admin.from("store_checkouts")
    .update({ mp_preference_id: pref.id, mp_init_point: pref.init_point, updated_at: new Date().toISOString() })
    .eq("id", checkoutId);

  return json({ status: "payment", init_point: pref.init_point, order_numbers: orderNumbers, total });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    if (body.action === "quote") {
      const lines: CartLine[] = Array.isArray(body.items) ? body.items : [];
      if (lines.length === 0) return json({ error: "Carrinho vazio." });
      return json(await quoteShipping(body.cep, lines));
    }
    if (body.action === "checkout") return await handleCheckout(req, body);
    if (body.action === "config") {
      return json({ shipping: Boolean(ME_TOKEN), payment: Boolean(MP_TOKEN) });
    }
    return json({ error: "Ação inválida." });
  } catch (err) {
    console.error(err);
    const msg = err instanceof Error ? err.message : "";
    return json({ error: friendly(msg, "Erro inesperado. Tente novamente.") });
  }
});
