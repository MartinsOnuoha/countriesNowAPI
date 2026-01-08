import { Elysia } from 'elysia';
import { getAllCountries } from '../../services/countryService';
import { ENDPOINTS } from '../../config/api';

export const countriesRoutes = new Elysia({ prefix: ENDPOINTS.COUNTRIES })
  .get('/', async () => {
    return await getAllCountries();
  });
