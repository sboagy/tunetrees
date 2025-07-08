import { config } from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: join(__dirname, '.env.local') });

console.log('=== Environment Variables ===');
console.log('TT_API_BASE_URL:', process.env.TT_API_BASE_URL);
console.log('NEXT_BASE_URL:', process.env.NEXT_BASE_URL);
console.log('NEXT_PUBLIC_MOCK_EXTERNAL_APIS:', process.env.NEXT_PUBLIC_MOCK_EXTERNAL_APIS);
console.log('================================');

// Test the TT_API_BASE_URL construction
const baseURL = process.env.TT_API_BASE_URL;
if (baseURL) {
  console.log('Settings URL:', `${baseURL}/settings`);
  console.log('Tunetrees URL:', `${baseURL}/tunetrees`);
  console.log('Tune URL:', `${baseURL}/tunetrees/tune/123`);
} else {
  console.error('TT_API_BASE_URL is not set!');
}
