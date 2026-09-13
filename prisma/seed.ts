/**
 * Seed de desenvolvimento — popula um acervo realista para testar o Oráculo.
 *
 * Uso:
 *   npm run db:seed
 *
 * O userId é resolvido assim:
 *   1. SEED_USER_ID no .env (recomendado — seu user_... do Clerk)
 *   2. userId do primeiro Book existente
 *   3. userId do primeiro LibrarySetting existente
 *
 * Idempotente: livros são upsert por (isbn, userId) e embeddings só são
 * gerados quando o campo está NULL.
 */

process.loadEnvFile();

const { prisma } = await import("../lib/prisma");
const { generateEmbedding, bookToEmbeddingText } = await import(
  "../lib/embeddings"
);

type SeedBook = {
  isbn: string;
  title: string;
  author: string;
  publishedDate?: string;
  synopsis: string;
  genre: string;
  pages: number;
  status: "READ" | "READING" | "TO_READ" | "WISHLIST";
  rating?: number;
  notes?: string;
  currentPage?: number;
};

const SEED_BOOKS: SeedBook[] = [
  {
    isbn: "9788535914849",
    title: "1984",
    author: "George Orwell",
    publishedDate: "1949",
    synopsis:
      "Numa sociedade totalitária, Winston Smith trabalha reescrevendo o passado para o Partido. Ao se apaixonar por Júlia, passa a questionar o Grande Irmão e o controle absoluto sobre a verdade.",
    genre: "Ficção distópica",
    pages: 416,
    status: "READ",
    rating: 5,
    notes: "Releitura anual. O capítulo sobre a duplipensar continua assustadoramente atual.",
  },
  {
    isbn: "9788525056009",
    title: "Admirável Mundo Novo",
    author: "Aldous Huxley",
    publishedDate: "1932",
    synopsis:
      "Num futuro onde humanos são condicionados geneticamente e entorpecidos pelo soma, Bernard Marx questiona a felicidade fabricada ao conhecer o Selvagem, criado fora da civilização.",
    genre: "Ficção distópica",
    pages: 312,
    status: "READ",
    rating: 4,
  },
  {
    isbn: "9788533613379",
    title: "A Revolução dos Bichos",
    author: "George Orwell",
    publishedDate: "1945",
    synopsis:
      "Os animais da Granja do Solar expulsam os humanos e fundam uma sociedade igualitária — até os porcos assumirem o poder e reescreverem as regras.",
    genre: "Fábula política",
    pages: 152,
    status: "READ",
    rating: 5,
  },
  {
    isbn: "9788576570691",
    title: "Duna",
    author: "Frank Herbert",
    publishedDate: "1965",
    synopsis:
      "Paul Atreides é levado ao planeta desértico Arrakis, única fonte da especiaria mélange. Traído, ele se une aos Fremen e abraça um destino messiânico.",
    genre: "Ficção científica",
    pages: 680,
    status: "READ",
    rating: 5,
    notes: "Worldbuilding denso. A ecologia de Arrakis é personagem própria.",
  },
  {
    isbn: "9788576572718",
    title: "Fundação",
    author: "Isaac Asimov",
    publishedDate: "1951",
    synopsis:
      "Hari Seldon prevê a queda do Império Galáctico pela psico-história e cria a Fundação para encurtar a era das trevas de 30 mil para mil anos.",
    genre: "Ficção científica",
    pages: 320,
    status: "READING",
    currentPage: 140,
  },
  {
    isbn: "9788576574248",
    title: "Neuromancer",
    author: "William Gibson",
    publishedDate: "1984",
    synopsis:
      "Case, um hacker decadente, é contratado para um último trabalho que o leva ao ciberespaço e a uma inteligência artificial que quer se libertar.",
    genre: "Cyberpunk",
    pages: 320,
    status: "TO_READ",
  },
  {
    isbn: "9788573027108",
    title: "O Guia do Mochileiro das Galáxias",
    author: "Douglas Adams",
    publishedDate: "1979",
    synopsis:
      "Arthur Dent escapa da destruição da Terra segundos antes de ela virar uma via expressa hiperespacial, e viaja pelo universo com a toalha e o Guia.",
    genre: "Ficção científica humor",
    pages: 208,
    status: "READ",
    rating: 4,
  },
  {
    isbn: "9788595084759",
    title: "O Senhor dos Anéis: A Sociedade do Anel",
    author: "J.R.R. Tolkien",
    publishedDate: "1954",
    synopsis:
      "Frodo herda o Um Anel e parte do Condado com oito companheiros para destruí-lo em Mordor, antes que Sauron o recupere.",
    genre: "Fantasia épica",
    pages: 576,
    status: "READ",
    rating: 5,
  },
  {
    isbn: "9788595084742",
    title: "O Hobbit",
    author: "J.R.R. Tolkien",
    publishedDate: "1937",
    synopsis:
      "Bilbo Bolseiro é convencido por Gandalf a acompanhar treze anões até a Montanha Solitária para recuperar o tesouro guardado pelo dragão Smaug.",
    genre: "Fantasia",
    pages: 336,
    status: "READ",
    rating: 5,
  },
  {
    isbn: "9788578270698",
    title: "O Nome do Vento",
    author: "Patrick Rothfuss",
    publishedDate: "2007",
    synopsis:
      "Kvothe, agora um estalajadeiro recluso, narra sua juventude: a tragédia com os Chandriano, os anos na Universidade e a busca pelo nome das coisas.",
    genre: "Fantasia",
    pages: 656,
    status: "READING",
    currentPage: 320,
    notes: "A prosa é quase poesia. Sistema de magia da simpatia muito bem amarrado.",
  },
  {
    isbn: "9788556510761",
    title: "A Guerra dos Tronos",
    author: "George R.R. Martin",
    publishedDate: "1996",
    synopsis:
      "Nos Sete Reinos de Westeros, a morte da Mão do Rei arrasta os Stark para o jogo de tronos, enquanto além da Muralha uma ameaça antiga desperta.",
    genre: "Fantasia",
    pages: 600,
    status: "READ",
    rating: 4,
  },
  {
    isbn: "9788532530783",
    title: "Harry Potter e a Pedra Filosofal",
    author: "J.K. Rowling",
    publishedDate: "1997",
    synopsis:
      "Harry descobre aos onze anos que é bruxo e parte para Hogwarts, onde faz amigos, aprende magia e desvenda o mistério da Pedra Filosofal.",
    genre: "Fantasia",
    pages: 264,
    status: "READ",
    rating: 4,
  },
  {
    isbn: "9788501401940",
    title: "Cem Anos de Solidão",
    author: "Gabriel García Márquez",
    publishedDate: "1967",
    synopsis:
      "A saga da família Buendía em Macondo, entre guerras, amores impossíveis e o realismo mágico que dissolve fronteiras entre o mito e a história.",
    genre: "Realismo mágico",
    pages: 448,
    status: "READ",
    rating: 5,
    notes: "O início com o gelo e o pelotão de fuzilamento é o melhor parágrafo de abertura que já li.",
  },
  {
    isbn: "9788535911664",
    title: "Dom Casmurro",
    author: "Machado de Assis",
    publishedDate: "1899",
    synopsis:
      "Bentinho narra sua vida e o amor por Capitu, tentando provar — ou dissimular — a traição que o transformou no 'casmurro' do título.",
    genre: "Romance brasileiro",
    pages: 256,
    status: "READ",
    rating: 5,
  },
  {
    isbn: "9788520927823",
    title: "O Cortiço",
    author: "Aluísio Azevedo",
    publishedDate: "1890",
    synopsis:
      "Num cortiço carioca, o português João Romão enriquece explorando os moradores, enquanto a comunidade fervilha em cenas naturalistas de desejo e violência.",
    genre: "Naturalismo",
    pages: 336,
    status: "TO_READ",
  },
  {
    isbn: "9788520931790",
    title: "Grande Sertão: Veredas",
    author: "João Guimarães Rosa",
    publishedDate: "1956",
    synopsis:
      "O jagunço Riobaldo conta suas andanças pelo sertão, o pacto com o diabo que talvez tenha feito e o amor por Diadorim.",
    genre: "Romance brasileiro",
    pages: 624,
    status: "READING",
    currentPage: 210,
    notes: "Leitura lenta, exige rendição. A linguagem inventa um sertão inteiro.",
  },
  {
    isbn: "9788535921694",
    title: "Capitães da Areia",
    author: "Jorge Amado",
    publishedDate: "1937",
    synopsis:
      "Um bando de meninos abandonados vive de furtos em Salvador, liderados por Pedro Bala, até a repressão policial e o amor mudarem seus destinos.",
    genre: "Romance brasileiro",
    pages: 280,
    status: "READ",
    rating: 4,
  },
  {
    isbn: "9788575422398",
    title: "O Alquimista",
    author: "Paulo Coelho",
    publishedDate: "1988",
    synopsis:
      "O pastor Santiago deixa a Andaluzia atrás de um tesouro nas pirâmides do Egito e aprende a ouvir os sinais da sua Lenda Pessoal.",
    genre: "Fábula",
    pages: 208,
    status: "READ",
    rating: 3,
  },
  {
    isbn: "9788535919554",
    title: "Crime e Castigo",
    author: "Fiódor Dostoiévski",
    publishedDate: "1866",
    synopsis:
      "Raskólnikov assassina uma agiota para provar sua teoria do homem extraordinário, mas a culpa e o olhar de Sônia o conduzem à confissão.",
    genre: "Romance psicológico",
    pages: 592,
    status: "READ",
    rating: 5,
    notes: "Os diálogos com Porfírio são um duelo de xadrez psicológico.",
  },
  {
    isbn: "9788595081512",
    title: "O Pequeno Príncipe",
    author: "Antoine de Saint-Exupéry",
    publishedDate: "1943",
    synopsis:
      "Um aviador perdido no deserto encontra um príncipe vindo de um asteroide, que lhe ensina sobre a rosa, a raposa e o essencial invisível aos olhos.",
    genre: "Fábula",
    pages: 96,
    status: "READ",
    rating: 4,
  },
  {
    isbn: "9788544001820",
    title: "Orgulho e Preconceito",
    author: "Jane Austen",
    publishedDate: "1813",
    synopsis:
      "Elizabeth Bennet enfrenta a pressão por casamento na Inglaterra regencial e revê seus juízos sobre o orgulhoso Sr. Darcy.",
    genre: "Romance clássico",
    pages: 424,
    status: "TO_READ",
  },
  {
    isbn: "9788575426563",
    title: "O Código Da Vinci",
    author: "Dan Brown",
    publishedDate: "2003",
    synopsis:
      "O simbologista Robert Langdon investiga um assassinato no Louvre que esconde um segredo capaz de abalar os fundamentos do cristianismo.",
    genre: "Thriller",
    pages: 432,
    status: "READ",
    rating: 3,
  },
  {
    isbn: "9788525437826",
    title: "Sapiens: Uma Breve História da Humanidade",
    author: "Yuval Noah Harari",
    publishedDate: "2011",
    synopsis:
      "Como o Homo sapiens dominou o planeta: das revoluções cognitiva e agrícola às ficções compartilhadas — dinheiro, impérios e religiões.",
    genre: "Não-ficção",
    pages: 464,
    status: "READ",
    rating: 4,
    notes: "O capítulo sobre 'mitos compartilhados' conversa direto com 1984.",
  },
  {
    isbn: "9788580576469",
    title: "Uma Breve História do Tempo",
    author: "Stephen Hawking",
    publishedDate: "1988",
    synopsis:
      "Do Big Bang aos buracos negros: Hawking explica a cosmologia moderna e a busca por uma teoria unificada do universo.",
    genre: "Divulgação científica",
    pages: 256,
    status: "TO_READ",
  },
  {
    isbn: "9788575423258",
    title: "Meditações",
    author: "Marco Aurélio",
    publishedDate: "180",
    synopsis:
      "Anotações privadas do imperador romano sobre estoicismo: dever, impermanência e o domínio da própria mente diante do que não controlamos.",
    genre: "Filosofia",
    pages: 368,
    status: "READING",
    currentPage: 95,
  },
  {
    isbn: "9788578275426",
    title: "A Arte da Guerra",
    author: "Sun Tzu",
    publishedDate: "-500",
    synopsis:
      "Tratado militar chinês sobre estratégia: vencer sem lutar, conhecer o inimigo e a si mesmo, e usar o terreno e o tempo a seu favor.",
    genre: "Estratégia",
    pages: 160,
    status: "READ",
    rating: 3,
  },
  {
    isbn: "9788573264907",
    title: "Assim Falou Zaratustra",
    author: "Friedrich Nietzsche",
    publishedDate: "1883",
    synopsis:
      "Zaratustra desce da montanha para anunciar o Übermensch e a morte de Deus, em sermões poéticos sobre vontade de potência e eterno retorno.",
    genre: "Filosofia",
    pages: 440,
    status: "WISHLIST",
  },
  {
    isbn: "9788520927847",
    title: "O Mito de Sísifo",
    author: "Albert Camus",
    publishedDate: "1942",
    synopsis:
      "Ensaio sobre o absurdo: diante de um mundo sem sentido, o suicídio é legítimo? Camus responde que devemos imaginar Sísifo feliz.",
    genre: "Filosofia",
    pages: 192,
    status: "TO_READ",
  },
  {
    isbn: "9788575225630",
    title: "Entendendo Algoritmos",
    author: "Aditya Y. Bhargava",
    publishedDate: "2015",
    synopsis:
      "Guia ilustrado de algoritmos: busca binária, ordenação, grafos, programação dinâmica e vizinhos mais próximos, com exemplos em Python.",
    genre: "Computação",
    pages: 264,
    status: "READ",
    rating: 4,
  },
  {
    isbn: "9788576082675",
    title: "Código Limpo",
    author: "Robert C. Martin",
    publishedDate: "2008",
    synopsis:
      "Princípios e práticas para escrever código legível: nomes significativos, funções pequenas, testes e refatoração contínua.",
    genre: "Computação",
    pages: 456,
    status: "READ",
    rating: 5,
    notes: "Releio capítulos antes de code reviews pesados.",
  },
];

