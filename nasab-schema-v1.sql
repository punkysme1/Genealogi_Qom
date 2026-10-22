-- ============================================================================
-- NASAB — SKEMA TERPADU & PETA APLIKASI, v1 / 20 Oktober 2026
-- ============================================================================
-- TUJUAN
-- Nasab menyimpan identitas tokoh, orang tua biologis, perkawinan, linimasa,
-- dan bukti. Nawra membaca data yang dipublikasikan untuk menjawab pertanyaan.
-- UUID adalah identitas tetap; kode generasi/alfanumerik adalah hasil perhitungan.
-- Pasangan seseorang TIDAK otomatis menjadi orang tua biologis anaknya.
--
-- PETA DATA
-- individuals --father_id/mother_id--> individuals   (garis biologis)
-- individuals <--husband_id/wife_id-- marriages     (riwayat perkawinan)
-- individuals <--individual_id-- events            (linimasa)
-- individuals <--individual_id-- sources           (katalog sumber)
-- individuals/marriages <-- nasab_evidence_links --> sources (bukti per fakta)
-- nasab_settings.root_person_id --> individuals    (root eksplisit)
-- semua perubahan domain --> nasab_change_log      (audit + outbox Nawra)
-- nasab_nawra_*_v1                                 (kontrak baca publik)
--
-- PRASYARAT / PENERAPAN
-- 1. PostgreSQL >=15 pada Supabase, role anon/authenticated/service_role,
--    auth.users dan auth.uid() tersedia. Jalankan sebagai postgres.
-- 2. Backup dan uji restore dahulu. Uji file ini pada salinan database.
-- 3. Ini migrasi cutover: UI publik dan adapter Nawra harus membaca view
--    nasab_nawra_*_v1, bukan tabel dasar. UI admin tetap membaca tabel dasar.
--    Query lama anonymous ke individuals/marriages akan ditolak setelah COMMIT.
-- 4. Semua record lama mendapat visibility='private'. Admin meninjau sebelum
--    mempublikasikan. File ini TIDAK menganggap data orang hidup layak publik.
-- 5. Hentikan penulisan selama penerapan. Satu transaksi, rollback bila gagal.
--    Tidak menghapus record lama. Tidak memindahkan atau mengisi parent otomatis.
-- 6. Mendukung instalasi baru dan skema lama repository Nasab yang diaudit.
--    Bukan migrator untuk semua bentuk skema kustom. CREATE IF NOT EXISTS tidak
--    memperbaiki tipe kolom/constraint lama yang telah dimodifikasi di luar repo.
-- 7. Dapat dijalankan ulang; policy pada tabel yang dikelola file ini diganti.
--    Review policy kustom sebelum menjalankan. Tidak mengubah auth.users.
--
-- BATAS
-- SQL ini tidak memperbaiki algoritme kekerabatan/cache UI, tidak menjalankan
-- worker Nawra, dan tidak membersihkan bukti lama di indeks Nawra otomatis.
-- Siklus lintas-record dan konflik kronologi perlu workflow validasi/transaksi
-- sebelum publikasi; CHECK di bawah hanya mencegah relasi diri sendiri.
-- Tanggal DATE lama tetap dipertahankan; tanggal parsial/Hijriah butuh kontrak
-- lanjutan. NULL berarti tidak diketahui, bukan tanggal/usia hasil tebakan.
-- ============================================================================

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DO $$
BEGIN
  IF current_setting('server_version_num')::integer < 150000 THEN
    RAISE EXCEPTION 'Nasab membutuhkan PostgreSQL 15 atau lebih baru';
  END IF;
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Jalankan sebagai postgres agar ownership view terkontrol';
  END IF;
END $$;

