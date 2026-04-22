-- KMS Database initialization script
-- Runs once on first PostgreSQL container start

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For text search

-- Enum types
DO $$ BEGIN
  CREATE TYPE user_status AS ENUM ('pending', 'waiting', 'active', 'disabled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE file_type AS ENUM ('txt', 'md', 'pdf');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE doc_status AS ENUM ('uploaded', 'processing', 'ready', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
