# Deploy do SysPenal Cloud na Vercel

Este projeto é uma aplicação **React + Vite**. Para que funcione corretamente na Vercel, o processo de build deve ser executado no servidor.

## Como publicar (Deploy)

### Passo 1: GitHub (Recomendado)
Para subir na Vercel, o código deve estar no GitHub.
1. O repositório [marramolodoy/Reus-Presos](https://github.com/marramolodoy/Reus-Presos) já está configurado.
2. Certifique-se de que os arquivos `package.json`, `vite.config.ts` e a pasta `src/` estão na raiz do repositório.

### Passo 2: Criar Projeto na Vercel
1. Acesse [vercel.com](https://vercel.com) e faça login com sua conta GitHub.
2. Clique em **"Add New..."** > **"Project"**.
3. Selecione o repositório `Reus-Presos` (`Import`).
4. **Configurações de Build (Deixe o Padrão do Vite):**
   - **Framework Preset:** `Vite`.
   - **Build Command:** `npm run build`.
   - **Output Directory:** `dist`.
5. **Variáveis de Ambiente (CRÍTICO):**
   Antes de clicar em Deploy, expanda a seção **"Environment Variables"** e adicione as seguintes chaves do seu arquivo `.env`:
   - `VITE_SUPABASE_URL`: Sua URL do Supabase.
   - `VITE_SUPABASE_ANON_KEY`: Sua chave Anon do Supabase.
   - `GEMINI_API_KEY`: Sua chave de API do Google Gemini.
6. Clique em **Deploy**.

## Por que configurar Variáveis de Ambiente?
Diferente de um site estático simples, o Vite utiliza essas variáveis durante o processo de compilação para injetar as chaves de acesso ao Banco de Dados e à IA. Sem elas, o sistema não conseguirá salvar dados ou gerar análises jurídicas.

---
*(Nota: O arquivo `vercel.json` na raiz já cuida do roteamento SPA para que as páginas não deem erro 404 ao atualizar o navegador).*