-- 1. IDENTITAS DAN HUBUNGAN DASAR ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.individuals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  gender char(1) CHECK (gender IN ('M','F')),
  birth_date date,
  death_date date,
  birth_place text,
  death_place text,
  current_location text,
  education text,
  occupation text,
  bio text,
  slug text UNIQUE,
  profile_photo_url text,
  economic_status text CHECK (economic_status IN ('Kaya','Menengah','Miskin')),
  is_alive boolean DEFAULT NULL,
  is_verified boolean DEFAULT false,
  verified_by text,
  verification_type text CHECK (verification_type IN ('Manuskrip','Dokumen','Verifikator')),
  verification_source text,
  father_id uuid REFERENCES public.individuals(id),
  mother_id uuid REFERENCES public.individuals(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.individuals ADD COLUMN IF NOT EXISTS death_place text;
ALTER TABLE public.individuals ALTER COLUMN is_alive SET DEFAULT NULL;
-- Nilai true lama tidak diubah: perlu peninjauan, bukan asumsi migrasi.

CREATE TABLE IF NOT EXISTS public.marriages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  husband_id uuid NOT NULL REFERENCES public.individuals(id),
  wife_id uuid NOT NULL REFERENCES public.individuals(id),
  marriage_date date,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
-- Tidak diberi UNIQUE(husband_id,wife_id): pasangan dapat menikah ulang.
-- is_active=false berarti perkawinan tidak aktif; alasan belum dimodelkan.

CREATE TABLE IF NOT EXISTS public.sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  individual_id uuid REFERENCES public.individuals(id) ON DELETE CASCADE,
  title text NOT NULL,
  url text,
  description text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.sources ADD COLUMN IF NOT EXISTS external_system text;
ALTER TABLE public.sources ADD COLUMN IF NOT EXISTS external_record_id text;
-- external_system: misalnya turots/paperless; ID eksternal bukan nama file.

CREATE TABLE IF NOT EXISTS public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  individual_id uuid REFERENCES public.individuals(id) ON DELETE CASCADE,
  type text CHECK (type IN ('birth','death','marriage','education','other')),
  date date,
  description text NOT NULL,
  location text,
  created_at timestamptz DEFAULT now()
);

-- 2. BUKTI PER FAKTA ---------------------------------------------------------
-- Contoh predicate='father_id', individual_id=anak, related_person_id=ayah.
-- Jika parent kemudian berubah, view bukti menahan bukti yang tidak lagi cocok.
-- Fakta profil: predicate='birth_date' dst., asserted_value menyimpan nilai
-- yang benar-benar diperiksa. Worker/UI harus membandingkan dengan revisi fakta.
CREATE TABLE IF NOT EXISTS public.nasab_evidence_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  individual_id uuid REFERENCES public.individuals(id),
  marriage_id uuid REFERENCES public.marriages(id),
  related_person_id uuid REFERENCES public.individuals(id),
  source_id uuid NOT NULL REFERENCES public.sources(id),
  predicate text NOT NULL CHECK (btrim(predicate) <> ''),
  asserted_value text,
  locator text,
  quotation text,
  review_status text NOT NULL DEFAULT 'draft'
    CHECK (review_status IN ('draft','reviewed','disputed')),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(individual_id, marriage_id) = 1),
  CHECK (predicate NOT IN ('father_id','mother_id') OR
    (individual_id IS NOT NULL AND related_person_id IS NOT NULL)),
  CHECK (review_status <> 'reviewed' OR reviewed_at IS NOT NULL)
);
-- verified_by/reviewed_by adalah identitas internal; tidak diterbitkan ke Nawra.
-- Jangan menganggap is_verified pada profil memverifikasi semua hubungan.

-- 3. REVISI DAN PUBLIKASI ----------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['individuals','marriages','sources','events','nasab_evidence_links'] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT ''private'' CHECK (visibility IN (''private'',''public''))', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0)', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS deleted_at timestamptz', t);
  END LOOP;
END $$;
-- Hapus melalui deleted_at. Hard delete hanya dilakukan oleh pemeliharaan
-- terotorisasi, setelah referensi dan kebutuhan retensi diperiksa.

-- NOT VALID menjaga data lama tetap utuh tetapi memeriksa tulis baru/perubahan.
-- VALIDATE CONSTRAINT setelah admin memperbaiki data lama yang tidak memenuhi.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.individuals'::regclass AND conname='nasab_parent_sanity') THEN
    ALTER TABLE public.individuals ADD CONSTRAINT nasab_parent_sanity CHECK (
      father_id IS DISTINCT FROM id AND mother_id IS DISTINCT FROM id
      AND (father_id IS NULL OR mother_id IS NULL OR father_id <> mother_id)
    ) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.marriages'::regclass AND conname='nasab_marriage_sanity') THEN
    ALTER TABLE public.marriages ADD CONSTRAINT nasab_marriage_sanity
      CHECK (husband_id <> wife_id) NOT VALID;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.nasab_settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  root_person_id uuid REFERENCES public.individuals(id),
  application_name text NOT NULL DEFAULT 'Nasab Qomaruddin'
);
INSERT INTO public.nasab_settings(singleton) VALUES(true) ON CONFLICT DO NOTHING;
-- Root tidak ditebak dari nama. Admin menetapkannya setelah verifikasi UUID.

