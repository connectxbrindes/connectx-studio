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
// Disparo: o agendador usa o header x-sync-secret = app_config.sync_secret; o
// painel (master/staff-produtos) dispara pelo botão "Sincronizar estoque" com a
// própria sessão (JWT no Authorization). Basta um dos dois. Requer TINY_API_TOKEN.

const TINY_API = "https://api.tiny.com.br/api2";
const JANELA_DIAS = 27; // dentro do limite de 30 dias do Tiny, com folga
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sync-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function fmtData(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

Deno.serve(async (req: Request) => {
  // Preflight do navegador (o botão do painel chama via fetch/functions.invoke).
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const token = Deno.env.get("TINY_API_TOKEN");
  if (!token) return json({ error: "TINY_API_TOKEN não configurado nos secrets do Supabase." });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Autorização dupla:
  // 1) agendador (cron) → header x-sync-secret == app_config.sync_secret;
  // 2) painel → sessão válida de master (ou staff com permissão "products"),
  //    validada pelo JWT do header Authorization (mesmo padrão do
  //    create-reseller-login). Basta UM dos dois.
  const { data: cfg } = await supabase.from("app_config").select("value").eq("key", "sync_secret").maybeSingle();
  const secretOk = cfg?.value ? req.headers.get("x-sync-secret") === cfg.value : false;

  let userOk = false;
  if (!secretOk) {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (authHeader) {
      const caller = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user } } = await caller.auth.getUser();
      if (user) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("role, permissions")
          .eq("id", user.id)
          .single();
        userOk =
          prof?.role === "master" ||
          (prof?.role === "staff" && (prof?.permissions ?? []).includes("products"));
      }
    }
  }

  if (!secretOk && !userOk) {
    return json({ error: "unauthorized" }, 401);
  }

  // ---------------------------------------------------------------------------
  // MODO DIRETO (por SKU): consulta o saldo de cada SKU direto no Tiny, sem
  // depender da lista de atualizações (que só traz movimentações de nota/pedido
  // dos últimos ~27 dias). Serve para refletir ajustes MANUAIS de saldo feitos
  // no painel do Tiny. Aciona quando o body traz { skus: [...] } ou { all: true }.
  // Por SKU são 2 chamadas ao Tiny (pesquisa + obter estoque) com pausa, então é
  // usado sob demanda para poucos SKUs. Rate limit (erro 6) interrompe com aviso.
  let body: { skus?: unknown; all?: unknown; offset?: unknown; limit?: unknown } = {};
  try { body = await req.json(); } catch { /* body vazio = fluxo padrão */ }

  const querDireto = Array.isArray(body?.skus) || body?.all === true;
  if (querDireto) {
    let alvos: string[];
    if (body?.all === true) {
      const [{ data: variants }, { data: colors }] = await Promise.all([
        supabase.from("product_model_variants").select("bling_sku").not("bling_sku", "is", null),
        supabase.from("product_colors").select("bling_sku").not("bling_sku", "is", null),
      ]);
      // ordem estável (alfabética) para paginação por offset entre chamadas
      alvos = [...new Set([...(variants ?? []), ...(colors ?? [])]
        .map((r) => (r.bling_sku ?? "").trim().toUpperCase()).filter(Boolean))].sort();
    } else {
      alvos = [...new Set((body.skus as unknown[])
        .map((s) => String(s ?? "").trim().toUpperCase()).filter(Boolean))].sort();
    }

    // Paginação: o painel chama em lotes (ex.: 30 por vez) para não estourar o
    // tempo da função nem o limite do Tiny. total/proximo_offset guiam o loop.
    const total = alvos.length;
    const offset = Math.max(0, Math.trunc(Number(body?.offset ?? 0)) || 0);
    const limit = Math.max(1, Math.trunc(Number(body?.limit ?? total)) || total);
    const loteSkus = alvos.slice(offset, offset + limit);

    const atualizados: Array<{ sku: string; saldo: number }> = [];
    const nao_encontrados: string[] = [];
    let rateLimited = false;
    let processadosNoLote = 0;

    for (const sku of loteSkus) {
      // 1) acha o id do produto pelo codigo (SKU)
      const pesq = await fetch(`${TINY_API}/produtos.pesquisa.php?token=${token}&formato=json&pesquisa=${encodeURIComponent(sku)}`)
        .then((r) => r.json()).catch(() => null);
      await sleep(700);
      if (Number(pesq?.retorno?.codigo_erro) === 6) { rateLimited = true; break; }
      let tinyId: string | null = null;
      for (const it of (pesq?.retorno?.produtos ?? [])) {
        const p = it.produto ?? it;
        if (String(p?.codigo ?? "").trim().toUpperCase() === sku) { tinyId = String(p.id); break; }
      }
      if (!tinyId) { nao_encontrados.push(sku); processadosNoLote++; continue; }

      // 2) lê o saldo atual desse produto
      const est = await fetch(`${TINY_API}/produto.obter.estoque.php?token=${token}&id=${tinyId}&formato=json`)
        .then((r) => r.json()).catch(() => null);
      await sleep(700);
      if (Number(est?.retorno?.codigo_erro) === 6) { rateLimited = true; break; }
      const s = est?.retorno?.produto?.saldo;
      if (s === undefined || s === null) { nao_encontrados.push(sku); processadosNoLote++; continue; }
      const saldo = Math.max(0, Math.trunc(Number(s)) || 0);

      await Promise.all([
        supabase.from("product_model_variants").update({ stock_quantity: saldo }).ilike("bling_sku", sku),
        supabase.from("product_colors").update({ stock_quantity: saldo }).ilike("bling_sku", sku),
      ]);
      atualizados.push({ sku, saldo });
      processadosNoLote++;
    }

    // Quanto avançamos de verdade (o SKU que bateu no rate limit NÃO conta, para
    // ser reprocessado). proximo_offset = null quando terminou tudo.
    const avancou = offset + processadosNoLote;
    const proximo_offset = avancou < total ? avancou : null;

    const resumoDireto = {
      ok: !rateLimited,
      modo: "direto",
      total,
      offset,
      processados: avancou,
      proximo_offset,
      atualizados: atualizados.length,
      nao_encontrados,
      rate_limited: rateLimited,
      detalhe: atualizados,
    };
    console.log("TINY_SYNC_DIRETO:", JSON.stringify({ ...resumoDireto, detalhe: undefined }));
    return json(resumoDireto);
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
