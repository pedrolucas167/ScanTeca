// Os testes não devem herdar credenciais de Web Push da máquina ou de .env.
// Casos dedicados podem definir fixtures com vi.stubEnv e simular o transporte.
process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "";
process.env.VAPID_PRIVATE_KEY = "";
process.env.VAPID_SUBJECT = "mailto:tests@example.test";
// A suíte principal nunca herda uma conexão de produção do shell ou do .env.
// A integração fornece seu próprio destino, validado antes de abrir o cliente.
process.env.DATABASE_URL = process.env.SCANTECA_TEST_DATABASE_URL || "postgresql://127.0.0.1:1/scanteca_unit_unreachable";