CREATE TABLE IF NOT EXISTS public.nasab_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT 'Admin Nasab',
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Bootstrap admin melalui SQL terpercaya setelah akun dibuat di Supabase Auth:
-- INSERT INTO public.nasab_admins(user_id) VALUES ('UUID-AKUN-YANG-DIVERIFIKASI');
-- Tidak ada auto-admin berdasarkan email atau semua akun authenticated.

-- 4. AUDIT + OUTBOX ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.nasab_change_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entity_table text NOT NULL,
  entity_id uuid NOT NULL,
  operation text NOT NULL CHECK (operation IN ('INSERT','UPDATE','DELETE')),
  actor_id uuid,
  changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  before_data jsonb,
  after_data jsonb,
  processed_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  last_error text
);
-- Privat: before/after dapat memuat data yang ditarik dari publik.
-- Worker tepercaya mengambil baris processed_at IS NULL, mengerjakan idempoten,
-- lalu menandai processed_at hanya bila SEMUA indeks berhasil diperbarui.
-- Jangan memakai MAX(id) sebagai satu-satunya cursor: urutan sequence bukan
-- urutan commit transaksi. Gunakan antrean pending + retry; jangan skip gap.
-- Perubahan visibility/deleted_at memicu pencabutan bukti record DAN bukti
-- yang bergantung padanya (anak, perkawinan, sumber, jalur relasi).
-- Full reconcile wajib saat cutover: data lama belum memiliki log INSERT.

