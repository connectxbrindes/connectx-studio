import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Sincronização de estoque PUXANDO da API do Tiny (direção nós → Tiny).
//
// Como o "push" (webhook) do Tiny não dispara nessa integração, aqui nós
// consultamos a API do Tiny e atualizamos o nosso estoque:
//   - product_model_variants.stock_quantity (capas, por produto+modelo)
//   - product_colors.stock_quantity          (térmicos, por produto+cor)
// O casamento é por SKU (bling_sku) IGNORANDO caixa (ilike) — o Tiny pode
// mandar minúsculo (iphone11) e nós guardamos maiúsculo (IPHONE11).
//
// Requer o secret TINY_API_TOKEN (token da API do Tiny — gerado em
// Configurações → Tokens de API). Na 1ª rodada, loga a resposta crua da
// primeira página pra confirmarmos o formato e ajustar se preciso.

const TINY_API = "https://api.tiny.com.br/api2";

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

  // SKUs que temos cadastrados (capas por modelo + térmicos por cor).
  const [{ data: variants }, { data: colors }] = await Promise.all([
    supabase.from("product_model_variants").select("bling_sku").not("bling_sku", "is", null),
    supabase.from("product_colors").select("bling_sku").not("bling_sku", "is", null),
  ]);
  const wanted = new Set(
    [...(variants ?? []), ...(colors ?? [])]
      .map((r) => (r.bling_sku ?? "").trim().toUpperCase())
      .filter(Boolean)
  );
  if (wanted.size === 0) return json({ ok: true, message: "Nenhum SKU cadastrado." });

  const obterSaldo = async (id: string): Promise<number | null> => {
    const url = `${TINY_API}/produto.obter.estoque.php?token=${token}&id=${id}&formato=json`;
    const res = await fetch(url).then((r) => r.json()).catch(() => null);
    const saldo = res?.retorno?.produto?.saldo;
    return saldo === undefined || saldo === null ? null : Number(saldo);
  };

  let pagina = 1;
  let numeroPaginas = 1;
  let atualizados = 0;
  const naoEncontrados = new Set(wanted);
  const amostras: Array<{ codigo: string; saldo: number }> = [];

  do {
    const url = `${TINY_API}/produtos.pesquisa.php?token=${token}&formato=json&pagina=${pagina}`;
    const res = await fetch(url).then((r) => r.json()).catch((e) => ({ erro: String(e) }));

    if (pagina === 1) {
      console.log("TINY_PRODUTOS_PESQUISA_P1:", JSON.stringify(res).slice(0, 1800));
    }

    const retorno = (res as { retorno?: Record<string, unknown> })?.retorno;
    if (!retorno || retorno.status !== "OK") {
      return json({ error: "Falha na API do Tiny (verifique o token/plano).", detalhe: retorno ?? res });
    }

    numeroPaginas = Number(retorno.numero_paginas ?? 1);
    const produtos = (retorno.produtos as Array<{ produto?: Record<string, unknown> }>) ?? [];

    for (const item of produtos) {
      const p = item.produto ?? item;
      const codigo = String(p.codigo ?? "").trim().toUpperCase();
      if (!codigo || !wanted.has(codigo)) continue;

      // Saldo pode vir na própria pesquisa; se não, busca pelo id do produto.
      let saldo: number | null =
        p.saldo !== undefined && p.saldo !== null ? Number(p.saldo) : null;
      if (saldo === null && p.id) saldo = await obterSaldo(String(p.id));
      if (saldo === null || Number.isNaN(saldo)) continue; // sem saldo confiável: não mexe

      await Promise.all([
        supabase.from("product_model_variants").update({ stock_quantity: saldo }).ilike("bling_sku", codigo),
        supabase.from("product_colors").update({ stock_quantity: saldo }).ilike("bling_sku", codigo),
      ]);
      atualizados++;
      naoEncontrados.delete(codigo);
      if (amostras.length < 15) amostras.push({ codigo, saldo });
    }

    pagina++;
  } while (pagina <= numeroPaginas && pagina <= 60);

  const resumo = { atualizados, nao_encontrados: [...naoEncontrados], amostras };
  console.log("TINY_SYNC_RESUMO:", JSON.stringify(resumo));
  return json({ ok: true, ...resumo });
});
