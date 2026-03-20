-- pgschema declarative schema
-- Add table definitions here. pgschema will generate DDL to match this state.

-- App user DML privileges (managed by pgschema to stay in sync)
ALTER DEFAULT PRIVILEGES FOR ROLE stream_tag_inventory IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO stream_tag_inventory_app;
ALTER DEFAULT PRIVILEGES FOR ROLE stream_tag_inventory IN SCHEMA public
  GRANT SELECT, USAGE ON SEQUENCES TO stream_tag_inventory_app;
