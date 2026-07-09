const port = process.env.PORT || 3000;
const dbUrl = process.env.DATABASE_URL;
const apiUrl = process.env.API_BASE_URL;
const jwtSecret = process.env.JWT_SECRET;
const stripeKey = process.env.STRIPE_SECRET_KEY;

console.log({ port, dbUrl, apiUrl, jwtSecret, stripeKey });
