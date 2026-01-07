import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const members = await prisma.familyMember.findMany({
    include: {
      reactions: {
        include: {
          media: {
            select: { id: true, title: true, type: true, genres: true }
          }
        }
      },
      _count: { select: { reactions: true } }
    }
  });
  
  for (const m of members) {
    console.log('\n=== ' + m.name + ' (' + m.avatarEmoji + ') ===');
    console.log('Total reactions:', m._count.reactions);
    for (const r of m.reactions) {
      console.log('  -', r.reaction, ':', r.media.title, '(' + r.media.type + ')', 'genres:', r.media.genres.join(', '));
    }
  }
  
  await prisma.$disconnect();
}
check();
