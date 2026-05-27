-- Bootstrap script run by the postgres container on first boot.
-- Creates the mastra database for HITL .suspend/.resume checkpoint storage.
-- Langfuse uses the default `postgres` database.

CREATE DATABASE mastra;
