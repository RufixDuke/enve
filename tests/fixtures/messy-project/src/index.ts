const port = process.env.PORT || 3000;
const dbUrl = process.env.DATABASE_URL;
const nodeEnv = process.env.NODE_ENV ?? 'development';

function init() {
  if (process.env.NEW_API_KEY) {
    console.log('API key present');
  }
}

init();
