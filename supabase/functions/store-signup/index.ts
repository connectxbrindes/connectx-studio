import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Cadastro do cliente da loja virtual (/store). Cria o login já confirmado
// (o projeto exige confirmação de e-mail no signup público, o que travaria a
// compra) e grava o cadastro em store_customers. Depois o navegador faz o
// login normal com e-mail + senha.
// Responde sempre 200 com { ok: true } ou { error: '...' } (mesmo padrão das
// outras functions do projeto).
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const phone = String(body.phone ?? "").trim();
    const password = String(body.password ?? "");

    if (name.length < 2) return json({ error: "Informe seu nome." });
    if (!EMAIL_RE.test(email)) return json({ error: "E-mail inválido." });
    if (phone.replace(/\D/g, "").length < 10) return json({ error: "Informe um telefone com DDD." });
    if (password.length < 6) return json({ error: "A senha precisa ter pelo menos 6 caracteres." });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, phone, source: "store" },
    });
    if (error || !data?.user) {
      const msg = (error?.message ?? "").toLowerCase();
      if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
        return json({ error: "Este e-mail já tem cadastro. Use \"Já tenho conta\" para entrar." });
      }
      return json({ error: "Não foi possível criar o cadastro. Tente novamente." });
    }

    const { error: insertError } = await admin
      .from("store_customers")
      .insert({ id: data.user.id, name, email, phone });
    if (insertError) console.error("store_customers insert:", insertError);

    return json({ ok: true });
  } catch (err) {
    console.error(err);
    return json({ error: "Erro inesperado ao cadastrar." });
  }
});
