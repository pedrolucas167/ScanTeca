require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.book.findFirst({ select: { id: true, title: true } }).then(b => {
  console.log('LIVRO:', b);
  p.$disconnect();
}).catch(e => console.error(e));
