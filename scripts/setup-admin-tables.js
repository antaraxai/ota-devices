#!/usr/bin/env node

/**
 * This script helps set up the admin tables in Supabase
 * It provides instructions for running the migrations manually
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { execSync } from 'child_process';
import chalk from 'chalk';

// Get the current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Check if chalk is installed, if not, install it
try {
  // Just try to use chalk to see if it's available
  chalk.green('Testing chalk');
} catch (e) {
  console.log('Installing required dependencies...');
  execSync('npm install chalk', { stdio: 'inherit' });
  console.log('Dependencies installed.');
}

const adminLogsMigrationPath = path.join(__dirname, '../supabase/migrations/20250304_create_admin_logs_table.sql');
const systemSettingsMigrationPath = path.join(__dirname, '../supabase/migrations/20250304_create_system_settings_table.sql');

console.log(chalk.blue.bold('\n=== Antara Admin Tables Setup ===\n'));

// Check if the migration files exist
let missingFiles = false;

if (!fs.existsSync(adminLogsMigrationPath)) {
  console.log(chalk.red('Error: Admin logs migration file not found at:'));
  console.log(chalk.red(adminLogsMigrationPath));
  missingFiles = true;
}

if (!fs.existsSync(systemSettingsMigrationPath)) {
  console.log(chalk.red('Error: System settings migration file not found at:'));
  console.log(chalk.red(systemSettingsMigrationPath));
  missingFiles = true;
}

if (missingFiles) {
  process.exit(1);
}

// Read the migration files
const adminLogsMigrationContent = fs.readFileSync(adminLogsMigrationPath, 'utf8');
const systemSettingsMigrationContent = fs.readFileSync(systemSettingsMigrationPath, 'utf8');

console.log(chalk.green('✓ Found migration files for admin tables\n'));

console.log(chalk.yellow('To set up the admin tables, you have two options:\n'));

console.log(chalk.white.bold('Option 1: Using Supabase CLI (Recommended)'));
console.log('Run the following command from the project root:');
console.log(chalk.cyan('  npx supabase migration up\n'));

console.log(chalk.white.bold('Option 2: Manual SQL Execution'));
console.log('1. Log in to your Supabase dashboard');
console.log('2. Navigate to the SQL Editor');
console.log('3. Copy and execute the following SQL scripts one by one:');

console.log(chalk.cyan('\n------- ADMIN LOGS TABLE SQL -------'));
console.log(chalk.cyan(adminLogsMigrationContent));
console.log(chalk.cyan('------- END ADMIN LOGS TABLE SQL -------\n'));

console.log(chalk.cyan('\n------- SYSTEM SETTINGS TABLE SQL -------'));
console.log(chalk.cyan(systemSettingsMigrationContent));
console.log(chalk.cyan('------- END SYSTEM SETTINGS TABLE SQL -------\n'));

console.log(chalk.blue.bold('After Setup:'));
console.log('• Restart your application');
console.log('• Navigate to the Admin Settings and Admin Logs pages');
console.log('• The system will now be able to store settings and record admin actions\n');

console.log(chalk.green('For more information, see the migration README at:'));
console.log(chalk.green('supabase/migrations/README.md\n'));
