const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ── Color profiles ─────────────────────────────────────────────────────────
  const palettes = [
    { name: 'Predeterminado', bgColor: '#F5F3EF', textColor: '#12100E', accentColor: '#1A5FD4', isDefault: true },
    { name: 'Negro sobre blanco', bgColor: '#000000', textColor: '#ffffff', accentColor: '#4D9FFF', isDefault: false },
    { name: 'Blanco sobre negro', bgColor: '#ffffff', textColor: '#000000', accentColor: '#0044BB', isDefault: false },
    { name: 'Deuteranopía', bgColor: '#ffffff', textColor: '#000000', accentColor: '#0077BB', isDefault: false },
    { name: 'Tritanopía', bgColor: '#ffffff', textColor: '#000000', accentColor: '#CC3300', isDefault: false },
    { name: 'Fondo amarillo', bgColor: '#FFFF99', textColor: '#000000', accentColor: '#003399', isDefault: false },
  ];
  for (const p of palettes) {
    await prisma.colorProfile.upsert({ where: { name: p.name }, create: p, update: p });
  }
  console.log('  ✅ Color profiles');

  // ── Admin user ────────────────────────────────────────────────────────────
  const adminHash = await bcrypt.hash('Admin1234!', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@proyectogigi.com' },
    create: { name: 'Administrador', email: 'admin@proyectogigi.com', passwordHash: adminHash, role: 'admin' },
    update: {},
  });
  console.log('  ✅ Admin:', admin.email);

  // ── Specialist user ───────────────────────────────────────────────────────
  const specHash = await bcrypt.hash('Spec1234!', 12);
  const specUser = await prisma.user.upsert({
    where: { email: 'especialista@proyectogigi.com' },
    create: {
      name: 'María García', email: 'especialista@proyectogigi.com',
      passwordHash: specHash, role: 'specialist',
      specialistProfile: { create: { bio: 'Especialista en atención temprana y baja visión.' } },
    },
    update: {},
    include: { specialistProfile: true },
  });
  const specialist = specUser.specialistProfile;
  console.log('  ✅ Specialist:', specUser.email);

  // ── Client user ───────────────────────────────────────────────────────────
  const cliHash = await bcrypt.hash('Client1234!', 12);
  const defaultPalette = await prisma.colorProfile.findFirst({ where: { isDefault: true } });
  const cliUser = await prisma.user.upsert({
    where: { email: 'familia@ejemplo.com' },
    create: {
      name: 'Familia Martínez', email: 'familia@ejemplo.com',
      passwordHash: cliHash, role: 'client',
      preferences: { create: { colorProfileId: defaultPalette?.id, ttsEnabled: true, textSize: 1 } },
      clientProfile: { create: { childName: 'Lucía', specialistId: specialist.id } },
    },
    update: {},
    include: { clientProfile: true },
  });
  console.log('  ✅ Client:', cliUser.email);

  // ── Categories ────────────────────────────────────────────────────────────
  const catNames = ['Animales', 'Frutas', 'Hogar', 'Transporte'];
  const cats = {};
  for (const name of catNames) {
    let cat = await prisma.category.findFirst({
      where: { name, ownerId: null },
    });
    if (!cat) {
      cat = await prisma.category.create({
        data: { name, ownerId: null, status: 'approved' },
      });
    }
    cats[name] = cat;
  }
  console.log('  ✅ Categories');

  // ── Objects ───────────────────────────────────────────────────────────────
  const objectData = [
    {
      name: 'Perro', em: '🐕', cat: 'Animales',
      model3d: 'https://sketchfab.com/models/e395f26615ca445ab32f01ded17ff3bf/embed',
    },
    { name: 'Gato',      em: '🐈', cat: 'Animales' },
    { name: 'Pájaro',    em: '🐦', cat: 'Animales' },
    { name: 'Conejo',    em: '🐇', cat: 'Animales' },
    { name: 'Manzana',   em: '🍎', cat: 'Frutas'   },
    { name: 'Plátano',   em: '🍌', cat: 'Frutas'   },
    { name: 'Naranja',   em: '🍊', cat: 'Frutas'   },
    { name: 'Zanahoria', em: '🥕', cat: 'Frutas'   },
    { name: 'Taza',      em: '☕', cat: 'Hogar'    },
    { name: 'Silla',     em: '🪑', cat: 'Hogar'    },
    { name: 'Coche',     em: '🚗', cat: 'Transporte' },
    { name: 'Bicicleta', em: '🚲', cat: 'Transporte' },
  ];

  const objects = {};
  for (const o of objectData) {
    let obj = await prisma.object.findFirst({
      where: { name: o.name, categoryId: cats[o.cat].id, ownerId: null },
    });
    if (!obj) {
      obj = await prisma.object.create({
        data: { name: o.name, em: o.em, categoryId: cats[o.cat].id, ownerId: null, status: 'approved' },
      });
    }
    objects[o.name] = obj;
    if (o.model3d) {
      await prisma.objectRepresentation.upsert({
        where: { objectId_level: { objectId: obj.id, level: 'model_3d' } },
        create: { objectId: obj.id, level: 'model_3d', mediaType: 'model_3d_url', model3dUrl: o.model3d },
        update: {},
      });
    }
  }
  console.log('  ✅ Objects');

  // ── Sample activity ───────────────────────────────────────────────────────
  const activity = await prisma.activity.create({
    data: {
      title: 'Animales del campo',
      instructions: 'Trabajamos el perro, el gato y el pájaro.',
      specialistId: specialist.id,
      activityObjects: {
        create: [
          { objectId: objects['Perro'].id,  sortOrder: 0 },
          { objectId: objects['Gato'].id,   sortOrder: 1 },
          { objectId: objects['Pájaro'].id, sortOrder: 2 },
        ],
      },
    },
  });

  await prisma.assignment.upsert({
    where: { activityId_clientId: { activityId: activity.id, clientId: cliUser.clientProfile.id } },
    create: { activityId: activity.id, clientId: cliUser.clientProfile.id, isActive: true },
    update: {},
  });
  console.log('  ✅ Sample activity + assignment');

  // ── Sample group ──────────────────────────────────────────────────────────
  await prisma.group.upsert({
    where: { id: 'seed-group-1' },
    create: {
      id: 'seed-group-1',
      name: 'Grupo A – Mañanas',
      color: '#1A5FD4',
      specId: specialist.id,
      clients: { connect: [{ id: cliUser.clientProfile.id }] },
    },
    update: {},
  });
  console.log('  ✅ Sample group');

  console.log('\n✨ Seed completado!');
  console.log('   Admin:       admin@proyectogigi.com    / Admin1234!');
  console.log('   Especialista: especialista@proyectogigi.com / Spec1234!');
  console.log('   Cliente:      familia@ejemplo.com       / Client1234!');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
