#!/usr/bin/env node

/**
 * OAuth Configuration Verification Script
 * 
 * Checks that OAuth providers (Google, GitHub) are properly configured
 * for both local development and production environments.
 * 
 * Usage:
 *   node scripts/verify-oauth-config.js
 *   npm run verify:oauth
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkmark() {
  return `${colors.green}✓${colors.reset}`;
}

function crossmark() {
  return `${colors.red}✗${colors.reset}`;
}

function warning() {
  return `${colors.yellow}⚠${colors.reset}`;
}

// Check if file exists
function fileExists(filePath) {
  return fs.existsSync(filePath);
}

// Read file content
function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    return null;
  }
}

// Check environment variable
function checkEnvVar(varName) {
  return process.env[varName] !== undefined && process.env[varName] !== '';
}

// Main verification function
async function verifyOAuthConfig() {
  log('\n🔍 OAuth Configuration Verification\n', 'cyan');
  
  let errors = 0;
  let warnings = 0;
  
  // 1. Check supabase/config.toml exists
  log('1. Checking Supabase configuration...', 'blue');
  const configPath = path.join(rootDir, 'supabase', 'config.toml');
  if (!fileExists(configPath)) {
    log(`  ${crossmark()} supabase/config.toml not found`, 'red');
    errors++;
  } else {
    log(`  ${checkmark()} supabase/config.toml exists`);
    
    const configContent = readFile(configPath);
    
    // Check Google OAuth config
    if (configContent.includes('[auth.external.google]')) {
      log(`  ${checkmark()} Google OAuth section found`);
      
      if (configContent.match(/\[auth\.external\.google\][^[]*enabled\s*=\s*true/s)) {
        log(`  ${checkmark()} Google OAuth enabled`);
      } else {
        log(`  ${warning()} Google OAuth exists but not enabled`, 'yellow');
        warnings++;
      }
    } else {
      log(`  ${crossmark()} Google OAuth section missing`, 'red');
      errors++;
    }
    
    // Check GitHub OAuth config
    if (configContent.includes('[auth.external.github]')) {
      log(`  ${checkmark()} GitHub OAuth section found`);
      
      if (configContent.match(/\[auth\.external\.github\][^[]*enabled\s*=\s*true/s)) {
        log(`  ${checkmark()} GitHub OAuth enabled`);
      } else {
        log(`  ${warning()} GitHub OAuth exists but not enabled`, 'yellow');
        warnings++;
      }
    } else {
      log(`  ${crossmark()} GitHub OAuth section missing`, 'red');
      errors++;
    }
  }
  
  // 2. Check environment variables
  log('\n2. Checking environment variables...', 'blue');
  
  // Check for .env files
  const envFiles = ['.env', '.env.local', '.env.development'];
  let foundEnvFile = false;
  
  for (const envFile of envFiles) {
    const envPath = path.join(rootDir, envFile);
    if (fileExists(envPath)) {
      log(`  ${checkmark()} ${envFile} exists`);
      foundEnvFile = true;
    }
  }
  
  if (!foundEnvFile) {
    log(`  ${warning()} No .env files found (optional for production)`, 'yellow');
    warnings++;
  }
  
  // Check Google credentials
  const googleClientId = checkEnvVar('SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID');
  const googleSecret = checkEnvVar('SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET');
  
  if (googleClientId) {
    log(`  ${checkmark()} SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID set`);
  } else {
    log(`  ${warning()} SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID not set`, 'yellow');
    log(`    → Google OAuth will not work without this`, 'yellow');
    warnings++;
  }
  
  if (googleSecret) {
    log(`  ${checkmark()} SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET set`);
  } else {
    log(`  ${warning()} SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET not set`, 'yellow');
    log(`    → Google OAuth will not work without this`, 'yellow');
    warnings++;
  }
  
  // Check GitHub credentials
  const githubClientId = checkEnvVar('SUPABASE_AUTH_EXTERNAL_GITHUB_CLIENT_ID');
  const githubSecret = checkEnvVar('SUPABASE_AUTH_EXTERNAL_GITHUB_SECRET');
  
  if (githubClientId) {
    log(`  ${checkmark()} SUPABASE_AUTH_EXTERNAL_GITHUB_CLIENT_ID set`);
  } else {
    log(`  ${warning()} SUPABASE_AUTH_EXTERNAL_GITHUB_CLIENT_ID not set`, 'yellow');
    log(`    → GitHub OAuth will not work without this`, 'yellow');
    warnings++;
  }
  
  if (githubSecret) {
    log(`  ${checkmark()} SUPABASE_AUTH_EXTERNAL_GITHUB_SECRET set`);
  } else {
    log(`  ${warning()} SUPABASE_AUTH_EXTERNAL_GITHUB_SECRET not set`, 'yellow');
    log(`    → GitHub OAuth will not work without this`, 'yellow');
    warnings++;
  }
  
  // 3. Check documentation exists
  log('\n3. Checking documentation...', 'blue');
  
  const oauthSetupDoc = path.join(rootDir, 'docs', 'development', 'oauth-setup.md');
  if (fileExists(oauthSetupDoc)) {
    log(`  ${checkmark()} OAuth setup documentation exists`);
  } else {
    log(`  ${crossmark()} oauth-setup.md not found`, 'red');
    errors++;
  }
  
  const oauthTestDoc = path.join(rootDir, 'docs', 'development', 'oauth-testing.md');
  if (fileExists(oauthTestDoc)) {
    log(`  ${checkmark()} OAuth testing documentation exists`);
  } else {
    log(`  ${warning()} oauth-testing.md not found`, 'yellow');
    warnings++;
  }
  
  // 4. Summary
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'cyan');
  
  if (errors === 0 && warnings === 0) {
    log('✅ All checks passed! OAuth configuration looks good.\n', 'green');
    log('Next steps:', 'cyan');
    log('  1. Set up OAuth credentials (see docs/development/oauth-setup.md)');
    log('  2. Restart Supabase: supabase stop && supabase start');
    log('  3. Test OAuth flows (see docs/development/oauth-testing.md)\n');
    return 0;
  } else if (errors === 0) {
    log(`⚠️  Configuration complete with ${warnings} warning(s).\n`, 'yellow');
    log('OAuth providers are configured but credentials may be missing.', 'yellow');
    log('See docs/development/oauth-setup.md for credential setup.\n', 'yellow');
    return 0;
  } else {
    log(`❌ Found ${errors} error(s) and ${warnings} warning(s).\n`, 'red');
    log('Fix the errors above before using OAuth.\n', 'red');
    log('See docs/development/oauth-setup.md for configuration guide.\n', 'red');
    return 1;
  }
}

// Run verification
verifyOAuthConfig()
  .then(exitCode => process.exit(exitCode))
  .catch(error => {
    log(`\n❌ Verification failed with error:\n${error.message}\n`, 'red');
    process.exit(1);
  });
