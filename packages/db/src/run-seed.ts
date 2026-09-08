import { seedDevelopmentData } from './seed.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to seed development data');
}
await seedDevelopmentData(databaseUrl);