const SEED_DIARY: { isbn: string; type: "REFLECTION" | "QUOTE"; content: string; page?: number }[] = [
  {
    isbn: "9788535914849",
    type: "QUOTE",
    content: "A liberdade é a liberdade de dizer que dois mais dois são quatro. Se isso for concedido, todo o resto virá por si.",
    page: 81,
  },
  {
    isbn: "9788535914849",
    type: "REFLECTION",
    content: "A duplipensar me fez pensar em como a gente normaliza contradições no feed todos os dias. Vigilância hoje é consentida, não imposta.",
  },
  {
    isbn: "9788576570691",
    type: "REFLECTION",
    content: "O medo é o matador de mentes. A ladainha contra o medo funciona como mantra real em semana de entrega no trabalho.",
  },
  {
    isbn: "9788520931790",
    type: "QUOTE",
    content: "O sertão é dentro da gente.",
    page: 210,
  },
  {
    isbn: "9788535919554",
    type: "REFLECTION",
    content: "Raskólnikov não é punido pela lei, mas pela própria consciência. Dostoiévski entendeu a culpa antes da psicologia existir.",
  },
];

async function detectUserId(): Promise<string | null> {
  if (process.env.SEED_USER_ID) return process.env.SEED_USER_ID;
  const book = await prisma.book.findFirst({ select: { userId: true } });
  if (book) return book.userId;
  const setting = await prisma.librarySetting.findFirst({
    select: { userId: true },
  });
  return setting?.userId ?? null;
}

