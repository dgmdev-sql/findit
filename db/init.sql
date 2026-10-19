CREATE TABLE IF NOT EXISTS items (
    id SERIAL PRIMARY KEY,
    title VARCHAR(120) NOT NULL,
    category VARCHAR(60) NOT NULL,
    item_type VARCHAR(20) NOT NULL CHECK (item_type IN ('lost', 'found')),
    location VARCHAR(120) NOT NULL,
    date_reported DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT NOT NULL,
    reporter_name VARCHAR(100) NOT NULL,
    reporter_contact VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'claimed', 'returned')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS claims (
    id SERIAL PRIMARY KEY,
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    claimant_name VARCHAR(100) NOT NULL,
    student_id VARCHAR(40) NOT NULL,
    proof_description TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_items_item_type ON items(item_type);
CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
CREATE INDEX IF NOT EXISTS idx_claims_item_id ON claims(item_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status);

INSERT INTO items (title, category, item_type, location, date_reported, description, reporter_name, reporter_contact, status)
SELECT seed.title, seed.category, seed.item_type, seed.location, seed.date_reported::date, seed.description, seed.reporter_name, seed.reporter_contact, seed.status
FROM (VALUES
    ('Black HydroFlask 32oz', 'Bottles / Bags', 'found', 'Main Library, 3rd Floor', '2026-10-19', 'Matte black insulated flask with a protective rubber boot and an NU Bulldogs sticker near the base.', 'Kennedy', 'kennedy@students.edu.ph', 'open'),
    ('Casio fx-991EX Calculator', 'Electronics', 'lost', 'Engineering Lab 402', '2026-10-18', 'Black solar scientific calculator. Slide-on hard cover has student initials ''RS'' etched on the inside.', 'Rey', 'rey@students.edu.ph', 'open'),
    ('Student ID & Lanyard', 'ID / Cards', 'lost', 'Canteen Annex Table 6', '2026-10-18', 'Clear rigid card holder on a campus lanyard with a silver locker key ring attached.', 'Josh', 'josh@students.edu.ph', 'open'),
    ('Anker 65W USB-C Charger', 'Electronics', 'found', 'Computer Lab 3', '2026-10-17', 'Compact black GaN charger block with a braided USB-C cable secured by a gray hook-and-loop tie.', 'Kim', 'kim@students.edu.ph', 'returned')
) AS seed(title, category, item_type, location, date_reported, description, reporter_name, reporter_contact, status)
WHERE NOT EXISTS (SELECT 1 FROM items);

INSERT INTO claims (item_id, claimant_name, student_id, proof_description, status)
SELECT 1, 'Dom', '2024-100482', 'Has a small scratch on the lid handle and a Bulldogs sticker on the bottom right side.', 'pending'
WHERE EXISTS (SELECT 1 FROM items WHERE id = 1)
  AND NOT EXISTS (SELECT 1 FROM claims);
