export default function SupabaseNotConfigured() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-6">
      <div className="max-w-md rounded-2xl border border-border bg-panel p-8 text-center shadow-sm">
        <h1 className="mb-2 text-xl font-bold">Supabase não configurado</h1>
        <p className="text-sm text-text-secondary">
          Defina <code className="rounded bg-bg px-1">VITE_SUPABASE_URL</code> e{' '}
          <code className="rounded bg-bg px-1">VITE_SUPABASE_ANON_KEY</code> num arquivo{' '}
          <code className="rounded bg-bg px-1">.env</code> na raiz do projeto (veja{' '}
          <code className="rounded bg-bg px-1">.env.example</code>) e reinicie o servidor para acessar o painel
          administrativo.
        </p>
      </div>
    </div>
  );
}
