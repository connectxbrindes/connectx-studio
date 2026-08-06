import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Sincronização de estoque puxando da API do Tiny (nós → Tiny).
//
// Usa lista.atualizacoes.estoque.php: numa (poucas) chamada(s) o Tiny devolve
// os produtos que tiveram movimentação nos últimos ~30 dias JÁ COM O SALDO.
// Casamos o `codigo` do Tiny com o nosso `bling_sku` (ignorando caixa) e
// atualizamos stock_quantity em product_model_variants e product_colors.
// Saldo negativo (vendido a descoberto no Tiny) vira 0 = esgotado.
//
// Só o agendador dispara: precisa do header x-sync-secret = app_config.sync_secret.
// Requer o secret TINY_API_TOKEN.

const TINY_API = "https://api.tiny.com.br/api2";
const JANELA_DIAS = 27; // dentro do limite de 30 dias do Tiny, com folga
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function fmtData(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

Deno.serve(async (req: Request) => {
  const token = Deno.env.get("TINY_API_TOKEN");
  if (!token) return json({ error: "TINY_API_TOKEN não configurado nos secrets do Supabase." });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Autorização: só quem tem o segredo (o agendador) dispara.
  const { data: cfg } = await supabase.from("app_config").select("value").eq("key", "sync_secret").maybeSingle();
  if (cfg?.value && req.headers.get("x-sync-secret") !== cfg.value) {
    return json({ error: "unauthorized" }, 401);
  }

  // Mapa codigo(UPPER) -> saldo, a partir dos produtos alterados no período.
  const saldoPorCodigo = new Map<string, number>();
  const desde = fmtData(new Date(Date.now() - JANELA_DIAS * 24 * 60 * 60 * 1000));
  let pagina = 1;
  let numeroPaginas = 1;

  do {
    const url = `${TINY_API}/lista.atualizacoes.estoque.php?token=${token}&formato=json&dataAlteracao=${encodeURIComponent(desde)}&pagina=${pagina}`;
    const res = await fetch(url).then((r) => r.json()).catch((e) => ({ erro: String(e) }));
    const retorno = (res as { retorno?: any })?.retorno;

    if (retorno?.status !== "OK") {
      if (Number(retorno?.codigo_erro) === 20) break;
      return json({ error: "Falha na API do Tiny.", detalhe: retorno ?? res });
    }

    numeroPaginas = Number(retorno.numero_paginas ?? 1);
    for (const item of (retorno.produtos as Array<{ produto?: any }>) ?? []) {
      const p = item.produto ?? item;
      const codigo = String(p?.codigo ?? "").trim().toUpperCase();
      if (!codigo) continue;
      const saldo = Math.max(0, Math.trunc(Number(p?.saldo ?? 0)) || 0);
      saldoPorCodigo.set(codigo, saldo);
    }

    pagina++;
    if (pagina <= numeroPaginas) await sleep(600);
  } while (pagina <= numeroPaginas && pagina <= 30);

  const [{ data: variants }, { data: colors }] = await Promise.all([
    supabase.from("product_model_variants").select("bling_sku").not("bling_sku", "is", null),
    supabase.from("product_colors").select("bling_sku").not("bling_sku", "is", null),
  ]);
  const nossosSkus = [
    ...new Set(
      [...(variants ?? []), ...(colors ?? [])]
        .map((r) => (r.bling_sku ?? "").trim().toUpperCase())
        .filter(Boolean)
    ),
  ];

  const atualizados: Array<{ sku: string; saldo: number }> = [];
  for (const sku of nossosSkus) {
    if (!saldoPorCodigo.has(sku)) continue;
    const saldo = saldoPorCodigo.get(sku)!;
    await Promise.all([
      supabase.from("product_model_variants").update({ stock_quantity: saldo }).ilike("bling_sku", sku),
      supabase.from("product_colors").update({ stock_quantity: saldo }).ilike("bling_sku", sku),
    ]);
    atualizados.push({ sku, saldo });
  }

  const resumo = {
    ok: true,
    produtos_tiny_no_periodo: saldoPorCodigo.size,
    nossos_skus: nossosSkus.length,
    atualizados: atualizados.length,
    detalhe: atualizados,
  };
  console.log("TINY_SYNC_RESUMO:", JSON.stringify({ ...resumo, detalhe: undefined }));
  return json(resumo);
});
