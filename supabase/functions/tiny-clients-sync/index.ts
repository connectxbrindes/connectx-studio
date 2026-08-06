import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Importa contatos do Tiny para resellers e classifica por tipo (Cliente/Outro).
// Só o agendador dispara: header x-sync-secret = app_config.sync_secret.
// ?mode=classify → só classifica um lote. Requer TINY_API_TOKEN.

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

  // Autorização: só quem tem o segredo (o agendador) dispara.
  const { data: cfg } = await supabase.from("app_config").select("value").eq("key", "sync_secret").maybeSingle();
  if (cfg?.value && req.headers.get("x-sync-secret") !== cfg.value) {
    return json({ error: "unauthorized" }, 401);
  }

  const mode = new URL(req.url).searchParams.get("mode");
  let inseridos = 0;

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
        tiny_tipo: null,
      }));
    for (let i = 0; i < novos.length; i += 200) {
      const { error } = await supabase.from("resellers").insert(novos.slice(i, i + 200));
      if (!error) inseridos += Math.min(200, novos.length - i);
      else console.error("Erro insert:", error);
    }
  }

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