async function main() {
  const userId = await detectUserId();
  if (!userId) {
    throw new Error(
      "Nenhum userId encontrado. Defina SEED_USER_ID=<seu user_... do Clerk> no .env e rode de novo."
    );
  }
  console.log(`[seed] userId: ${userId}`);

  const collection = await prisma.collection.upsert({
    where: { userId_name: { userId, name: "Biblioteca" } },
    update: {},
    create: { userId, name: "Biblioteca" },
  });
  console.log(`[seed] collection: ${collection.name} (${collection.id})`);

  let created = 0;
  let embedded = 0;
  let skippedEmbeddings = 0;

  for (const seed of SEED_BOOKS) {
    const { status, rating, notes, currentPage, ...data } = seed;
    const book = await prisma.book.upsert({
      where: { isbn_userId: { isbn: seed.isbn, userId } },
      update: {},
      create: {
        ...data,
        userId,
        collectionId: collection.id,
        status,
        rating: rating ?? null,
        notes: notes ?? null,
        currentPage: currentPage ?? null,
        startedAt: status === "READING" || status === "READ" ? new Date() : null,
        finishedAt: status === "READ" ? new Date() : null,
      },
    });
    if (book.createdAt.getTime() === book.updatedAt.getTime()) created++;

    const [{ has }] = await prisma.$queryRaw<{ has: boolean }[]>`
      SELECT embedding IS NOT NULL AS has FROM "Book" WHERE id = ${book.id}
    `;
    if (has) {
      skippedEmbeddings++;
      continue;
    }

    const embedding = await generateEmbedding(bookToEmbeddingText(book));
    if (embedding) {
      const vector = `[${embedding.join(",")}]`;
      await prisma.$executeRaw`
        UPDATE "Book" SET embedding = ${vector}::vector WHERE id = ${book.id}
      `;
      embedded++;
      process.stdout.write(`\r[seed] embeddings: ${embedded} gerados`);
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  console.log(
    `\n[seed] livros: ${created} novos, ${SEED_BOOKS.length - created} já existiam`
  );
  console.log(
    `[seed] embeddings: ${embedded} gerados, ${skippedEmbeddings} já existiam`
  );

  // Diary entries — alimentam a "memória recente do diário" do oráculo
  let diaryCreated = 0;
  for (const entry of SEED_DIARY) {
    const book = await prisma.book.findUnique({
      where: { isbn_userId: { isbn: entry.isbn, userId } },
      select: { id: true },
    });
    if (!book) continue;
    const exists = await prisma.diaryEntry.findFirst({
      where: { userId, bookId: book.id, content: entry.content },
      select: { id: true },
    });
    if (exists) continue;
    await prisma.diaryEntry.create({
      data: {
        userId,
        bookId: book.id,
        type: entry.type,
        content: entry.content,
        page: entry.page ?? null,
        ragEnabled: true,
      },
    });
    diaryCreated++;
  }
  console.log(`[seed] diary entries: ${diaryCreated} novas`);

  // Reading logs — alimentam "atividade recente" do oráculo
  let logsCreated = 0;
  const today = new Date();
  for (let i = 1; i <= 10; i++) {
    if (i % 4 === 0) continue; // alguns dias sem leitura, mais realista
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    const pages = 15 + ((i * 13) % 40);
    const res = await prisma.readingLog.upsert({
      where: { userId_date: { userId, date } },
      update: {},
      create: { userId, date, pages },
    });
    if (res.createdAt.getTime() > date.getTime()) logsCreated++;
  }
  console.log(`[seed] reading logs: ${logsCreated} novos`);

  const stats = await prisma.$queryRaw<{ total: bigint; indexed: bigint }[]>`
    SELECT COUNT(*) AS total, COUNT(embedding) AS indexed
    FROM "Book" WHERE "userId" = ${userId}
  `;
  console.log(
    `[seed] acervo final: ${stats[0].indexed}/${stats[0].total} livros indexados`
  );
}

main()
  .catch((err) => {
    console.error("[seed] falhou:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

export {};
