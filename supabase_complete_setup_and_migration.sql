-- ==============================================================================
-- PURE FOR CURE (HARE KRISHNA MOVEMENT GUWAHATI) - SUPABASE MASTER SETUP SCRIPT
-- Run this entire script in your NEW Supabase project SQL Editor.
-- ==============================================================================

-- Clean up pre-existing empty/template tables so correct UUID schema applies:
DROP TABLE IF EXISTS public.donations CASCADE;
DROP TABLE IF EXISTS public.newsletter_subscribers CASCADE;
DROP TABLE IF EXISTS public.volunteer_applications CASCADE;
DROP TABLE IF EXISTS public.contact_inquiries CASCADE;
DROP TABLE IF EXISTS public.csr_inquiries CASCADE;

-- 1. DONATIONS TABLE (Core Ledger for Online & Offline Seva)
CREATE TABLE public.donations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    amount NUMERIC NOT NULL,
    location TEXT DEFAULT 'general',
    method TEXT DEFAULT 'Razorpay',
    status TEXT DEFAULT 'Success',
    txn_id TEXT,
    notes TEXT
);

CREATE INDEX idx_donations_created_at ON public.donations(created_at DESC);
CREATE INDEX idx_donations_location ON public.donations(location);
CREATE INDEX idx_donations_status ON public.donations(status);

ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read on successful donations" ON public.donations;
CREATE POLICY "Allow public read on successful donations"
    ON public.donations FOR SELECT
    USING (status = 'Success');

DROP POLICY IF EXISTS "Allow public insertion on donations" ON public.donations;
CREATE POLICY "Allow public insertion on donations"
    ON public.donations FOR INSERT
    WITH CHECK (true);

-- 2. NEWSLETTER SUBSCRIBERS TABLE
CREATE TABLE public.newsletter_subscribers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    source TEXT DEFAULT 'website_footer',
    status TEXT DEFAULT 'active',
    notes TEXT
);

CREATE UNIQUE INDEX idx_newsletter_email ON public.newsletter_subscribers(email);
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read for newsletter check" ON public.newsletter_subscribers;
CREATE POLICY "Allow public read for newsletter check"
    ON public.newsletter_subscribers FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Allow public insert on newsletter" ON public.newsletter_subscribers;
CREATE POLICY "Allow public insert on newsletter"
    ON public.newsletter_subscribers FOR INSERT
    WITH CHECK (true);

-- 3. VOLUNTEER APPLICATIONS TABLE
CREATE TABLE public.volunteer_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    city TEXT,
    volunteer_type TEXT DEFAULT 'individual',
    organization TEXT,
    preferred_role TEXT,
    availability TEXT,
    notes TEXT,
    status TEXT DEFAULT 'pending'
);

ALTER TABLE public.volunteer_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public insert on volunteer applications" ON public.volunteer_applications;
CREATE POLICY "Allow public insert on volunteer applications"
    ON public.volunteer_applications FOR INSERT
    WITH CHECK (true);

-- 4. CONTACT INQUIRIES TABLE
CREATE TABLE public.contact_inquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    first_name TEXT,
    last_name TEXT,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    subject TEXT,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'new'
);

ALTER TABLE public.contact_inquiries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public insert on contact inquiries" ON public.contact_inquiries;
CREATE POLICY "Allow public insert on contact inquiries"
    ON public.contact_inquiries FOR INSERT
    WITH CHECK (true);

-- 5. CSR INQUIRIES TABLE
CREATE TABLE public.csr_inquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    company_name TEXT NOT NULL,
    contact_person TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    partnership_type TEXT,
    budget_range TEXT,
    message TEXT,
    status TEXT DEFAULT 'pending'
);

ALTER TABLE public.csr_inquiries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public insert on csr inquiries" ON public.csr_inquiries;
CREATE POLICY "Allow public insert on csr inquiries"
    ON public.csr_inquiries FOR INSERT
    WITH CHECK (true);

-- 6. STORAGE BUCKET: receipts (For 80G PDF Receipts)
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Allow public select receipts" ON storage.objects;
CREATE POLICY "Allow public select receipts"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'receipts');

DROP POLICY IF EXISTS "Allow public upload receipts" ON storage.objects;
CREATE POLICY "Allow public upload receipts"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'receipts');

DROP POLICY IF EXISTS "Allow public update receipts" ON storage.objects;
CREATE POLICY "Allow public update receipts"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'receipts')
    WITH CHECK (bucket_id = 'receipts');

-- 7. HISTORICAL DATA MIGRATION (18 PREVIOUS TEST/LIVE DONATIONS)
-- Preserving all donations recorded prior to migration:

