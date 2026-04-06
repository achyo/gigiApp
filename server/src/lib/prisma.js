// src/lib/prisma.js
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

function createPrismaClient() {
	if (!process.env.DATABASE_URL) {
		throw new Error('DATABASE_URL is required');
	}

	const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
	return new PrismaClient({ adapter });
}

const prisma = global.__prisma || createPrismaClient();
if (process.env.NODE_ENV !== 'production') global.__prisma = prisma;

module.exports = { prisma, createPrismaClient };
