# Antara Database Migrations

This directory contains SQL migration scripts for the Antara application's Supabase database.

## Available Migrations

- `20250304_create_admin_logs_table.sql`: Creates the admin_logs table for tracking administrative actions

## Running Migrations

### Option 1: Using Supabase CLI

If you have the Supabase CLI installed, you can run:

```bash
# From the project root
npx supabase migration up
```

### Option 2: Manual Execution

You can also manually execute the SQL scripts in the Supabase dashboard:

1. Log in to your Supabase project
2. Go to the SQL Editor
3. Copy the contents of the migration file
4. Paste into the SQL Editor and run

## Migration Structure

Each migration file follows the naming convention:

```
YYYYMMDD_description_of_migration.sql
```

This helps track when migrations were created and what they do.

## Creating New Migrations

When creating new migrations:

1. Follow the naming convention
2. Include appropriate comments in the SQL file
3. Test the migration in a development environment before applying to production
4. Add appropriate row-level security (RLS) policies
5. Update this README with details about the new migration
