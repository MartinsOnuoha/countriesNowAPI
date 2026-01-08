export default {
  schema: './src/db/schema.ts',
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
    maxConnections: 1,
  },
};
