import { db } from '../db/client';
import { countries } from '../db/schema';

export async function getAllCountries() {
  return await db.select().from(countries);
}