INSERT INTO public.donations (id, created_at, date, name, email, phone, amount, location, method, status, txn_id, notes) VALUES ('cdcee2d1-95e9-4d48-bc3d-9d0ff6f2dc4e', '2026-06-17T05:39:24.780187+00:00', '2026-06-17', 'MAYANK SINGH', 'mayankkd16108@gmail.com', '+917909091719', 1, 'general', 'Razorpay', 'Success', 'pay_T2aOLXGlWhG1i6', 'iygguh9h') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.donations (id, created_at, date, name, email, phone, amount, location, method, status, txn_id, notes) VALUES ('10e40dff-28a9-4de0-a976-c05bc2f9aab7', '2026-06-17T05:40:08.773272+00:00', '2026-06-17', 'MAYANK SINGH', 'mayankkd16108@gmail.com', '+917909091719', 1, 'general', 'Razorpay', 'Success', 'pay_T2aP8Hr0YDFmfn', 'kiuhiu') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.donations (id, created_at, date, name, email, phone, amount, location, method, status, txn_id, notes) VALUES ('ba214acf-55b5-4fdb-be5e-91069f99f191', '2026-06-17T17:45:42.143887+00:00', '2026-06-17', 'TEST', 'rmx230@gmail.com', '7002473993', 1, 'general', 'Razorpay', 'Success', 'pay_T2mlXXkUymwJkx', 'Guwahati Assam') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.donations (id, created_at, date, name, email, phone, amount, location, method, status, txn_id, notes) VALUES ('9012ef0a-bba6-4c81-bb8b-3afd3ec6bc1a', '2026-06-18T05:38:40.424372+00:00', '2026-06-18', 'MA CALUDE', 'noclaudesubscription@gmail.com', '213123123123', 1, 'general', 'Razorpay', 'Success', 'pay_T2yuf5lQsOR5CD', '12312') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.donations (id, created_at, date, name, email, phone, amount, location, method, status, txn_id, notes) VALUES ('ea756b82-0944-4f23-becf-72865b732331', '2026-06-18T09:16:08.290808+00:00', '2026-06-18', 'BHANWAR SINGH', 'nrsdbhawar@gmail.com', '9678008915', 80, 'general', 'Razorpay', 'Success', 'pay_T32cOJF68HUSuT', 'Hare Krishna Mandir Marg, Near IIT Guwahati.') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.donations (id, created_at, date, name, email, phone, amount, location, method, status, txn_id, notes) VALUES ('3641f56b-4fa6-42b1-b86f-9ac016ac5a64', '2026-06-19T21:33:11.676459+00:00', '2026-06-19', 'ANJALI KUMARI', 'nam.anjalikumari@gmail.com', '+916203454984', 1, 'general', 'Razorpay', 'Success', 'pay_T3di6iUMsZnppp', 'Lakhisarai') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.donations (id, created_at, date, name, email, phone, amount, location, method, status, txn_id, notes) VALUES ('2b1b6dc1-1e7d-4fad-aec1-67472ed07cb3', '2026-06-19T23:10:50.874141+00:00', '2026-06-19', 'ANJALI', 'nam.anjalikumari@gmail.com', '6203454984', 1, 'general', 'Razorpay', 'Success', 'pay_T3fN4YsVt2ZaMm', 'Lakhisarai') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.donations (id, created_at, date, name, email, phone, amount, location, method, status, txn_id, notes) VALUES ('7dc19651-2301-45ab-9a9b-df287ffc4997', '2026-06-20T14:11:48.985021+00:00', '2026-06-20', 'MAYANK SINGH', 'mayankkd16108@gmail.com', '+917909091719', 1, 'general', 'Razorpay', 'Success', 'pay_T3uivvkmTXimiE', 'asdasdasd') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.donations (id, created_at, date, name, email, phone, amount, location, method, status, txn_id, notes) VALUES ('f7ae6b36-3de8-474c-816d-6665a50d1fb2', '2026-06-20T14:22:18.59738+00:00', '2026-06-20', 'MAYANK K SINGH', 'mayankkd16108@gmail.com', '+917909091719', 2, 'general', 'Razorpay', 'Success', 'pay_T3uu2w9H3ReCQZ', 'asdasdasd \n Receipt: https://icadpdzapgkxqbvqldzy.supabase.co/storage/v1/object/public/receipts/Donation-Receipt-PFC-DR-202606-3RECQZ.pdf') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.donations (id, created_at, date, name, email, phone, amount, location, method, status, txn_id, notes) VALUES ('0bdb802c-a0c9-4fc8-af84-d15f1700ba45', '2026-06-20T14:33:36.427558+00:00', '2026-06-20', 'MAYANK SINGH', 'mayankkd16108@gmail.com', '+917909091719', 1, 'general', 'Razorpay', 'Success', 'pay_T3v5xmlxyoSdDj', 'kjo \n Receipt: https://icadpdzapgkxqbvqldzy.supabase.co/storage/v1/object/public/receipts/Donation-Receipt-PFC-DR-202606-YOSDDJ.pdf') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.donations (id, created_at, date, name, email, phone, amount, location, method, status, txn_id, notes) VALUES ('88006e53-4c9b-4f73-9142-a03cd27b4abc', '2026-06-20T14:46:16.646015+00:00', '2026-06-20', 'MAYANK SINGH TEST', 'mayankkd16108@gmail.com', '+917909091719', 1, 'general', 'Razorpay', 'Success', 'pay_T3vJMMhbAwpp5d', 'ooooooooooo \n Receipt: https://icadpdzapgkxqbvqldzy.supabase.co/storage/v1/object/public/receipts/Donation-Receipt-PFC-DR-202606-AWPP5D.pdf') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.donations (id, created_at, date, name, email, phone, amount, location, method, status, txn_id, notes) VALUES ('3d89792b-cd83-45de-a8db-51874438bb21', '2026-06-20T22:17:23.300688+00:00', '2026-06-20', 'MAYANK', 'anjalisingh62034@gmail.com', '6203454984', 1, 'general', 'Razorpay', 'Success', 'pay_T42ztaYAE5M4sq', 'NH-11 sobhnagar') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.donations (id, created_at, date, name, email, phone, amount, location, method, status, txn_id, notes) VALUES ('444df092-b5bb-44f6-8469-208eefcd2e23', '2026-06-24T10:50:24.918327+00:00', '2026-06-24', 'REETUMONI SINGHA', 'rmx230@gmail.com', '7002473993', 20, 'borooah', 'Razorpay', 'Success', 'pay_T5RQgUi0LgqWKJ', '48 Trinath Path Dhirenpara Guwahati \n PAN: CKXPX2350E \n Receipt: https://icadpdzapgkxqbvqldzy.supabase.co/storage/v1/object/public/receipts/Donation-Receipt-PFC-DR-202606-LGQWKJ.pdf') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.donations (id, created_at, date, name, email, phone, amount, location, method, status, txn_id, notes) VALUES ('2c979596-6d4a-47a7-b037-71a0147ea589', '2026-07-02T12:42:10.36631+00:00', '2026-07-02', 'SANTANA HALOI', 'santanahaloi91@gmail.com', '+918471838676', 800, 'gmch', 'Razorpay', 'Success', 'pay_T8dalclX7Jvb6V', 'Pragatinagar,satgaon \n Bylane 4,house no 2,guwahati 781171') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.donations (id, created_at, date, name, email, phone, amount, location, method, status, txn_id, notes) VALUES ('85086850-3547-4357-be25-f22efb943e2c', '2026-09-02T04:09:45.722914+00:00', '2026-09-02', 'SANTANA HALOI', 'santanahaloi91@gmail.com', '+918471838676', 800, 'borooah', 'Razorpay', 'Success', 'pay_TX1zfjCB5McwKq', 'Pragatinagar,satgaon \n Bylane 4,house no 2,guwahati 781171') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.donations (id, created_at, date, name, email, phone, amount, location, method, status, txn_id, notes) VALUES ('7047c3a8-70fb-45d2-bbef-5bf515023431', '2026-09-14T16:26:15.547693+00:00', '2026-09-14', 'SAGAR BARUAH', 'sagarbaruaha2core@gmail.com', '8011225405', 800, 'assam-flood-relief', 'Razorpay', 'Success', 'pay_Tbyx9eIkVq86I5', 'Vill: Solagoan, P.O. Ghoramari, Tezpur, Sonitpur, Assam \n Receipt: https://icadpdzapgkxqbvqldzy.supabase.co/storage/v1/object/public/receipts/Donation-Receipt-PFC-DR-202609-VQ86I5.pdf') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.donations (id, created_at, date, name, email, phone, amount, location, method, status, txn_id, notes) VALUES ('6ffb2cb5-5617-4f0d-8b2d-bc3ecfe32fb4', '2026-09-25T09:55:01.690305+00:00', '2026-09-25', 'ARUNJYOTI BURAGOHAIN', 'earth01ab@gmail.com', '9678599972', 4800, 'gmch', 'Razorpay', 'Success', 'pay_TgEANUCBWeM3uB', 'LELUWANI \n GHILAMARA NAGAR \n GHILAMARA \n PAN: CGBPB4413P') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.donations (id, created_at, date, name, email, phone, amount, location, method, status, txn_id, notes) VALUES ('704604e8-b530-4971-a52d-77b62235ed30', '2026-10-10T04:37:59.23498+00:00', '2026-10-10', 'SANTANA HALOI', 'santanahaloi91@gmail.com', '+918471838676', 800, 'borooah', 'Razorpay', 'Success', 'pay_Tm4lzdsVTQFef1', 'Pragatinagar,satgaon \n Bylane 4,house no 2,guwahati 781171') ON CONFLICT (id) DO NOTHING;