CREATE OR REPLACE FUNCTION public.nasab_touch_revision()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN NEW.revision := 1;
  ELSE NEW.revision := OLD.revision + 1;
  END IF;
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.nasab_log_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.nasab_change_log(entity_table, entity_id, operation, actor_id, before_data, after_data)
  VALUES (TG_TABLE_NAME, CASE WHEN TG_OP='DELETE' THEN OLD.id ELSE NEW.id END,
    TG_OP, auth.uid(),
    CASE WHEN TG_OP='INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP='DELETE' THEN NULL ELSE to_jsonb(NEW) END);
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.nasab_touch_revision() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.nasab_log_change() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['individuals','marriages','sources','events','nasab_evidence_links'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS nasab_touch ON public.%I',t);
    EXECUTE format('CREATE TRIGGER nasab_touch BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.nasab_touch_revision()',t);
    EXECUTE format('DROP TRIGGER IF EXISTS nasab_audit ON public.%I',t);
    EXECUTE format('CREATE TRIGGER nasab_audit AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.nasab_log_change()',t);
  END LOOP;
END $$;

-- 5. HAK AKSES ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.nasab_is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.nasab_admins WHERE user_id = (SELECT auth.uid()));
$$;
REVOKE ALL ON FUNCTION public.nasab_is_admin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nasab_is_admin() TO authenticated;

-- Mengganti SELURUH policy tabel terkelola supaya policy lama USING(true)
-- tidak membuka akses kembali melalui gabungan policy permisif PostgreSQL.
DO $$
DECLARE t text; p record; c record;
BEGIN
  FOREACH t IN ARRAY ARRAY['individuals','marriages','sources','events','nasab_evidence_links','nasab_settings','nasab_admins','nasab_change_log'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,t);
    END LOOP;
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated',t);
    -- Cabut grant tingkat kolom yang mungkin tersisa selain grant tabel.
    FOR c IN SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=t LOOP
      EXECUTE format('REVOKE ALL (%I) ON public.%I FROM PUBLIC, anon, authenticated',c.column_name,t);
    END LOOP;
    EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
    IF t='nasab_admins' THEN
      EXECUTE 'GRANT SELECT ON public.nasab_admins TO authenticated';
      EXECUTE 'CREATE POLICY nasab_membership ON public.nasab_admins FOR SELECT TO authenticated USING (user_id=(SELECT auth.uid()))';
    ELSIF t='nasab_change_log' THEN
      EXECUTE 'GRANT SELECT ON public.nasab_change_log TO authenticated';
      EXECUTE 'CREATE POLICY nasab_audit_read ON public.nasab_change_log FOR SELECT TO authenticated USING ((SELECT public.nasab_is_admin()))';
    ELSE
      EXECUTE format('GRANT SELECT, INSERT, UPDATE ON public.%I TO authenticated',t);
      EXECUTE format('CREATE POLICY nasab_admin_access ON public.%I FOR ALL TO authenticated USING ((SELECT public.nasab_is_admin())) WITH CHECK ((SELECT public.nasab_is_admin()))',t);
    END IF;
  END LOOP;
END $$;
GRANT USAGE, SELECT ON SEQUENCE public.nasab_change_log_id_seq TO service_role;
REVOKE ALL ON SEQUENCE public.nasab_change_log_id_seq FROM PUBLIC, anon, authenticated;

-- RPC lama tidak menjadi jalan pintas terhadap kontrak baru.
-- Fungsi tetap tersedia untuk admin, berjalan sebagai pemanggil (RLS berlaku).
CREATE OR REPLACE FUNCTION public.get_descendants(root_id uuid, max_depth integer DEFAULT 9)
RETURNS TABLE(id uuid, name text, father_id uuid, mother_id uuid, generation integer)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  WITH RECURSIVE family AS (
    SELECT i.id, i.name, i.father_id, i.mother_id, 0 AS generation, ARRAY[i.id] AS path
    FROM public.individuals i WHERE i.id=root_id AND i.deleted_at IS NULL
    UNION ALL
    SELECT i.id, i.name, i.father_id, i.mother_id, f.generation+1, f.path || i.id
    FROM public.individuals i JOIN family f ON i.father_id=f.id OR i.mother_id=f.id
    WHERE f.generation < greatest(0,least(coalesce(max_depth,9),12))
      AND NOT i.id=ANY(f.path) AND i.deleted_at IS NULL
  )
  SELECT f.id, f.name, f.father_id, f.mother_id, min(f.generation)::integer
  FROM family f GROUP BY f.id,f.name,f.father_id,f.mother_id;
$$;
REVOKE ALL ON FUNCTION public.get_descendants(uuid,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_descendants(uuid,integer) TO authenticated, service_role;

-- 6. KONTRAK BACA PUBLIK / NAWRA v1 ------------------------------------------
-- View sengaja berjalan dengan hak OWNER postgres (security_invoker=false),
-- bukan caller: caller tidak mempunyai SELECT tabel dasar. Karena itu SEMUA
-- filter publikasi dan daftar kolom ditulis eksplisit di setiap view.
-- security_barrier membantu mencegah predicate pemanggil mendahului filter.
-- Jangan ubah menjadi SELECT *, jangan beri role API ownership tabel/view.
CREATE OR REPLACE VIEW public.nasab_nawra_people_v1
WITH (security_barrier=true, security_invoker=false) AS
SELECT i.id,i.name,i.gender,i.birth_date,i.death_date,i.birth_place,i.death_place,
  NULL::text AS current_location, i.education,i.occupation,i.bio,i.slug,
  i.profile_photo_url,i.is_alive,i.is_verified,i.verification_type,
  NULL::text AS verification_source,
  CASE WHEN f.visibility='public' AND f.deleted_at IS NULL THEN f.id END AS father_id,
  CASE WHEN m.visibility='public' AND m.deleted_at IS NULL THEN m.id END AS mother_id,
  i.revision,i.created_at,i.updated_at
FROM public.individuals i
LEFT JOIN public.individuals f ON f.id=i.father_id
LEFT JOIN public.individuals m ON m.id=i.mother_id
WHERE i.visibility='public' AND i.deleted_at IS NULL;
-- Lokasi kini, status ekonomi, reviewer, dan URL verifikasi lama tidak dibuka.
-- Publikasi bio/foto/tanggal tetap memerlukan peninjauan isi oleh admin.
-- Parent NULL pada kontrak berarti tidak tersedia untuk pembaca ini;
-- Nawra tidak boleh menyimpulkan bahwa orang tersebut tidak memiliki orang tua.

CREATE OR REPLACE VIEW public.nasab_nawra_marriages_v1
WITH (security_barrier=true, security_invoker=false) AS
SELECT m.id,m.husband_id,m.wife_id,m.marriage_date,m.is_active,m.revision,m.created_at,m.updated_at
FROM public.marriages m
JOIN public.nasab_nawra_people_v1 h ON h.id=m.husband_id
JOIN public.nasab_nawra_people_v1 w ON w.id=m.wife_id
WHERE m.visibility='public' AND m.deleted_at IS NULL;

CREATE OR REPLACE VIEW public.nasab_nawra_sources_v1
WITH (security_barrier=true, security_invoker=false) AS
SELECT s.id,s.individual_id,s.title,s.url,s.description,s.external_system,
  s.external_record_id,s.revision,s.created_at,s.updated_at
FROM public.sources s
WHERE s.visibility='public' AND s.deleted_at IS NULL
  AND (s.individual_id IS NULL OR EXISTS (
    SELECT 1 FROM public.nasab_nawra_people_v1 p WHERE p.id=s.individual_id));

CREATE OR REPLACE VIEW public.nasab_nawra_events_v1
WITH (security_barrier=true, security_invoker=false) AS
SELECT e.id,e.individual_id,e.type,e.date,e.description,e.location,e.revision,e.created_at,e.updated_at
FROM public.events e JOIN public.nasab_nawra_people_v1 p ON p.id=e.individual_id
WHERE e.visibility='public' AND e.deleted_at IS NULL;

CREATE OR REPLACE VIEW public.nasab_nawra_evidence_v1
WITH (security_barrier=true, security_invoker=false) AS
SELECT e.id,e.individual_id,e.marriage_id,e.related_person_id,e.source_id,e.predicate,
  e.asserted_value,e.locator,e.quotation,e.review_status,e.reviewed_at,e.revision,e.updated_at
FROM public.nasab_evidence_links e
JOIN public.nasab_nawra_sources_v1 s ON s.id=e.source_id
LEFT JOIN public.nasab_nawra_people_v1 p ON p.id=e.individual_id
LEFT JOIN public.nasab_nawra_marriages_v1 m ON m.id=e.marriage_id
LEFT JOIN public.nasab_nawra_people_v1 r ON r.id=e.related_person_id
WHERE e.visibility='public' AND e.deleted_at IS NULL
  AND (p.id IS NOT NULL OR m.id IS NOT NULL)
  AND (e.related_person_id IS NULL OR r.id IS NOT NULL)
  AND (e.predicate<>'father_id' OR p.father_id=e.related_person_id)
  AND (e.predicate<>'mother_id' OR p.mother_id=e.related_person_id);
-- review_status tetap dibawa; 'disputed' bukan fakta terverifikasi.

DO $$
DECLARE v text;
BEGIN
  FOREACH v IN ARRAY ARRAY['nasab_nawra_people_v1','nasab_nawra_marriages_v1','nasab_nawra_sources_v1','nasab_nawra_events_v1','nasab_nawra_evidence_v1'] LOOP
    EXECUTE format('ALTER VIEW public.%I OWNER TO postgres',v);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated',v);
    EXECUTE format('GRANT SELECT ON public.%I TO anon, authenticated, service_role',v);
  END LOOP;
END $$;

-- 7. INDEKS: foreign key tidak otomatis mendapat indeks di PostgreSQL ---------
CREATE INDEX IF NOT EXISTS idx_individuals_father ON public.individuals(father_id);
CREATE INDEX IF NOT EXISTS idx_individuals_mother ON public.individuals(mother_id);
CREATE INDEX IF NOT EXISTS idx_marriages_husband ON public.marriages(husband_id);
CREATE INDEX IF NOT EXISTS idx_marriages_wife ON public.marriages(wife_id);
CREATE INDEX IF NOT EXISTS nasab_sources_person_idx ON public.sources(individual_id);
CREATE INDEX IF NOT EXISTS nasab_events_person_date_idx ON public.events(individual_id,date);
CREATE INDEX IF NOT EXISTS nasab_evidence_person_idx ON public.nasab_evidence_links(individual_id);
CREATE INDEX IF NOT EXISTS nasab_evidence_marriage_idx ON public.nasab_evidence_links(marriage_id);
CREATE INDEX IF NOT EXISTS nasab_evidence_source_idx ON public.nasab_evidence_links(source_id);
CREATE INDEX IF NOT EXISTS nasab_evidence_related_idx ON public.nasab_evidence_links(related_person_id);
CREATE INDEX IF NOT EXISTS nasab_evidence_reviewer_idx ON public.nasab_evidence_links(reviewed_by);
CREATE INDEX IF NOT EXISTS nasab_pending_changes_idx ON public.nasab_change_log(id) WHERE processed_at IS NULL;
CREATE INDEX IF NOT EXISTS nasab_changes_entity_idx ON public.nasab_change_log(entity_table,entity_id,id);
CREATE INDEX IF NOT EXISTS nasab_people_public_idx ON public.individuals(id) WHERE visibility='public' AND deleted_at IS NULL;

-- 8. DOKUMENTASI TERSIMPAN DI KATALOG DATABASE --------------------------------
COMMENT ON TABLE public.individuals IS 'Tokoh dan parent biologis kanonis. UUID stabil; NULL adalah tidak diketahui. Data privat dibaca admin saja.';
COMMENT ON TABLE public.marriages IS 'Relasi perkawinan; tidak membuktikan parent biologis. Mendukung beberapa perkawinan sepanjang hidup.';
COMMENT ON TABLE public.sources IS 'Katalog bukti, termasuk referensi dokumen Turots/Paperless. Publikasi terpisah dari profil.';
COMMENT ON TABLE public.events IS 'Linimasa tokoh; adapter Nawra harus membaca kontrak events secara eksplisit.';
COMMENT ON TABLE public.nasab_evidence_links IS 'Bukti per fakta/relasi, dengan locator, kutipan, dan status tinjauan; is_verified profil tidak menggantikannya.';
COMMENT ON TABLE public.nasab_change_log IS 'Audit privat dan outbox idempoten. Worker wajib menghapus bukti usang dan merekonsiliasi seluruh indeks.';
COMMENT ON TABLE public.nasab_settings IS 'Pengaturan aplikasi: root UUID eksplisit, tidak dicari melalui nama.';
COMMENT ON VIEW public.nasab_nawra_people_v1 IS 'Kontrak publik v1 untuk Nasab/Nawra; field sensitif disaring dan parent privat disamarkan menjadi NULL.';
COMMENT ON COLUMN public.individuals.is_alive IS 'true=hidup, false=wafat, NULL=belum diketahui; UI harus mendukung ketiga keadaan.';
COMMENT ON COLUMN public.individuals.revision IS 'Versi record otomatis naik saat UPDATE; gunakan untuk deteksi konflik dan invalidasi cache.';
COMMENT ON COLUMN public.nasab_evidence_links.asserted_value IS 'Nilai fakta yang diverifikasi. Perubahan fakta memerlukan peninjauan bukti kembali.';

NOTIFY pgrst, 'reload schema';
COMMIT;

-- 9. LANGKAH SESUDAH PENERAPAN (CONTOH, TIDAK DIEKSEKUSI) ----------------------
-- a. Daftarkan admin menggunakan UUID akun terverifikasi; tetapkan root.
-- b. Ubah frontend publik ke nasab_nawra_people_v1/marriages_v1/events_v1.
--    Admin harus mengisi visibility dan menggunakan deleted_at saat menghapus.
--    UI tidak lagi menyebut is_alive=NULL sebagai 'Masih Hidup'.
-- c. Ubah adapter Nawra ke lima view kontrak; gunakan pagination order(id),
--    status unknown/ambiguous, batas pencarian, dan bukti per jalur.
-- d. Tinjau lalu publikasikan record yang dipilih. Jangan bulk-publish otomatis.
-- e. Full reconcile indeks Nawra, termasuk penonaktifan bukti lama/private;
--    aktifkan worker outbox dengan service_role hanya pada server terpercaya.
-- f. Tes API sebagai anon, authenticated non-admin, admin: anon hanya view,
--    non-admin tidak bisa membaca/tulis tabel dasar, admin bisa mengelola.
-- g. Uji update/delete/private -> seluruh indeks berhenti memakai versi lama.
-- h. Periksa dan perbaiki parent diri sendiri/ayah=ibu/pasangan diri sendiri,
--    lalu VALIDATE constraint; audit siklus dan tanggal secara terpisah.
-- i. Hak akses tambahan dari role/view/RPC di luar file ini perlu diinventarisasi
--    pada database produksi; file ini hanya mengelola objek Nasab yang tertera.
-- j. Retensi log dapat memuat data pribadi: tetapkan kebijakan dan backup aman.
