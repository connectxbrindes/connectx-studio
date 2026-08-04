import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Sincronização de estoque PUXANDO da API do Tiny (direção nós → Tiny).
//
// Consulta APENAS os SKUs que temos cadastrados (um a um, com pausa entre as
// chamadas pra respeitar o rate limit da API v2 do Tiny) e atualiza:
//   - product_model_variants.stock_quantity (capas, por produto+modelo)
//   - product_colors.stock_quantity          (térmicos, por produto+cor)
// Casa por SKU (bling_sku) IGNORANDO caixa (ilike) — o Tiny pode mandar
// minúsculo (iphone11) e nós guardamos maiúsculo (IPHONE11).
//
// Requer o secret TINY_API_TOKEN (Configurações → Tokens de API no Tiny).

const TINY_API = "https://api.tiny.com.br/api2";
const DELAY_MS = 900; // pausa entre chamadas — respeita o limite do Tiny

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async () => {
  const token = Deno.env.get("TINY_API_TOKEN");
  if (!token) {
    return json({ error: "TINY_API_TOKEN não configurado nos secrets do Supabase." });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const [{ data: variants }, { data: colors }] = await Promise.all([
    supabase.from("product_model_variants").select("bling_sku").not("bling_sku", "is", null),
    supabase.from("product_colors").select("bling_sku").not("bling_sku", "is", null),
  ]);
  const skus = [
    ...new Set(
      [...(variants ?? []), ...(colors ?? [])]
        .map((r) => (r.bling_sku ?? "").trim().toUpperCase())
        .filter(Boolean)
    ),
  ];
  if (skus.length === 0) return json({ ok: true, message: "Nenhum SKU cadastrado." });

  // Detecta o bloqueio por rate limit do Tiny (codigo_erro 6).
  const isRateLimited = (retorno: any) =>
    Number(retorno?.codigo_erro) === 6 ||
    JSON.stringify(retorno?.erros ?? "").toLowerCase().includes("bloquead");

  const atualizados: Array<{ sku: string; saldo: number }> = [];
  const naoEncontrados: string[] = [];
  let rateLimited = false;
  let logouAmostra = false;

  for (const sku of skus) {
    const url = `${TINY_API}/produtos.pesquisa.php?token=${token}&formato=json&pesquisa=${encodeURIComponent(sku)}`;
    const res = await fetch(url).then((r) => r.json()).catch((e) => ({ erro: String(e) }));
    const retorno = (res as { retorno?: any })?.retorno;

    if (!logouAmostra) {
      console.log("TINY_PESQUISA_AMOSTRA:", sku, JSON.stringify(res).slice(0, 1500));
      logouAmostra = true;
    }

    if (isRateLimited(retorno)) {
      rateLimited = true;
      break; // para na hora; o que já sincronizou fica salvo
    }

    const produtos = (retorno?.produtos as Array<{ produto?: any }>) ?? [];
    const match = produtos
      .map((it) => it.produto ?? it)
      .find((p) => String(p?.codigo ?? "").trim().toUpperCase() === sku);

    if (!match) {
      naoEncontrados.push(sku);
      await sleep(DELAY_MS);
      continue;
    }

    let saldo: number | null =
      match.saldo !== undefined && match.saldo !== null ? Number(match.saldo) : null;

    // Se a pesquisa não trouxe saldo, busca pelo id do produto.
    if (saldo === null && match.id) {
      await sleep(DELAY_MS);
      const est = await fetch(
        `${TINY_API}/produto.obter.estoque.php?token=${token}&id=${match.id}&formato=json`
      )
        .then((r) => r.json())
        .catch(() => null);
      if (isRateLimited(est?.retorno)) {
        rateLimited = true;
        break;
      }
      const s = est?.retorno?.produto?.saldo;
      saldo = s === undefined || s === null ? null : Number(s);
    }

    if (saldo !== null && !Number.isNaN(saldo)) {
      await Promise.all([
        supabase.from("product_model_variants").update({ stock_quantity: saldo }).ilike("bling_sku", sku),
        supabase.from("product_colors").update({ stock_quantity: saldo }).ilike("bling_sku", sku),
      ]);
      atualizados.push({ sku, saldo });
    } else {
      naoEncontrados.push(sku);
    }

    await sleep(DELAY_MS);
  }

  const resumo = {
    ok: true,
    total_skus: skus.length,
    atualizados,
    nao_encontrados: naoEncontrados,
    rate_limited: rateLimited,
  };
  console.log("TINY_SYNC_RESUMO:", JSON.stringify(resumo));
  return json(resumo);
});
