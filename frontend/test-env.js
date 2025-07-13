// Test environment variable loading
require('dotenv').config({ path: '.env.local' });

console.log('Environment variables:');
console.log('TT_API_BASE_URL:', process.env.TT_API_BASE_URL);

const TT_API_BASE_URL = process.env.TT_API_BASE_URL;
console.log('Using TT_API_BASE_URL:', TT_API_BASE_URL);

if (!TT_API_BASE_URL) {
  console.error('TT_API_BASE_URL environment variable is not set!');
} else {
  const baseURL = `${TT_API_BASE_URL}/settings`;
  console.log('Constructed baseURL:', baseURL);
}
