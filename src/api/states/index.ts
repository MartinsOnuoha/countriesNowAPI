import { Elysia } from 'elysia';
import { db } from '../../db/client';
import { states } from '../../db/schema';

export const statesRoutes = new Elysia({ prefix: '/states' })
	.get('/', async () => {
		return await db.select().from(states);
	});
