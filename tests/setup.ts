// Os testes não devem herdar credenciais de Web Push da máquina ou de .env.
// Casos dedicados podem definir fixtures com vi.stubEnv e simular o transporte.
process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "";
process.env.VAPID_PRIVATE_KEY = "";
process.env.VAPID_SUBJECT = "mailto:tests@example.test";
