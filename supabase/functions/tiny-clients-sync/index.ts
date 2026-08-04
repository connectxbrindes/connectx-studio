import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Importa os contatos (clientes) do Tiny para a tabela resellers (Revendedores).
//
// Usa contatos.pesquisa.php (paginado). Casa por tiny_id: insere os novos e
// atualiza os existentes (nome/CNPJ-CPF/contato/telefone/email) SEM sobrescrever
// o `status` — assim o ativar/desativar manual do painel é preservado.
//
// Requer o secret TINY_API_TOKEN. Leve (poucas chamadas). Roda em agendamento.

const TINY_API = "https://api.tiny.com.br/api2";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const clean = (v: unknown) => {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
};

Deno.serve(async () => {
  const token = Deno.env.get("TINY_API_TOKEN");
  if (!token) return json({ error: "TINY_API_TOKEN não configurado nos secrets do Supabase." });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // 1) Coleta todos os contatos do Tiny (paginado).
  type Contato = {
    tiny_id: string;
    name: string;
    cnpj_cpf: string | null;
    contact_name: string | null;
    phone: string | null;
    email: string | null;
    ativo: boolean;
  };
  const contatos: Contato[] = [];
  let pagina = 1;
  let numeroPaginas = 1;

  do {
    const url = `${TINY_API}/contatos.pesquisa.php?token=${token}&formato=json&pagina=${pagina}`;
    const res = await fetch(url).then((r) => r.json()).catch((e) => ({ erro: String(e) }));
    const retorno = (res as { retorno?: any })?.retorno;

    if (retorno?.status !== "OK") {
      if (Number(retorno?.codigo_erro) === 20) break; // sem registros
      return json({ error: "Falha na API do Tiny (contatos).", detalhe: retorno ?? res });
    }

    numeroPaginas = Number(retorno.numero_paginas ?? 1);
    for (const item of (retorno.contatos as Array<{ contato?: any }>) ?? []) {
      const c = item.contato ?? item;
      const id = clean(c?.id);
      if (!id) continue;
      const nome = clean(c?.nome) ?? clean(c?.fantasia);
      if (!nome) continue; // sem nome não entra
      contatos.push({
        tiny_id: id,
        name: nome,
        cnpj_cpf: clean(c?.cpf_cnpj),
        contact_name: clean(c?.fantasia),
        phone: clean(c?.fone),
        email: clean(c?.email),
        ativo: String(c?.situacao ?? "").toLowerCase() !== "inativo",
      });
    }

    pagina++;
    if (pagina <= numeroPaginas) await sleep(600);
  } while (pagina <= numeroPaginas && pagina <= 40);

  if (contatos.length === 0) return json({ ok: true, message: "Nenhum contato retornado." });

  // 2) Quem já existe (por tiny_id) — pra decidir insert x update.
  const { data: existentes } = await supabase
    .from("resellers")
    .select("id, tiny_id")
    .not("tiny_id", "is", null);
  const idPorTiny = new Map<string, string>();
  for (const r of existentes ?? []) idPorTiny.set(String(r.tiny_id), r.id);

  let inseridos = 0;
  let atualizados = 0;

  // 3) Novos → insert em lote.
  const novos = contatos
    .filter((c) => !idPorTiny.has(c.tiny_id))
    .map((c) => ({
      name: c.name,
      cnpj_cpf: c.cnpj_cpf,
      contact_name: c.contact_name,
      phone: c.phone,
      email: c.email,
      commission_rate: 0,
      status: c.ativo ? "active" : "inactive",
      tiny_id: c.tiny_id,
    }));
  if (novos.length > 0) {
    // Em blocos pra não estourar payload.
    for (let i = 0; i < novos.length; i += 200) {
      const bloco = novos.slice(i, i + 200);
      const { error } = await supabase.from("resellers").insert(bloco);
      if (!error) inseridos += bloco.length;
      else console.error("Erro insert bloco:", error);
    }
  }

  // 4) Existentes → update SEM tocar no status (preserva o toggle manual).
  for (const c of contatos) {
    const rid = idPorTiny.get(c.tiny_id);
    if (!rid) continue;
    const { error } = await supabase
      .from("resellers")
      .update({
        name: c.name,
        cnpj_cpf: c.cnpj_cpf,
        contact_name: c.contact_name,
        phone: c.phone,
        email: c.email,
      })
      .eq("id", rid);
    if (!error) atualizados++;
  }

  const resumo = { ok: true, contatos_tiny: contatos.length, inseridos, atualizados };
  console.log("TINY_CLIENTS_SYNC:", JSON.stringify(resumo));
  return json(resumo);
});
