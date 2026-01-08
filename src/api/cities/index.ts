import { Elysia } from 'elysia';
import { db } from '../../db/client';
import { cities } from '../../db/schema';

export const citiesRoutes = new Elysia({ prefix: '/cities' })
	.get('/', async () => {
		return await db.select().from(cities);
	});
