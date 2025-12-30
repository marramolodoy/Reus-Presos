# Deploy do SysPenal Cloud na Vercel

Este projeto foi preparado para funcionar como um site estático moderno, utilizando **Supabase** para backend (banco de dados e autenticação).

## Como publicar (Deploy)

Como você já tem o código pronto aqui, a forma mais fácil de colocar no ar é usando a **Vercel** ou **Netlify**.

### Passo 1: GitHub (Recomendado)
Para subir na Vercel, o ideal é que o código esteja no GitHub.
1. Se você instalou o Git e fez o upload para o GitHub (conforme as instruções anteriores), vá para o Passo 2.
2. Se não, faça o upload manual dos arquivos para um repositório no [GitHub.com](https://github.com/new).
   - **Importante:** A raiz do repositório deve conter o arquivo `index.html`.

### Passo 2: Criar Projeto na Vercel
1. Acesse [vercel.com](https://vercel.com) e faça login (pode usar sua conta GitHub).
2. Clique em **"Add New..."** > **"Project"**.
3. Selecione o repositório do GitHub que você criou (`Import`).
4. **Configurações de Build:**
   - **Framework Preset:** Deixe como `Other` (Outro) ou `Static HTML`.
   - **Root Directory:** `./` (padrão).
   - **Build Command:** Deixe em branco (não precisa compilar nada, já está pronto).
   - **Output Directory:** Deixe em branco (padrão).
5. Clique em **Deploy**.

## Variáveis de Ambiente
Como usamos a biblioteca do Supabase diretamente no navegador (`@supabase/supabase-js` via CDN) e as chaves "anon" são públicas por design, **você não precisa configurar variáveis de ambiente na Vercel** para que o site funcione. O código já contém as chaves necessárias para conectar ao projeto `réus-presos`.

*(Nota: Segurança RLS (Row Level Security) já está ativada no banco de dados para proteger os dados).*

---
**Observação sobre arquivos antigos:**
Os arquivos de desenvolvimento anteriores (React/Vite) foram movidos para a pasta `backup_dev/` para evitar conflitos na hora do deploy. A Vercel vai ignorá-los e servir apenas o `index.html`.
