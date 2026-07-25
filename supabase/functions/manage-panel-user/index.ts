import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Cadastro/gestão de usuários do Painel (papel "staff"). Precisa da service
// role key (auth.admin.*), que só existe aqui no servidor. Gestão de usuário
// é exclusiva do master — validado pelo token de quem chama.
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
      .select("role")
      .eq("id", user.id)
      .single();
    if (callerProfile?.role !== "master") {
      return json({ error: "Apenas o master pode gerenciar usuários do painel." });
    }

    const { action, userId, email, password, permissions } = await req.json();

    if (action === "create") {
      if (!email || !password) return json({ error: "Informe e-mail e senha." });

      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (createError) return json({ error: createError.message });

      const { error: profileError } = await admin.from("profiles").insert({
        id: created.user.id,
        role: "staff",
        permissions: Array.isArray(permissions) ? permissions : [],
        email,
      });
      if (profileError) return json({ error: profileError.message });

      return json({ ok: true });
    }

    if (action === "update_permissions") {
      if (!userId) return json({ error: "Usuário inválido." });
      const { error } = await admin
        .from("profiles")
        .update({ permissions: Array.isArray(permissions) ? permissions : [] })
        .eq("id", userId);
      if (error) return json({ error: error.message });
      return json({ ok: true });
    }

    if (action === "reset_password") {
      if (!userId || !password) return json({ error: "Dados incompletos." });
      const { error } = await admin.auth.admin.updateUserById(userId, { password });
      if (error) return json({ error: error.message });
      return json({ ok: true });
    }

    if (action === "delete") {
      if (!userId) return json({ error: "Usuário inválido." });
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) return json({ error: error.message });
      return json({ ok: true });
    }

    return json({ error: "Ação inválida." });
  } catch (err) {
    return json({ error: (err as Error).message });
  }
});
