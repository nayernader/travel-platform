import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model } from 'mongoose';
import { AppModule } from '../app.module';
import { PASSWORD_MESSAGE, PASSWORD_REGEX } from '../common/constants/password';
import { Role } from '../common/enums/role.enum';
import { Airport } from '../reference-data/schemas/airport.schema';
import { Attraction } from '../reference-data/schemas/attraction.schema';
import { City } from '../reference-data/schemas/city.schema';
import { Country } from '../reference-data/schemas/country.schema';
import { UsersService } from '../users/users.service';
import { AIRPORTS, ATTRACTIONS, CITIES, COUNTRIES } from './data/reference-data';

// Upsert = insert if missing, update if it exists, so the script is safe to run many times
async function upsertAll(model: Model<any>, docs: { _id: string }[]) {
  await model.bulkWrite(
    docs.map(({ _id, ...rest }) => ({
      updateOne: { filter: { _id }, update: { $set: rest }, upsert: true },
    })),
  );
}

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });

  const sets: [string, Model<any>, { _id: string }[]][] = [
    [Country.name, app.get(getModelToken(Country.name), { strict: false }), COUNTRIES],
    [City.name, app.get(getModelToken(City.name), { strict: false }), CITIES],
    [Airport.name, app.get(getModelToken(Airport.name), { strict: false }), AIRPORTS],
    [Attraction.name, app.get(getModelToken(Attraction.name), { strict: false }), ATTRACTIONS],
  ];
  for (const [name, model, docs] of sets) {
    await upsertAll(model, docs);
    console.log(`Seeded ${docs.length} ${name} records`);
  }

  // ACC-18: the admin is created here, never through registration
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD in backend/.env before seeding');
  }
  if (!PASSWORD_REGEX.test(password)) {
    throw new Error(`ADMIN_PASSWORD is too weak. ${PASSWORD_MESSAGE}`);
  }

  const users = app.get(UsersService, { strict: false });
  const existing = await users.findByEmail(email);
  if (existing) {
    console.log(`Admin ${email} already exists, left unchanged`);
  } else {
    await users.create({
      name: 'Platform Admin',
      email,
      passwordHash: await bcrypt.hash(password, 10),
      role: Role.ADMIN,
      consentAcceptedAt: new Date(),
    });
    console.log(`Created admin account ${email}`);
  }

  await app.close();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});