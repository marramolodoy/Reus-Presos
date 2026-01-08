# Guia de Implantação e Atualização do Banco de Dados

## Atualização de Banco de Dados (Supabase)

Para suporte às novas funcionalidades (Tipo de Prisão), execute o seguinte comando no SQL Editor do Supabase:

```sql
alter table defendants 
add column if not exists prison_type text default 'Preventiva';
```

## 1. Enviando para o GitHub

1.  Crie um **novo repositório** no GitHub (pode ser "controle-reus").
2.  Abra o terminal na pasta do projeto e execute:

```bash
git add .
git commit -m "Preparação para deploy Vercel"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
git push -u origin main
```
*(Substitua `SEU_USUARIO` e `SEU_REPOSITORIO` pelos dados reais)*

**Importante:** Os arquivos de configuração sensíveis (`.env`, `.env.local`) **NÃO** serão enviados para o GitHub por segurança (estão no `.gitignore`).

## 2. Configurando na Vercel

1.  Acesse [vercel.com](https://vercel.com) e faça login (pode usar o GitHub).
2.  Clique em **"Add New..."** -> **"Project"**.
3.  Importe o repositório que você acabou de criar.
4.  Nas configurações do projeto ("Configure Project"):
    *   **Environment Variables**: Você PRECISARÁ adicionar as variáveis de ambiente manualmente, pois elas não vão para o GitHub. Copie os valores do seu arquivo local `.env` (ou `.env.example` para saber os nomes):
        *   `VITE_SUPABASE_URL`: (Copie o valor do seu arquivo local)
        *   `VITE_SUPABASE_ANON_KEY`: (Copie o valor do seu arquivo local)
        *   `GEMINI_API_KEY`: (Se estiver usando)
5.  Clique em **Deploy**.

## 3. Manutenção

*   Sempre que alterar o código, faça:
    ```bash
    git add .
    git commit -m "Descricao da mudanca"
    git push
    ```
*   A Vercel atualizará o site automaticamente.
