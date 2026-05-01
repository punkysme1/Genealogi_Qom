-- Family Tree Qomaruddin Database Schema

-- 1. Individuals Table
CREATE TABLE individuals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    gender CHAR(1) CHECK (gender IN ('M', 'F')),
    birth_date DATE,
    death_date DATE,
    birth_place TEXT,
    current_location TEXT,
    education TEXT,
    occupation TEXT,
    bio TEXT,
    is_alive BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    verified_by TEXT, -- Nama verifikator
    father_id UUID REFERENCES individuals(id),
    mother_id UUID REFERENCES individuals(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Marriages Table (Handles Pedigree Collapse & Multiple Spouses)
CREATE TABLE marriages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    husband_id UUID REFERENCES individuals(id) NOT NULL,
    wife_id UUID REFERENCES individuals(id) NOT NULL,
    marriage_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Sources Table
CREATE TABLE sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    individual_id UUID REFERENCES individuals(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    url TEXT,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Events Table (Timeline)
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    individual_id UUID REFERENCES individuals(id) ON DELETE CASCADE,
    type TEXT CHECK (type IN ('birth', 'death', 'marriage', 'education', 'other')),
    date DATE,
    description TEXT NOT NULL,
    location TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Recursive Function for Descendants (CTE Example)
CREATE OR REPLACE FUNCTION get_descendants(root_id UUID, max_depth INT DEFAULT 9)
RETURNS TABLE (
    id UUID,
    name TEXT,
    father_id UUID,
    mother_id UUID,
    generation INT
) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE family_tree AS (
        SELECT i.id, i.name, i.father_id, i.mother_id, 0 as generation
        FROM individuals i
        WHERE i.id = root_id

        UNION ALL

        SELECT i.id, i.name, i.father_id, i.mother_id, ft.generation + 1
        FROM individuals i
        JOIN family_tree ft ON (i.father_id = ft.id OR i.mother_id = ft.id)
        WHERE ft.generation < max_depth
    )
    SELECT * FROM family_tree;
END;
$$ LANGUAGE plpgsql;

-- 6. Indexes for Performance
CREATE INDEX idx_individuals_father ON individuals(father_id);
CREATE INDEX idx_individuals_mother ON individuals(mother_id);
CREATE INDEX idx_marriages_husband ON marriages(husband_id);
CREATE INDEX idx_marriages_wife ON marriages(wife_id);
