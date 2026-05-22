# Backend opcional (futuro)

O app funciona 100% no navegador (`localStorage` + IndexedDB).

Para evoluir com sync entre dispositivos:

1. API REST (Node/Express ou Supabase)
2. Endpoints: `POST /auth/login`, `GET /users/:id/categories`
3. Substituir `saveUserData` por chamadas `fetch` com JWT
4. Recuperação de senha via e-mail

Estrutura sugerida:

```
server/
  index.js      # Express + CORS
  routes/
  models/
```

Não incluído nesta versão para manter o projeto estático e deployável no GitHub Pages.
