function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  mongoUri: process.env.MONGO_URI ?? "mongodb://localhost:27017/uptime",
  jwtSecret: requireEnv("JWT_SECRET"),
  authRateLimitMax: Number(process.env.AUTH_RATE_LIMIT_MAX ?? 20),
  // number of reverse proxies in front of the API (0 = none)
  trustProxy: Number(process.env.TRUST_PROXY ?? 0),
};
