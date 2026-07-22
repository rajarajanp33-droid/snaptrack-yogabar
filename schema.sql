-- ============================================================
-- SnapTrack — D1 database schema
-- Paste this into: Cloudflare dashboard → your D1 database → Console
-- (or run via: wrangler d1 execute snaptrack-db --file=schema.sql)
-- ============================================================

CREATE TABLE IF NOT EXISTS vehicles (
  id TEXT PRIMARY KEY,
  number TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS delay_reasons (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,                 -- admin | manager | operator | driver
  location_id TEXT,                   -- only set when role = operator
  active INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (location_id) REFERENCES locations(id)
);

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),  -- single-row config table
  expected_loading INTEGER NOT NULL DEFAULT 30,
  expected_unloading INTEGER NOT NULL DEFAULT 25,
  expected_travel INTEGER NOT NULL DEFAULT 60,
  workday_hours INTEGER NOT NULL DEFAULT 10
);
INSERT OR IGNORE INTO settings (id) VALUES (1);

CREATE TABLE IF NOT EXISTS trips (
  id TEXT PRIMARY KEY,
  vehicle_id TEXT NOT NULL,
  vehicle_number TEXT NOT NULL,
  driver_name TEXT,
  created_by TEXT,
  source_id TEXT NOT NULL,
  dest_id TEXT NOT NULL,
  source_name TEXT NOT NULL,
  dest_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress',   -- in_progress | completed
  created_at INTEGER NOT NULL,
  completed_at INTEGER,
  reached_source INTEGER,
  loading_start INTEGER,
  loading_end INTEGER,
  production_entry_start INTEGER,
  production_entry_end INTEGER,
  departed INTEGER,
  reached_destination INTEGER,
  unloading_start INTEGER,
  unloading_end INTEGER
);
CREATE INDEX IF NOT EXISTS idx_trips_vehicle ON trips(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);
CREATE INDEX IF NOT EXISTS idx_trips_created ON trips(created_at);

CREATE TABLE IF NOT EXISTS trip_delays (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL,
  segment TEXT NOT NULL,              -- loading | travel | unloading
  reason_id TEXT,
  reason_label TEXT,
  remarks TEXT,
  captured_at INTEGER,
  FOREIGN KEY (trip_id) REFERENCES trips(id)
);
CREATE INDEX IF NOT EXISTS idx_delays_trip ON trip_delays(trip_id);

-- Seed data — same defaults the Claude-hosted version shipped with.
-- Delete or edit these rows freely once you're on the new backend.
INSERT OR IGNORE INTO vehicles (id, number, active) VALUES
  ('v1','KA51C7149',1), ('v2','MH43U6997',1), ('v3','KA529430',1),
  ('v4','KA52A8993',1), ('v5','KA526702',1);

INSERT OR IGNORE INTO locations (id, name, active) VALUES
  ('l1','YB Factory',1), ('l2','YB FG Warehouse',1), ('l3','RM Warehouse',1),
  ('l4','Tumkur Wh',1), ('l5','Tumkur New Wh',1);

INSERT OR IGNORE INTO delay_reasons (id, label, active) VALUES
  ('dr1','Invoicing Delay',1), ('dr2','Unloading Delay',1),
  ('dr3','Production Entry Delay',1), ('dr4','Manpower Issue',1),
  ('dr5','Storage Pallet Issue',1);
