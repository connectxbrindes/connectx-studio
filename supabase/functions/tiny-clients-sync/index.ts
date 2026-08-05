import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Sincroniza os contatos do Tiny para resellers (Revendedores) e CLASSIFICA
// cada um por tipo (Cliente/Outro), pra a aba mostrar só clientes.
//
// - Import: contatos.pesquisa.php (paginado) → insere novos (tiny_tipo=null).
// - Classificação: contato.obter.php por contato ainda sem tiny_tipo, lê
//   `tipos_contato` → 'cliente' se a lista tem "Cliente", senão 'outro'.
//   Feita em lote (pausa entre chamadas) pra respeitar o rate limit do Tiny.
// - A aba Revendedores esconde tiny_tipo='outro' (some da tela sem apagar).
//
// ?mode=classify → só classifica um lote (sem reimportar), pra acelerar a
// carga inicial. Sem param (cron) → importa novos + classifica um lote.
//
// Requer o secret TINY_API_TOKEN.

const TINY_API = "https://api.tiny.com.br/api2";
const CLASSIFY_BATCH = 80;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
const clean = (v: unknown) => {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
};
const isRateLimited = (retorno: any) =>
  Number(retorno?.codigo_erro) === 6 ||
  JSON.stringify(retorno?.erros ?? "").toLowerCase().includes("bloquead");

Deno.serve(async (req: Request) => {
  const token = Deno.env.get("TINY_API_TOKEN");
  if (!token) return json({ error: "TINY_API_TOKEN não configurado nos secrets do Supabase." });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const mode = new URL(req.url).searchParams.get("mode");
  let inseridos = 0;

  // ── A) Import de novos contatos (pulado no modo classify) ────────────────
  if (mode !== "classify") {
    const contatos: any[] = [];
    let pagina = 1;
    let numeroPaginas = 1;
    do {
      const url = `${TINY_API}/contatos.pesquisa.php?token=${token}&formato=json&pagina=${pagina}`;
      const res = await fetch(url).then((r) => r.json()).catch((e) => ({ erro: String(e) }));
      const retorno = res?.retorno;
      if (retorno?.status !== "OK") {
        if (Number(retorno?.codigo_erro) === 20) break;
        return json({ error: "Falha na API do Tiny (contatos).", detalhe: retorno ?? res });
      }
      numeroPaginas = Number(retorno.numero_paginas ?? 1);
      for (const item of retorno.contatos ?? []) {
        const c = item.contato ?? item;
        const id = clean(c?.id);
        const nome = clean(c?.nome) ?? clean(c?.fantasia);
        if (id && nome) contatos.push({ id, nome, c });
      }
      pagina++;
      if (pagina <= numeroPaginas) await sleep(600);
    } while (pagina <= numeroPaginas && pagina <= 40);

    const { data: existentes } = await supabase
      .from("resellers").select("tiny_id").not("tiny_id", "is", null);
    const jaTem = new Set((existentes ?? []).map((r) => String(r.tiny_id)));

    const novos = contatos
      .filter((x) => !jaTem.has(x.id))
      .map((x) => ({
        name: x.nome,
        cnpj_cpf: clean(x.c?.cpf_cnpj),
        contact_name: clean(x.c?.fantasia),
        phone: clean(x.c?.fone),
        email: clean(x.c?.email),
        commission_rate: 0,
        status: String(x.c?.situacao ?? "").toLowerCase() === "inativo" ? "inactive" : "active",
        tiny_id: x.id,
        tiny_tipo: null, // classificado no passo B
      }));
    for (let i = 0; i < novos.length; i += 200) {
      const { error } = await supabase.from("resellers").insert(novos.slice(i, i + 200));
      if (!error) inseridos += Math.min(200, novos.length - i);
      else console.error("Erro insert:", error);
    }
  }

  // ── B) Classifica um lote dos que ainda não têm tiny_tipo ────────────────
  const { data: pendentes } = await supabase
    .from("resellers")
    .select("id, tiny_id")
    .not("tiny_id", "is", null)
    .is("tiny_tipo", null)
    .limit(CLASSIFY_BATCH);

  let classificados = 0;
  let rateLimited = false;
  for (const r of pendentes ?? []) {
    const res = await fetch(
      `${TINY_API}/contato.obter.php?token=${token}&id=${r.tiny_id}&formato=json`
    ).then((x) => x.json()).catch((e) => ({ erro: String(e) }));
    const retorno = res?.retorno;
    if (isRateLimited(retorno)) { rateLimited = true; break; }

    const tipos = (retorno?.contato?.tipos_contato ?? []) as Array<{ tipo?: string }>;
    const ehCliente = tipos.some((t) => String(t?.tipo ?? "").trim().toLowerCase() === "cliente");
    await supabase
      .from("resellers")
      .update({ tiny_tipo: ehCliente ? "cliente" : "outro" })
      .eq("id", r.id);
    classificados++;
    await sleep(700);
  }

  const { count: restantes } = await supabase
    .from("resellers")
    .select("id", { count: "exact", head: true })
    .not("tiny_id", "is", null)
    .is("tiny_tipo", null);

  const resumo = { ok: true, inseridos, classificados, restantes: restantes ?? 0, rate_limited: rateLimited };
  console.log("TINY_CLIENTS_SYNC:", JSON.stringify(resumo));
  return json(resumo);
});
