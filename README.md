# ConnectX Studio

Este é o repositório do frontend do ConnectX Studio.

## Guia de Deploy e Publicação

Abaixo estão os passos necessários para colocar o projeto no ar, conectando o repositório ao Vercel e configurando o domínio.

### A) GitHub — criar o repositório e subir

1. Em `github.com` → **New repository**. Nome, ex.: `connectx-studio`. Deixe vazio (sem README, sem `.gitignore` — o código já tem tudo). Clique em **Create repository**.
2. No seu terminal, dentro da pasta do projeto, rode (trocando `SEU-USUARIO` pelo seu usuário do GitHub):

```bash
git remote add origin https://github.com/SEU-USUARIO/connectx-studio.git
git push -u origin main
```

*(Vai abrir uma janela pra você logar no GitHub — é normal, é a autorização).*

### B) Vercel — conectar e publicar

1. Em `vercel.com` → **Add New** → **Project** → conecte sua conta do GitHub → importe o repositório `connectx-studio`. Ele detecta o Vite sozinho (build `npm run build`, saída `dist` — não precisa mexer).
2. **IMPORTANTE**: Antes de clicar em Deploy, abra **Environment Variables** e adicione as duas (pegue os valores no Supabase em Project Settings → API):
   - `VITE_SUPABASE_URL` → a URL do projeto
   - `VITE_SUPABASE_ANON_KEY` → a chave anon/public (a anon, não a service_role)
3. Clique em **Deploy**. Em ~1 min ele te dá um endereço de teste tipo `connectx-studio.vercel.app` — abra e confira que o Studio e o `/admin` carregam.

### C) Domínio — Configuração Final

1. No projeto na Vercel → **Settings** → **Domains** → adicione `connectxbrindes.com.br` (e, se quiser, `www.connectxbrindes.com.br`).
2. A Vercel vai mostrar os registros DNS que precisam ser criados (normalmente um registro `A` pro domínio raiz apontando pra um IP da Vercel + um `CNAME`).

> **Segurança:** Assim que terminarmos o DNS, gere uma nova chave da Hostinger (se você compartilhou a anterior no chat, ela ficou registrada no histórico). E, quando for repassar tokens do GitHub/Vercel, evite colar diretamente em chats se não for estritamente necessário.

> **Supabase:** Depois do domínio no ar, lembre-se de atualizar o Site URL no Supabase (**Authentication** → **URL Configuration**) para `https://connectxbrindes.com.br`, para a parte de login/senha ficar 100% alinhada ao domínio novo.
