import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Único jeito seguro de criar/atualizar o login de uma unidade a partir do
// painel: precisa da service role key (auth.admin.*), que nunca pode ir pro
// bundle do frontend. Essa função roda com essa chave só no servidor da
// Supabase; quem chama precisa estar autenticado como master (checado abaixo).
// Responde sempre com status 200 e { ok: true } ou { error: '...' } no corpo
// — evita depender de como cada versão do supabase-js expõe o body de um
// erro HTTP não-2xx em functions.invoke().
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

Deno.serve(async (req: Request) => {
  // Chamada vindo do navegador (origem diferente do endpoint da function) —
  // o browser manda um preflight OPTIONS antes do POST de verdade. Sem
  // responder isso com os headers de CORS, o fetch falha antes de chegar
  // no resto do código, e o supabase-js só reporta "Failed to send a
  // request to the Edge Function", sem detalhe nenhum.
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await callerClient.auth.getUser();
    if (!user) {
      return json({ error: "Não autenticado." });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: callerProfile } = await admin
      .from("profiles")
      .select("role, permissions")
      .eq("id", user.id)
      .single();
    // Master, ou staff com a seção "resellers" liberada.
    const canManage =
      callerProfile?.role === "master" ||
      (callerProfile?.role === "staff" && (callerProfile?.permissions ?? []).includes("resellers"));
    if (!canManage) {
      return json({ error: "Sem permissão para gerenciar logins de unidade." });
    }

    const { action, resellerId, email, password } = await req.json();
    if (!resellerId || !password || (action === "create" && !email)) {
      return json({ error: "Dados incompletos." });
    }

    if (action === "create") {
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (createError) return json({ error: createError.message });

      const { error: profileError } = await admin
        .from("profiles")
        .insert({ id: created.user.id, role: "reseller", reseller_id: resellerId, email });
      if (profileError) return json({ error: profileError.message });

      return json({ ok: true });
    }

    if (action === "reset_password") {
      const { data: profile, error: findError } = await admin
        .from("profiles")
        .select("id")
        .eq("reseller_id", resellerId)
        .single();
      if (findError || !profile) {
        return json({ error: "Essa unidade ainda não tem login criado." });
      }
      const { error: updateError } = await admin.auth.admin.updateUserById(profile.id, { password });
      if (updateError) return json({ error: updateError.message });

      return json({ ok: true });
    }

    return json({ error: "Ação inválida." });
  } catch (err) {
    return json({ error: (err as Error).message });
  }
});
