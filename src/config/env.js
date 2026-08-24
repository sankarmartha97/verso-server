// Boot-time env validation. Fail fast with a clear message instead of a mystery
// crash three requests later.
const { z } = require('zod');

const schema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.string().default('3001'),
  CORS_ORIGIN: z.string().default('*'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 chars'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 chars'),
  SMTP_URL: z.string().min(1, 'SMTP_URL is required'),
  MAIL_FROM: z.string().default('Verso <no-reply@verso.local>'),
});

const result = schema.safeParse(process.env);

if (!result.success) {
  console.error('Invalid environment configuration:');
  for (const issue of result.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

module.exports = result.data;
