# Finanças

Aplicação web de finanças pessoais: login, perfis, renda, alocação com valor fixo, dashboard, simulador e backup.

## Como usar

1. Abra `index.html` (ou use [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer)).
2. Crie conta e entre no painel.
3. Configure **Dashboard**, **Renda**, **Alocação**, **Simulador** e **Dados**.

## Funcionalidades

| Área | Recursos |
|------|----------|
| Dashboard | Resumo de renda, % alocado, saldo, grupos |
| Perfil | Tema claro/escuro, múltiplos perfis financeiros |
| Renda | Bruto, descontos, líquido, histórico |
| Alocação | % ou R$, valor fixo, grupos, metas, rascunho, gráfico pizza/barras |
| Simulador | Testar renda sem salvar |
| Dados | Exportar JSON/CSV, importar backup |

## Estrutura

```
js/
  allocation-core.js   # Cálculos e migração
  auth.js              # Login (PBKDF2)
  features.js          # Dashboard, perfis, simulador…
  app.js               # UI alocação
  toast.js, theme.js, export-data.js, db.js
tests/test-runner.html # Testes manuais no navegador
```

## Deploy (GitHub Pages / Netlify)

- **Netlify:** arraste a pasta ou conecte o repositório (`netlify.toml` incluso).
- **GitHub Pages:** Settings → Pages → pasta raiz.

## Segurança

- Senhas com PBKDF2 (Web Crypto API); contas antigas em Base64 são migradas no login.
- Dados apenas no navegador (`localStorage` + espelho IndexedDB).

## Testes

Abra `tests/test-runner.html` no navegador.

## PWA

`manifest.json` + `sw.js` permitem instalar como app (cache offline básico).

## Screenshots

Adicione capturas em `docs/screenshots/` para o portfólio (Dashboard, Alocação, Tabela).

## Licença

Uso educacional / pessoal.
