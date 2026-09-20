-- ============================================================
-- BlueRiver Services - Complete database setup script
-- Generated 2026-09-20 from the live database
-- ============================================================
--
-- WHAT THIS IS
--   A single, safe, repeatable script that builds the whole database
--   structure. Run it on a brand-new database to create everything, or on
--   an existing database to bring it up to date.
--
-- HOW TO RUN
--   psql "<your-database-url>" -f database_setup.sql
--   (or paste it into the SQL editor of the new project and run it)
--
-- SAFETY
--   * No DROP TABLE, no TRUNCATE, no DELETE. Existing data is never touched.
--   * Tables and columns are only added when missing.
--   * Functions, triggers and security rules are refreshed to this version.
--   * Default/reference rows are inserted only when absent.
--   * The whole script runs in one transaction: any failure rolls it all back.
--
-- NOT INCLUDED (do these separately after running the script)
--   1. Secrets: RESEND_API_KEY, GOOGLE_MAPS_API_KEY, GOOGLE_REVIEWS_CRON_SECRET
--   2. Deploy the edge functions in supabase/functions/
--   3. Create your first admin user, then add a row in public.user_roles
--      with role = 'admin'
--   4. Customer data (bookings, quotes, messages, applications, invoices,
--      reviews) is intentionally NOT part of this script.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Extensions and types
-- ------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Role type used across permissions
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'user', 'manager', 'staff');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'user';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'manager';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'staff';

-- Number sequences for invoices and receipts
CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq;
CREATE SEQUENCE IF NOT EXISTS public.receipt_number_seq;

-- ------------------------------------------------------------
-- 2. Tables (created when missing; missing columns added)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.availability_settings (
  id uuid DEFAULT gen_random_uuid(),
  setting_key text,
  setting_value jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.availability_settings ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.availability_settings ADD COLUMN IF NOT EXISTS setting_key text;
ALTER TABLE public.availability_settings ADD COLUMN IF NOT EXISTS setting_value jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.availability_settings ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.availability_settings ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

CREATE TABLE IF NOT EXISTS public.blocked_dates (
  id uuid DEFAULT gen_random_uuid(),
  blocked_date date,
  reason text,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.blocked_dates ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.blocked_dates ADD COLUMN IF NOT EXISTS blocked_date date;
ALTER TABLE public.blocked_dates ADD COLUMN IF NOT EXISTS reason text;
ALTER TABLE public.blocked_dates ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();

CREATE TABLE IF NOT EXISTS public.booking_activity_logs (
  id uuid DEFAULT gen_random_uuid(),
  booking_id uuid,
  action text,
  details text,
  previous_status text,
  new_status text,
  actor_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  notes text
);
ALTER TABLE public.booking_activity_logs ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.booking_activity_logs ADD COLUMN IF NOT EXISTS booking_id uuid;
ALTER TABLE public.booking_activity_logs ADD COLUMN IF NOT EXISTS action text;
ALTER TABLE public.booking_activity_logs ADD COLUMN IF NOT EXISTS details text;
ALTER TABLE public.booking_activity_logs ADD COLUMN IF NOT EXISTS previous_status text;
ALTER TABLE public.booking_activity_logs ADD COLUMN IF NOT EXISTS new_status text;
ALTER TABLE public.booking_activity_logs ADD COLUMN IF NOT EXISTS actor_id uuid;
ALTER TABLE public.booking_activity_logs ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.booking_activity_logs ADD COLUMN IF NOT EXISTS notes text;

CREATE TABLE IF NOT EXISTS public.bookings (
  id uuid DEFAULT gen_random_uuid(),
  name text,
  email text,
  phone text,
  address text,
  service_type text,
  booking_date date,
  time_slot text,
  status text DEFAULT 'pending'::text,
  notes text,
  consent_given boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  selected_addons jsonb DEFAULT '[]'::jsonb,
  total_price numeric,
  cancellation_reason text,
  property_type text,
  square_footage text,
  bedrooms integer,
  bathrooms integer,
  frequency text,
  has_pets boolean DEFAULT false,
  entry_codes text,
  preferred_contact text,
  quote_id uuid,
  service_type_id uuid,
  custom_fields jsonb DEFAULT '{}'::jsonb,
  floor_type text,
  pet_count integer,
  condition_level text,
  is_empty_property boolean DEFAULT false,
  payment_status text DEFAULT 'unpaid'::text,
  paid_at timestamp without time zone,
  line_items jsonb DEFAULT '[]'::jsonb,
  subtotal numeric DEFAULT 0,
  tax_amount numeric DEFAULT 0,
  total_amount numeric DEFAULT 0,
  source text DEFAULT 'quote'::text
);
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS service_type text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS booking_date date;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS time_slot text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending'::text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS consent_given boolean DEFAULT false;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS selected_addons jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS total_price numeric;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS cancellation_reason text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS property_type text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS square_footage text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS bedrooms integer;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS bathrooms integer;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS frequency text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS has_pets boolean DEFAULT false;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS entry_codes text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS preferred_contact text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS quote_id uuid;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS service_type_id uuid;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS custom_fields jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS floor_type text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS pet_count integer;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS condition_level text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS is_empty_property boolean DEFAULT false;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'unpaid'::text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS paid_at timestamp without time zone;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS line_items jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS subtotal numeric DEFAULT 0;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS tax_amount numeric DEFAULT 0;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS total_amount numeric DEFAULT 0;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS source text DEFAULT 'quote'::text;

CREATE TABLE IF NOT EXISTS public.branding_settings (
  id uuid DEFAULT gen_random_uuid(),
  setting_key text,
  setting_value text DEFAULT ''::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.branding_settings ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.branding_settings ADD COLUMN IF NOT EXISTS setting_key text;
ALTER TABLE public.branding_settings ADD COLUMN IF NOT EXISTS setting_value text DEFAULT ''::text;
ALTER TABLE public.branding_settings ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.branding_settings ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

CREATE TABLE IF NOT EXISTS public.cleaner_application_responses (
  id uuid DEFAULT gen_random_uuid(),
  application_id uuid,
  decision text,
  subject text,
  body text,
  recipient_email text,
  sent_by uuid,
  sent_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.cleaner_application_responses ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.cleaner_application_responses ADD COLUMN IF NOT EXISTS application_id uuid;
ALTER TABLE public.cleaner_application_responses ADD COLUMN IF NOT EXISTS decision text;
ALTER TABLE public.cleaner_application_responses ADD COLUMN IF NOT EXISTS subject text;
ALTER TABLE public.cleaner_application_responses ADD COLUMN IF NOT EXISTS body text;
ALTER TABLE public.cleaner_application_responses ADD COLUMN IF NOT EXISTS recipient_email text;
ALTER TABLE public.cleaner_application_responses ADD COLUMN IF NOT EXISTS sent_by uuid;
ALTER TABLE public.cleaner_application_responses ADD COLUMN IF NOT EXISTS sent_at timestamp with time zone DEFAULT now();
ALTER TABLE public.cleaner_application_responses ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();

CREATE TABLE IF NOT EXISTS public.cleaner_applications (
  id uuid DEFAULT gen_random_uuid(),
  full_name text,
  email text,
  phone text,
  availability text,
  experience text,
  service_type text,
  message text,
  status text DEFAULT 'new'::text,
  admin_notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  middle_name text,
  has_license boolean,
  reference_1 text,
  reference_2 text,
  reference_3 text,
  authorized_to_work boolean,
  personality_bio text,
  address text,
  resume_url text,
  reviewed_at timestamp with time zone,
  reviewed_by uuid
);
ALTER TABLE public.cleaner_applications ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.cleaner_applications ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE public.cleaner_applications ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.cleaner_applications ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.cleaner_applications ADD COLUMN IF NOT EXISTS availability text;
ALTER TABLE public.cleaner_applications ADD COLUMN IF NOT EXISTS experience text;
ALTER TABLE public.cleaner_applications ADD COLUMN IF NOT EXISTS service_type text;
ALTER TABLE public.cleaner_applications ADD COLUMN IF NOT EXISTS message text;
ALTER TABLE public.cleaner_applications ADD COLUMN IF NOT EXISTS status text DEFAULT 'new'::text;
ALTER TABLE public.cleaner_applications ADD COLUMN IF NOT EXISTS admin_notes text;
ALTER TABLE public.cleaner_applications ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.cleaner_applications ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.cleaner_applications ADD COLUMN IF NOT EXISTS middle_name text;
ALTER TABLE public.cleaner_applications ADD COLUMN IF NOT EXISTS has_license boolean;
ALTER TABLE public.cleaner_applications ADD COLUMN IF NOT EXISTS reference_1 text;
ALTER TABLE public.cleaner_applications ADD COLUMN IF NOT EXISTS reference_2 text;
ALTER TABLE public.cleaner_applications ADD COLUMN IF NOT EXISTS reference_3 text;
ALTER TABLE public.cleaner_applications ADD COLUMN IF NOT EXISTS authorized_to_work boolean;
ALTER TABLE public.cleaner_applications ADD COLUMN IF NOT EXISTS personality_bio text;
ALTER TABLE public.cleaner_applications ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.cleaner_applications ADD COLUMN IF NOT EXISTS resume_url text;
ALTER TABLE public.cleaner_applications ADD COLUMN IF NOT EXISTS reviewed_at timestamp with time zone;
ALTER TABLE public.cleaner_applications ADD COLUMN IF NOT EXISTS reviewed_by uuid;

CREATE TABLE IF NOT EXISTS public.condition_settings (
  id uuid DEFAULT gen_random_uuid(),
  name text,
  surcharge_amount integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.condition_settings ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.condition_settings ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.condition_settings ADD COLUMN IF NOT EXISTS surcharge_amount integer DEFAULT 0;
ALTER TABLE public.condition_settings ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.condition_settings ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

CREATE TABLE IF NOT EXISTS public.contact_activity_logs (
  id uuid DEFAULT gen_random_uuid(),
  contact_id uuid,
  actor_id uuid,
  action text,
  previous_status text,
  new_status text,
  notes text,
  details text,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.contact_activity_logs ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.contact_activity_logs ADD COLUMN IF NOT EXISTS contact_id uuid;
ALTER TABLE public.contact_activity_logs ADD COLUMN IF NOT EXISTS actor_id uuid;
ALTER TABLE public.contact_activity_logs ADD COLUMN IF NOT EXISTS action text;
ALTER TABLE public.contact_activity_logs ADD COLUMN IF NOT EXISTS previous_status text;
ALTER TABLE public.contact_activity_logs ADD COLUMN IF NOT EXISTS new_status text;
ALTER TABLE public.contact_activity_logs ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.contact_activity_logs ADD COLUMN IF NOT EXISTS details text;
ALTER TABLE public.contact_activity_logs ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();

CREATE TABLE IF NOT EXISTS public.contact_submissions (
  id uuid DEFAULT gen_random_uuid(),
  name text,
  email text,
  phone text,
  service_type text,
  message text,
  status text DEFAULT 'pending'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  admin_notes text
);
ALTER TABLE public.contact_submissions ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.contact_submissions ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.contact_submissions ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.contact_submissions ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.contact_submissions ADD COLUMN IF NOT EXISTS service_type text;
ALTER TABLE public.contact_submissions ADD COLUMN IF NOT EXISTS message text;
ALTER TABLE public.contact_submissions ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending'::text;
ALTER TABLE public.contact_submissions ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.contact_submissions ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.contact_submissions ADD COLUMN IF NOT EXISTS admin_notes text;

CREATE TABLE IF NOT EXISTS public.faqs (
  id uuid DEFAULT extensions.uuid_generate_v4(),
  question text,
  answer text,
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.faqs ADD COLUMN IF NOT EXISTS id uuid DEFAULT extensions.uuid_generate_v4();
ALTER TABLE public.faqs ADD COLUMN IF NOT EXISTS question text;
ALTER TABLE public.faqs ADD COLUMN IF NOT EXISTS answer text;
ALTER TABLE public.faqs ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0;
ALTER TABLE public.faqs ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.faqs ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();

CREATE TABLE IF NOT EXISTS public.gallery (
  id uuid DEFAULT gen_random_uuid(),
  image_url text,
  caption text DEFAULT ''::text,
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  category text DEFAULT 'general'::text,
  group_id uuid,
  image_type text DEFAULT 'single'::text
);
ALTER TABLE public.gallery ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.gallery ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.gallery ADD COLUMN IF NOT EXISTS caption text DEFAULT ''::text;
ALTER TABLE public.gallery ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0;
ALTER TABLE public.gallery ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.gallery ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.gallery ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.gallery ADD COLUMN IF NOT EXISTS category text DEFAULT 'general'::text;
ALTER TABLE public.gallery ADD COLUMN IF NOT EXISTS group_id uuid;
ALTER TABLE public.gallery ADD COLUMN IF NOT EXISTS image_type text DEFAULT 'single'::text;

CREATE TABLE IF NOT EXISTS public.google_reviews (
  id uuid DEFAULT gen_random_uuid(),
  review_key text,
  author_name text,
  author_photo_url text,
  author_uri text,
  rating integer,
  text text,
  relative_time text,
  publish_time timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.google_reviews ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.google_reviews ADD COLUMN IF NOT EXISTS review_key text;
ALTER TABLE public.google_reviews ADD COLUMN IF NOT EXISTS author_name text;
ALTER TABLE public.google_reviews ADD COLUMN IF NOT EXISTS author_photo_url text;
ALTER TABLE public.google_reviews ADD COLUMN IF NOT EXISTS author_uri text;
ALTER TABLE public.google_reviews ADD COLUMN IF NOT EXISTS rating integer;
ALTER TABLE public.google_reviews ADD COLUMN IF NOT EXISTS text text;
ALTER TABLE public.google_reviews ADD COLUMN IF NOT EXISTS relative_time text;
ALTER TABLE public.google_reviews ADD COLUMN IF NOT EXISTS publish_time timestamp with time zone;
ALTER TABLE public.google_reviews ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.google_reviews ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

CREATE TABLE IF NOT EXISTS public.homepage_images (
  id uuid DEFAULT gen_random_uuid(),
  section_key text,
  image_url text DEFAULT ''::text,
  label text DEFAULT ''::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.homepage_images ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.homepage_images ADD COLUMN IF NOT EXISTS section_key text;
ALTER TABLE public.homepage_images ADD COLUMN IF NOT EXISTS image_url text DEFAULT ''::text;
ALTER TABLE public.homepage_images ADD COLUMN IF NOT EXISTS label text DEFAULT ''::text;
ALTER TABLE public.homepage_images ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.homepage_images ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid DEFAULT gen_random_uuid(),
  booking_id uuid,
  quote_id uuid,
  customer_name text,
  customer_email text,
  services jsonb DEFAULT '[]'::jsonb,
  total_amount numeric DEFAULT 0,
  amount_paid numeric DEFAULT 0,
  payment_status text DEFAULT 'unpaid'::text,
  payment_method text,
  notes text,
  issued_date date DEFAULT CURRENT_DATE,
  due_date date,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  invoice_number text,
  subtotal numeric DEFAULT 0,
  tax_amount numeric DEFAULT 0,
  tax_rate numeric DEFAULT 0,
  service_type_id uuid,
  payment_date date,
  payment_reference text,
  line_items jsonb,
  tax numeric,
  total numeric,
  paid_at timestamp without time zone,
  address text
);
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS booking_id uuid;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS quote_id uuid;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS customer_name text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS customer_email text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS services jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS total_amount numeric DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS amount_paid numeric DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'unpaid'::text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS payment_method text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS issued_date date DEFAULT CURRENT_DATE;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS due_date date;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS invoice_number text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS subtotal numeric DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS tax_amount numeric DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS tax_rate numeric DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS service_type_id uuid;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS payment_date date;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS payment_reference text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS line_items jsonb;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS tax numeric;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS total numeric;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS paid_at timestamp without time zone;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS address text;

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid DEFAULT gen_random_uuid(),
  user_id uuid,
  type text DEFAULT 'info'::text,
  message text,
  reference_id uuid,
  reference_type text,
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS type text DEFAULT 'info'::text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS message text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS reference_id uuid;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS reference_type text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS is_read boolean DEFAULT false;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();

CREATE TABLE IF NOT EXISTS public.page_content (
  id uuid DEFAULT gen_random_uuid(),
  page_name text,
  section_key text,
  content jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.page_content ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.page_content ADD COLUMN IF NOT EXISTS page_name text;
ALTER TABLE public.page_content ADD COLUMN IF NOT EXISTS section_key text;
ALTER TABLE public.page_content ADD COLUMN IF NOT EXISTS content jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.page_content ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.page_content ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

CREATE TABLE IF NOT EXISTS public.permission_registry (
  id uuid DEFAULT gen_random_uuid(),
  key text,
  label text,
  description text,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.permission_registry ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.permission_registry ADD COLUMN IF NOT EXISTS key text;
ALTER TABLE public.permission_registry ADD COLUMN IF NOT EXISTS label text;
ALTER TABLE public.permission_registry ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.permission_registry ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();

CREATE TABLE IF NOT EXISTS public.pricing_multipliers (
  id uuid DEFAULT gen_random_uuid(),
  service_type_id uuid,
  axis text,
  key text,
  modifier_type text,
  value numeric,
  display_label text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.pricing_multipliers ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.pricing_multipliers ADD COLUMN IF NOT EXISTS service_type_id uuid;
ALTER TABLE public.pricing_multipliers ADD COLUMN IF NOT EXISTS axis text;
ALTER TABLE public.pricing_multipliers ADD COLUMN IF NOT EXISTS key text;
ALTER TABLE public.pricing_multipliers ADD COLUMN IF NOT EXISTS modifier_type text;
ALTER TABLE public.pricing_multipliers ADD COLUMN IF NOT EXISTS value numeric;
ALTER TABLE public.pricing_multipliers ADD COLUMN IF NOT EXISTS display_label text;
ALTER TABLE public.pricing_multipliers ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.pricing_multipliers ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();

CREATE TABLE IF NOT EXISTS public.quote_drafts (
  id uuid DEFAULT gen_random_uuid(),
  quote_id uuid,
  service_type text,
  scope text,
  base_price numeric DEFAULT 0,
  addons jsonb DEFAULT '[]'::jsonb,
  discount numeric DEFAULT 0,
  tax_rate numeric DEFAULT 0,
  notes text,
  validity_days integer DEFAULT 7,
  prepared_by uuid,
  prepared_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  condition_multiplier numeric DEFAULT 1,
  manual_adjustment numeric DEFAULT 0,
  breakdown jsonb DEFAULT '{}'::jsonb,
  line_items jsonb DEFAULT '[]'::jsonb,
  service_type_id uuid
);
ALTER TABLE public.quote_drafts ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.quote_drafts ADD COLUMN IF NOT EXISTS quote_id uuid;
ALTER TABLE public.quote_drafts ADD COLUMN IF NOT EXISTS service_type text;
ALTER TABLE public.quote_drafts ADD COLUMN IF NOT EXISTS scope text;
ALTER TABLE public.quote_drafts ADD COLUMN IF NOT EXISTS base_price numeric DEFAULT 0;
ALTER TABLE public.quote_drafts ADD COLUMN IF NOT EXISTS addons jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.quote_drafts ADD COLUMN IF NOT EXISTS discount numeric DEFAULT 0;
ALTER TABLE public.quote_drafts ADD COLUMN IF NOT EXISTS tax_rate numeric DEFAULT 0;
ALTER TABLE public.quote_drafts ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.quote_drafts ADD COLUMN IF NOT EXISTS validity_days integer DEFAULT 7;
ALTER TABLE public.quote_drafts ADD COLUMN IF NOT EXISTS prepared_by uuid;
ALTER TABLE public.quote_drafts ADD COLUMN IF NOT EXISTS prepared_at timestamp with time zone DEFAULT now();
ALTER TABLE public.quote_drafts ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.quote_drafts ADD COLUMN IF NOT EXISTS condition_multiplier numeric DEFAULT 1;
ALTER TABLE public.quote_drafts ADD COLUMN IF NOT EXISTS manual_adjustment numeric DEFAULT 0;
ALTER TABLE public.quote_drafts ADD COLUMN IF NOT EXISTS breakdown jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.quote_drafts ADD COLUMN IF NOT EXISTS line_items jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.quote_drafts ADD COLUMN IF NOT EXISTS service_type_id uuid;

CREATE TABLE IF NOT EXISTS public.quote_notes (
  id uuid DEFAULT gen_random_uuid(),
  quote_id uuid,
  note text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.quote_notes ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.quote_notes ADD COLUMN IF NOT EXISTS quote_id uuid;
ALTER TABLE public.quote_notes ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE public.quote_notes ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.quote_notes ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();

CREATE TABLE IF NOT EXISTS public.quote_requests (
  id uuid DEFAULT gen_random_uuid(),
  name text,
  email text,
  phone text,
  address text,
  service_type text,
  description text,
  preferred_contact text DEFAULT 'email'::text,
  attachment_url text,
  status text DEFAULT 'requested'::text,
  consent_given boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  selected_addons jsonb DEFAULT '[]'::jsonb,
  property_type text,
  square_footage text,
  bedrooms integer,
  bathrooms integer,
  frequency text,
  has_pets boolean DEFAULT false,
  entry_codes text,
  close_reason text,
  kitchen_count integer,
  condition_level text,
  full_bathrooms integer,
  half_bathrooms integer,
  living_rooms integer,
  office_rooms integer,
  floor_type text,
  property_size text,
  has_cabinets boolean,
  is_empty_property boolean,
  custom_fields jsonb DEFAULT '{}'::jsonb,
  service_type_id uuid,
  pet_count integer,
  quote_number text
);
ALTER TABLE public.quote_requests ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.quote_requests ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.quote_requests ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.quote_requests ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.quote_requests ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.quote_requests ADD COLUMN IF NOT EXISTS service_type text;
ALTER TABLE public.quote_requests ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.quote_requests ADD COLUMN IF NOT EXISTS preferred_contact text DEFAULT 'email'::text;
ALTER TABLE public.quote_requests ADD COLUMN IF NOT EXISTS attachment_url text;
ALTER TABLE public.quote_requests ADD COLUMN IF NOT EXISTS status text DEFAULT 'requested'::text;
ALTER TABLE public.quote_requests ADD COLUMN IF NOT EXISTS consent_given boolean DEFAULT false;
ALTER TABLE public.quote_requests ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.quote_requests ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.quote_requests ADD COLUMN IF NOT EXISTS selected_addons jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.quote_requests ADD COLUMN IF NOT EXISTS property_type text;
ALTER TABLE public.quote_requests ADD COLUMN IF NOT EXISTS square_footage text;
ALTER TABLE public.quote_requests ADD COLUMN IF NOT EXISTS bedrooms integer;
ALTER TABLE public.quote_requests ADD COLUMN IF NOT EXISTS bathrooms integer;
ALTER TABLE public.quote_requests ADD COLUMN IF NOT EXISTS frequency text;
ALTER TABLE public.quote_requests ADD COLUMN IF NOT EXISTS has_pets boolean DEFAULT false;
ALTER TABLE public.quote_requests ADD COLUMN IF NOT EXISTS entry_codes text;
ALTER TABLE public.quote_requests ADD COLUMN IF NOT EXISTS close_reason text;
ALTER TABLE public.quote_requests ADD COLUMN IF NOT EXISTS kitchen_count integer;
ALTER TABLE public.quote_requests ADD COLUMN IF NOT EXISTS condition_level text;
ALTER TABLE public.quote_requests ADD COLUMN IF NOT EXISTS full_bathrooms integer;
ALTER TABLE public.quote_requests ADD COLUMN IF NOT EXISTS half_bathrooms integer;
ALTER TABLE public.quote_requests ADD COLUMN IF NOT EXISTS living_rooms integer;
ALTER TABLE public.quote_requests ADD COLUMN IF NOT EXISTS office_rooms integer;
ALTER TABLE public.quote_requests ADD COLUMN IF NOT EXISTS floor_type text;
ALTER TABLE public.quote_requests ADD COLUMN IF NOT EXISTS property_size text;
ALTER TABLE public.quote_requests ADD COLUMN IF NOT EXISTS has_cabinets boolean;
ALTER TABLE public.quote_requests ADD COLUMN IF NOT EXISTS is_empty_property boolean;
ALTER TABLE public.quote_requests ADD COLUMN IF NOT EXISTS custom_fields jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.quote_requests ADD COLUMN IF NOT EXISTS service_type_id uuid;
ALTER TABLE public.quote_requests ADD COLUMN IF NOT EXISTS pet_count integer;
ALTER TABLE public.quote_requests ADD COLUMN IF NOT EXISTS quote_number text;

CREATE TABLE IF NOT EXISTS public.receipts (
  id uuid DEFAULT gen_random_uuid(),
  receipt_number text,
  invoice_id uuid,
  payment_date timestamp without time zone,
  amount_paid numeric,
  created_at timestamp without time zone DEFAULT now(),
  line_items jsonb DEFAULT '[]'::jsonb
);
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS receipt_number text;
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS invoice_id uuid;
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS payment_date timestamp without time zone;
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS amount_paid numeric;
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS created_at timestamp without time zone DEFAULT now();
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS line_items jsonb DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid DEFAULT gen_random_uuid(),
  booking_id uuid,
  customer_name text DEFAULT ''::text,
  rating integer,
  comment text,
  is_public boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS booking_id uuid;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS customer_name text DEFAULT ''::text;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS rating integer;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS comment text;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT false;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();

CREATE TABLE IF NOT EXISTS public.service_areas (
  id uuid DEFAULT gen_random_uuid(),
  zip text,
  city text DEFAULT 'Bellevue'::text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.service_areas ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.service_areas ADD COLUMN IF NOT EXISTS zip text;
ALTER TABLE public.service_areas ADD COLUMN IF NOT EXISTS city text DEFAULT 'Bellevue'::text;
ALTER TABLE public.service_areas ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.service_areas ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.service_areas ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

CREATE TABLE IF NOT EXISTS public.service_fields (
  id uuid DEFAULT gen_random_uuid(),
  service_type_id uuid,
  field_key text,
  label text,
  input_type text DEFAULT 'number'::text,
  options jsonb DEFAULT '[]'::jsonb,
  required boolean DEFAULT false,
  display_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.service_fields ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.service_fields ADD COLUMN IF NOT EXISTS service_type_id uuid;
ALTER TABLE public.service_fields ADD COLUMN IF NOT EXISTS field_key text;
ALTER TABLE public.service_fields ADD COLUMN IF NOT EXISTS label text;
ALTER TABLE public.service_fields ADD COLUMN IF NOT EXISTS input_type text DEFAULT 'number'::text;
ALTER TABLE public.service_fields ADD COLUMN IF NOT EXISTS options jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.service_fields ADD COLUMN IF NOT EXISTS required boolean DEFAULT false;
ALTER TABLE public.service_fields ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0;
ALTER TABLE public.service_fields ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.service_fields ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

CREATE TABLE IF NOT EXISTS public.service_pricing_rules (
  id uuid DEFAULT gen_random_uuid(),
  service_type_id uuid,
  category text,
  unit_price integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.service_pricing_rules ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.service_pricing_rules ADD COLUMN IF NOT EXISTS service_type_id uuid;
ALTER TABLE public.service_pricing_rules ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.service_pricing_rules ADD COLUMN IF NOT EXISTS unit_price integer DEFAULT 0;
ALTER TABLE public.service_pricing_rules ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.service_pricing_rules ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

CREATE TABLE IF NOT EXISTS public.service_types (
  id uuid DEFAULT gen_random_uuid(),
  name text,
  base_price integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  tax_applies boolean DEFAULT false
);
ALTER TABLE public.service_types ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.service_types ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.service_types ADD COLUMN IF NOT EXISTS base_price integer DEFAULT 0;
ALTER TABLE public.service_types ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.service_types ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.service_types ADD COLUMN IF NOT EXISTS tax_applies boolean DEFAULT false;

CREATE TABLE IF NOT EXISTS public.services (
  id uuid DEFAULT gen_random_uuid(),
  title text,
  description text DEFAULT ''::text,
  icon text DEFAULT 'Sparkles'::text,
  features text[] DEFAULT '{}'::text[],
  price_starting text,
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  image_url text DEFAULT ''::text,
  service_category text DEFAULT 'main'::text
);
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS description text DEFAULT ''::text;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS icon text DEFAULT 'Sparkles'::text;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS features text[] DEFAULT '{}'::text[];
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS price_starting text;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS image_url text DEFAULT ''::text;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS service_category text DEFAULT 'main'::text;

CREATE TABLE IF NOT EXISTS public.site_settings (
  id uuid DEFAULT gen_random_uuid(),
  setting_key text,
  setting_value text DEFAULT ''::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS setting_key text;
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS setting_value text DEFAULT ''::text;
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

CREATE TABLE IF NOT EXISTS public.social_links (
  id uuid DEFAULT gen_random_uuid(),
  platform_name text,
  url text,
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.social_links ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.social_links ADD COLUMN IF NOT EXISTS platform_name text;
ALTER TABLE public.social_links ADD COLUMN IF NOT EXISTS url text;
ALTER TABLE public.social_links ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0;
ALTER TABLE public.social_links ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.social_links ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.social_links ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

CREATE TABLE IF NOT EXISTS public.testimonials (
  id uuid DEFAULT gen_random_uuid(),
  author_name text,
  author_role text DEFAULT ''::text,
  content text,
  rating integer DEFAULT 5,
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.testimonials ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.testimonials ADD COLUMN IF NOT EXISTS author_name text;
ALTER TABLE public.testimonials ADD COLUMN IF NOT EXISTS author_role text DEFAULT ''::text;
ALTER TABLE public.testimonials ADD COLUMN IF NOT EXISTS content text;
ALTER TABLE public.testimonials ADD COLUMN IF NOT EXISTS rating integer DEFAULT 5;
ALTER TABLE public.testimonials ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0;
ALTER TABLE public.testimonials ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.testimonials ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.testimonials ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid DEFAULT gen_random_uuid(),
  user_id uuid,
  role app_role,
  permissions jsonb DEFAULT '{}'::jsonb
);
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS role app_role;
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS permissions jsonb DEFAULT '{}'::jsonb;

-- ------------------------------------------------------------
-- 3. Keys, unique rules, checks and indexes
-- ------------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE public.availability_settings ADD CONSTRAINT availability_settings_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.blocked_dates ADD CONSTRAINT blocked_dates_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.booking_activity_logs ADD CONSTRAINT booking_activity_logs_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.bookings ADD CONSTRAINT bookings_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.branding_settings ADD CONSTRAINT branding_settings_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.cleaner_application_responses ADD CONSTRAINT cleaner_application_responses_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.cleaner_applications ADD CONSTRAINT cleaner_applications_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.condition_settings ADD CONSTRAINT condition_settings_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.contact_activity_logs ADD CONSTRAINT contact_activity_logs_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.contact_submissions ADD CONSTRAINT contact_submissions_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.faqs ADD CONSTRAINT faqs_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.gallery ADD CONSTRAINT gallery_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.google_reviews ADD CONSTRAINT google_reviews_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.homepage_images ADD CONSTRAINT homepage_images_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.invoices ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.notifications ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.page_content ADD CONSTRAINT page_content_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.permission_registry ADD CONSTRAINT permission_registry_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.pricing_multipliers ADD CONSTRAINT pricing_multipliers_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.quote_drafts ADD CONSTRAINT quote_drafts_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.quote_notes ADD CONSTRAINT quote_notes_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.quote_requests ADD CONSTRAINT quote_requests_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.receipts ADD CONSTRAINT receipts_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.reviews ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.service_areas ADD CONSTRAINT service_areas_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.service_fields ADD CONSTRAINT service_fields_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.service_pricing_rules ADD CONSTRAINT service_pricing_rules_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.service_types ADD CONSTRAINT service_types_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.services ADD CONSTRAINT services_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.site_settings ADD CONSTRAINT site_settings_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.social_links ADD CONSTRAINT social_links_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.testimonials ADD CONSTRAINT testimonials_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.availability_settings ADD CONSTRAINT availability_settings_setting_key_key UNIQUE (setting_key);
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.bookings ADD CONSTRAINT unique_quote_booking UNIQUE (quote_id);
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.branding_settings ADD CONSTRAINT branding_settings_setting_key_key UNIQUE (setting_key);
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.condition_settings ADD CONSTRAINT condition_settings_name_key UNIQUE (name);
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.google_reviews ADD CONSTRAINT google_reviews_review_key_key UNIQUE (review_key);
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.homepage_images ADD CONSTRAINT homepage_images_section_key_key UNIQUE (section_key);
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.invoices ADD CONSTRAINT invoices_invoice_number_key UNIQUE (invoice_number);
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.invoices ADD CONSTRAINT unique_booking_invoice UNIQUE (booking_id);
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.page_content ADD CONSTRAINT page_content_page_name_section_key_key UNIQUE (page_name, section_key);
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.permission_registry ADD CONSTRAINT permission_registry_key_key UNIQUE (key);
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.quote_drafts ADD CONSTRAINT quote_drafts_quote_id_key UNIQUE (quote_id);
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.receipts ADD CONSTRAINT receipts_invoice_id_key UNIQUE (invoice_id);
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.receipts ADD CONSTRAINT receipts_receipt_number_key UNIQUE (receipt_number);
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.service_areas ADD CONSTRAINT service_areas_zip_key UNIQUE (zip);
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.service_fields ADD CONSTRAINT service_fields_service_type_id_field_key_key UNIQUE (service_type_id, field_key);
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.service_pricing_rules ADD CONSTRAINT service_pricing_rules_service_type_id_category_key UNIQUE (service_type_id, category);
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.service_types ADD CONSTRAINT service_types_name_key UNIQUE (name);
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.site_settings ADD CONSTRAINT site_settings_setting_key_key UNIQUE (setting_key);
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.cleaner_applications ADD CONSTRAINT cleaner_applications_service_type_check CHECK ((service_type = ANY (ARRAY['House Cleaning Only'::text, 'Roof Cleaning Only'::text, 'Both House & Roof Cleaning'::text])));
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.cleaner_applications ADD CONSTRAINT cleaner_applications_status_check CHECK ((status = ANY (ARRAY['new'::text, 'reviewing'::text, 'shortlisted'::text, 'interview'::text, 'hired'::text, 'rejected'::text, 'reviewed'::text, 'contacted'::text, 'archived'::text])));
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.contact_submissions ADD CONSTRAINT contact_submissions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'read'::text, 'responded'::text, 'converted'::text, 'archived'::text])));
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.gallery ADD CONSTRAINT gallery_image_type_check CHECK ((image_type = ANY (ARRAY['single'::text, 'before'::text, 'after'::text])));
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.pricing_multipliers ADD CONSTRAINT pricing_multipliers_modifier_type_check CHECK ((modifier_type = ANY (ARRAY['flat_amount'::text, 'percent'::text])));
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.reviews ADD CONSTRAINT reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)));
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.testimonials ADD CONSTRAINT testimonials_rating_check CHECK (((rating >= 1) AND (rating <= 5)));
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.bookings ADD CONSTRAINT bookings_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES quote_requests(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.bookings ADD CONSTRAINT bookings_service_type_id_fkey FOREIGN KEY (service_type_id) REFERENCES service_types(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.cleaner_application_responses ADD CONSTRAINT cleaner_application_responses_application_id_fkey FOREIGN KEY (application_id) REFERENCES cleaner_applications(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.invoices ADD CONSTRAINT invoices_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.invoices ADD CONSTRAINT invoices_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES quote_requests(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.invoices ADD CONSTRAINT invoices_service_type_id_fkey FOREIGN KEY (service_type_id) REFERENCES service_types(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.notifications ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.pricing_multipliers ADD CONSTRAINT pricing_multipliers_service_type_id_fkey FOREIGN KEY (service_type_id) REFERENCES service_types(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.quote_drafts ADD CONSTRAINT quote_drafts_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES quote_requests(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.quote_drafts ADD CONSTRAINT quote_drafts_service_type_id_fkey FOREIGN KEY (service_type_id) REFERENCES service_types(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.quote_notes ADD CONSTRAINT quote_notes_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.quote_notes ADD CONSTRAINT quote_notes_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES quote_requests(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.quote_requests ADD CONSTRAINT quote_requests_service_type_id_fkey FOREIGN KEY (service_type_id) REFERENCES service_types(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.receipts ADD CONSTRAINT receipts_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.service_fields ADD CONSTRAINT service_fields_service_type_id_fkey FOREIGN KEY (service_type_id) REFERENCES service_types(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.service_pricing_rules ADD CONSTRAINT service_pricing_rules_service_type_id_fkey FOREIGN KEY (service_type_id) REFERENCES service_types(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_booking_activity_logs_booking_id ON public.booking_activity_logs USING btree (booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_activity_logs_created_at ON public.booking_activity_logs USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON public.bookings USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_date_status ON public.bookings USING btree (booking_date, status);
CREATE INDEX IF NOT EXISTS idx_bookings_service_type_id ON public.bookings USING btree (service_type_id);
CREATE INDEX IF NOT EXISTS idx_cleaner_app_responses_application ON public.cleaner_application_responses USING btree (application_id);
CREATE INDEX IF NOT EXISTS idx_contact_activity_logs_contact ON public.contact_activity_logs USING btree (contact_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_google_reviews_publish_time ON public.google_reviews USING btree (publish_time DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_service_type_id ON public.invoices USING btree (service_type_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quote_drafts_quote_id ON public.quote_drafts USING btree (quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_drafts_service_type_id ON public.quote_drafts USING btree (service_type_id);
CREATE INDEX IF NOT EXISTS idx_quote_requests_service_type_id ON public.quote_requests USING btree (service_type_id);
CREATE INDEX IF NOT EXISTS idx_service_fields_service_type ON public.service_fields USING btree (service_type_id, display_order);
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_confirmed_booking_slot ON public.bookings USING btree (booking_date, time_slot) WHERE (status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'completed'::text]));
CREATE UNIQUE INDEX IF NOT EXISTS receipts_invoice_unique ON public.receipts USING btree (invoice_id);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_reviews_booking ON public.reviews USING btree (booking_id);

-- ------------------------------------------------------------
-- 4. Functions and stored procedures
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_recent_submission(p_email text, p_table text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  recent boolean;
BEGIN
  IF p_table = 'bookings' THEN
    SELECT EXISTS(
      SELECT 1 FROM public.bookings
      WHERE email = p_email AND created_at > now() - interval '60 seconds'
    ) INTO recent;
  ELSIF p_table = 'quote_requests' THEN
    SELECT EXISTS(
      SELECT 1 FROM public.quote_requests
      WHERE email = p_email AND created_at > now() - interval '60 seconds'
    ) INTO recent;
  ELSIF p_table = 'contact_submissions' THEN
    SELECT EXISTS(
      SELECT 1 FROM public.contact_submissions
      WHERE email = p_email AND created_at > now() - interval '60 seconds'
    ) INTO recent;
  ELSE
    recent := false;
  END IF;
  RETURN recent;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_slot_overlap(p_date date, p_time_slot text, p_exclude_booking uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  proposed tsrange := public.parse_time_slot(p_time_slot);
  conflict_count int;
BEGIN
  IF proposed IS NULL THEN
    RETURN false;
  END IF;

  SELECT count(*)
    INTO conflict_count
    FROM bookings b
   WHERE b.booking_date = p_date
     AND b.status IN ('pending', 'confirmed', 'completed')
     AND (p_exclude_booking IS NULL OR b.id <> p_exclude_booking)
     AND public.parse_time_slot(b.time_slot) IS NOT NULL
     AND public.parse_time_slot(b.time_slot) && proposed;

  RETURN conflict_count > 0;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_old_records(p_days integer DEFAULT 90, p_dry_run boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cutoff timestamptz := now() - make_interval(days => GREATEST(p_days, 1));
  v_notifications integer := 0;
  v_booking_logs integer := 0;
  v_contact_logs integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED: Sign in required.';
  END IF;
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED: Only admins can run cleanup.';
  END IF;

  IF p_dry_run THEN
    SELECT count(*) INTO v_notifications FROM public.notifications WHERE created_at < v_cutoff;
    SELECT count(*) INTO v_booking_logs FROM public.booking_activity_logs WHERE created_at < v_cutoff;
    SELECT count(*) INTO v_contact_logs FROM public.contact_activity_logs WHERE created_at < v_cutoff;
  ELSE
    WITH d AS (DELETE FROM public.notifications WHERE created_at < v_cutoff RETURNING 1)
      SELECT count(*) INTO v_notifications FROM d;
    WITH d AS (DELETE FROM public.booking_activity_logs WHERE created_at < v_cutoff RETURNING 1)
      SELECT count(*) INTO v_booking_logs FROM d;
    WITH d AS (DELETE FROM public.contact_activity_logs WHERE created_at < v_cutoff RETURNING 1)
      SELECT count(*) INTO v_contact_logs FROM d;
  END IF;

  RETURN jsonb_build_object(
    'dry_run', p_dry_run,
    'cutoff', v_cutoff,
    'days', GREATEST(p_days, 1),
    'notifications', v_notifications,
    'booking_activity_logs', v_booking_logs,
    'contact_activity_logs', v_contact_logs
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.confirm_invoice_payment(p_invoice_id uuid, p_amount numeric, p_method text, p_reference text DEFAULT NULL::text, p_payment_date date DEFAULT CURRENT_DATE)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  inv public.invoices%ROWTYPE;
  v_new_paid numeric;
  v_status text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED: Sign in required.';
  END IF;
  IF NOT (
    has_role(auth.uid(),'admin'::app_role)
    OR has_permission(auth.uid(),'can_manage_invoices')
    OR has_permission(auth.uid(),'can_manage_payment')
    OR has_permission(auth.uid(),'can_manage_bookings')
  ) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED: You need Finance or Operations permission to record payments.';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT: Amount must be greater than zero.';
  END IF;

  SELECT * INTO inv FROM public.invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVOICE_NOT_FOUND';
  END IF;

  v_new_paid := round(coalesce(inv.amount_paid, 0) + p_amount, 2);
  v_status := CASE
    WHEN v_new_paid >= coalesce(inv.total_amount, 0) AND coalesce(inv.total_amount,0) > 0 THEN 'paid'
    WHEN v_new_paid > 0 THEN 'partial'
    ELSE 'unpaid'
  END;

  UPDATE public.invoices SET
    amount_paid = v_new_paid,
    payment_method = p_method,
    payment_date = p_payment_date,
    payment_reference = NULLIF(p_reference, ''),
    payment_status = v_status,
    paid_at = CASE WHEN v_status = 'paid' THEN now() ELSE paid_at END,
    updated_at = now()
  WHERE id = p_invoice_id;

  IF v_status = 'paid' THEN
    PERFORM public.create_receipt(p_invoice_id);
  END IF;

  RETURN jsonb_build_object(
    'id', p_invoice_id,
    'payment_status', v_status,
    'amount_paid', v_new_paid
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.convert_quote_to_booking(p_quote_id uuid, p_booking_date date, p_time_slot text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  existing_booking bookings%ROWTYPE;
  q  quote_requests%ROWTYPE;
  d  quote_drafts%ROWTYPE;
  new_id uuid;
  v_line_items jsonb := '[]'::jsonb;
  v_subtotal numeric := 0;
  v_tax numeric := 0;
  v_total numeric := 0;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_permission(auth.uid(), 'can_manage_quotes')) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED: You need Manage Quotes permission to convert this quote.';
  END IF;

  SELECT * INTO existing_booking FROM bookings WHERE quote_id = p_quote_id;
  IF FOUND THEN
    RETURN to_jsonb(existing_booking);
  END IF;

  SELECT * INTO q FROM quote_requests WHERE id = p_quote_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote not found';
  END IF;

  SELECT * INTO d FROM quote_drafts WHERE quote_id = p_quote_id;
  IF FOUND THEN
    v_line_items := COALESCE(d.line_items, '[]'::jsonb);
    v_subtotal   := COALESCE((d.breakdown->>'subtotal')::numeric, 0);
    v_tax        := COALESCE((d.breakdown->>'tax_amount')::numeric, 0);
    v_total      := COALESCE((d.breakdown->>'total')::numeric, 0);
  END IF;

  INSERT INTO bookings (
    id, quote_id, service_type_id, service_type,
    name, email, phone, address,
    booking_date, time_slot,
    notes, consent_given,
    property_type, square_footage, bedrooms, bathrooms,
    frequency, floor_type, condition_level,
    is_empty_property, has_pets, pet_count, entry_codes,
    selected_addons, custom_fields,
    line_items, subtotal, tax_amount, total_amount, total_price,
    source, status, created_at
  ) VALUES (
    gen_random_uuid(), q.id, q.service_type_id, q.service_type,
    COALESCE(NULLIF(q.name, ''), 'Customer'),
    COALESCE(NULLIF(q.email, ''), ''),
    q.phone,
    COALESCE(NULLIF(q.address, ''), 'Address on file'),
    p_booking_date, p_time_slot,
    q.description, COALESCE(q.consent_given, false),
    q.property_type, q.square_footage, q.bedrooms, q.bathrooms,
    q.frequency, q.floor_type, q.condition_level,
    COALESCE(q.is_empty_property, false), COALESCE(q.has_pets, false), q.pet_count, q.entry_codes,
    COALESCE(q.selected_addons, '[]'::jsonb), COALESCE(q.custom_fields, '{}'::jsonb),
    v_line_items, v_subtotal, v_tax, v_total, v_total,
    'quote', 'pending', now()
  )
  RETURNING id INTO new_id;

  UPDATE quote_requests SET status = 'converted', updated_at = now() WHERE id = p_quote_id;

  RETURN (SELECT to_jsonb(b) FROM bookings b WHERE id = new_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_invoice_from_booking(p_booking_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  existing_invoice invoices%ROWTYPE;
  booking_record   bookings%ROWTYPE;
  new_invoice_id   uuid;
  v_tax_rate       numeric := 0;
  v_subtotal       numeric := 0;
  v_total          numeric := 0;
  v_li_total       numeric := 0;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_permission(auth.uid(), 'can_manage_invoices')) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED: You need Manage Invoices permission to generate invoices.';
  END IF;

  SELECT * INTO existing_invoice FROM invoices WHERE booking_id = p_booking_id;
  IF FOUND THEN
    RETURN to_jsonb(existing_invoice);
  END IF;

  SELECT * INTO booking_record FROM bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  SELECT COALESCE(NULLIF(setting_value, '')::numeric, 0)
    INTO v_tax_rate
    FROM site_settings
   WHERE setting_key = 'tax_rate'
   LIMIT 1;
  IF v_tax_rate IS NULL THEN v_tax_rate := 0; END IF;

  -- Compute fallback total from line_items
  SELECT COALESCE(SUM(
    COALESCE((li->>'total_price')::numeric,
             (COALESCE((li->>'quantity')::numeric, 1) * COALESCE((li->>'unit_price')::numeric, (li->>'price')::numeric, 0)))
  ), 0)
  INTO v_li_total
  FROM jsonb_array_elements(COALESCE(booking_record.line_items, '[]'::jsonb)) li;

  v_subtotal := COALESCE(NULLIF(booking_record.subtotal, 0), NULLIF(booking_record.total_price, 0), v_li_total, 0);
  v_total    := COALESCE(NULLIF(booking_record.total_amount, 0), NULLIF(booking_record.total_price, 0), v_li_total, 0);

  INSERT INTO invoices (
    id, booking_id, quote_id,
    customer_name, customer_email, address,
    line_items, services,
    subtotal, tax, tax_amount, tax_rate, total, total_amount,
    payment_status,
    issued_date, due_date, created_at
  )
  VALUES (
    gen_random_uuid(),
    booking_record.id,
    booking_record.quote_id,
    COALESCE(booking_record.name, 'Customer'),
    COALESCE(booking_record.email, ''),
    booking_record.address,
    COALESCE(booking_record.line_items, '[]'::jsonb),
    COALESCE(booking_record.line_items, '[]'::jsonb),
    v_subtotal,
    COALESCE(booking_record.tax_amount, 0),
    COALESCE(booking_record.tax_amount, 0),
    v_tax_rate,
    v_total,
    v_total,
    'unpaid',
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '7 days',
    now()
  )
  RETURNING id INTO new_invoice_id;

  RETURN (SELECT to_jsonb(i) FROM invoices i WHERE id = new_invoice_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_receipt(p_invoice_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  existing_receipt receipts%ROWTYPE;
  invoice_record   invoices%ROWTYPE;
  new_receipt_id   uuid;
BEGIN
  SELECT * INTO existing_receipt FROM receipts WHERE invoice_id = p_invoice_id;
  IF FOUND THEN
    RETURN to_jsonb(existing_receipt);
  END IF;

  SELECT * INTO invoice_record FROM invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  INSERT INTO receipts (id, receipt_number, invoice_id, payment_date, amount_paid, created_at)
  VALUES (gen_random_uuid(), generate_receipt_number(), invoice_record.id, now(), invoice_record.total, now())
  RETURNING id INTO new_receipt_id;

  RETURN (SELECT to_jsonb(r) FROM receipts r WHERE id = new_receipt_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_booking_date_not_past()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.booking_date < CURRENT_DATE THEN
      RAISE EXCEPTION 'BACKDATING_NOT_ALLOWED: Bookings cannot be scheduled in the past.';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.booking_date IS DISTINCT FROM OLD.booking_date
       AND NEW.booking_date < CURRENT_DATE THEN
      RAISE EXCEPTION 'BACKDATING_NOT_ALLOWED: Bookings cannot be rescheduled to a past date.';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_invoice_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    NEW.invoice_number := 'BR-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.invoice_number_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_receipt_number()
 RETURNS text
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
  SELECT 'BR-RC-' || to_char(now(),'YYYY') || '-' ||
         lpad(nextval('public.receipt_number_seq')::text, 4, '0');
$function$;

CREATE OR REPLACE FUNCTION public.get_admin_display_names(_user_ids uuid[])
 RETURNS TABLE(user_id uuid, display_name text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Any authenticated staff can resolve admin display names.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
    SELECT u.id AS user_id,
           COALESCE(
             NULLIF(u.raw_user_meta_data ->> 'full_name', ''),
             NULLIF(u.email, ''),
             'Admin user'
           )::text AS display_name
      FROM auth.users u
     WHERE u.id = ANY(_user_ids);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_booked_slots(p_date date)
 RETURNS TABLE(time_slot text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT b.time_slot
  FROM public.bookings b
  WHERE b.booking_date = p_date
    AND b.status IN ('pending', 'confirmed', 'completed');
$function$;

CREATE OR REPLACE FUNCTION public.get_public_stats()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'completed_bookings', (SELECT count(*) FROM bookings WHERE status = 'completed'),
    'unique_customers', (SELECT count(DISTINCT lower(trim(email))) FROM bookings WHERE status = 'completed' AND email IS NOT NULL AND email <> ''),
    'avg_rating', COALESCE((SELECT round(avg(rating)::numeric, 1) FROM reviews WHERE is_public = true), 0),
    'public_reviews', (SELECT count(*) FROM reviews WHERE is_public = true)
  );
$function$;

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _key text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND (role = 'admin' OR (permissions ->> _key)::boolean = true)
  )
$function$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$function$;

CREATE OR REPLACE FUNCTION public.log_contact_activity(p_contact_id uuid, p_action text, p_previous_status text DEFAULT NULL::text, p_new_status text DEFAULT NULL::text, p_notes text DEFAULT NULL::text, p_details text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role) OR has_role(auth.uid(),'staff'::app_role) OR has_permission(auth.uid(),'can_manage_messages')) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;
  INSERT INTO public.contact_activity_logs(contact_id, actor_id, action, previous_status, new_status, notes, details)
  VALUES (p_contact_id, auth.uid(), p_action, p_previous_status, p_new_status, p_notes, p_details)
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.mark_invoice_paid(p_invoice_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  updated_invoice invoices%ROWTYPE;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_permission(auth.uid(), 'can_manage_invoices')) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED: You need Manage Invoices permission to mark invoices as paid.';
  END IF;

  UPDATE invoices
     SET payment_status = 'paid',
         paid_at = now()
   WHERE id = p_invoice_id
  RETURNING * INTO updated_invoice;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  PERFORM public.create_receipt(updated_invoice.id);

  RETURN to_jsonb(updated_invoice);
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_admins_on_submission()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_type text;
  v_ref_type text;
  v_message text;
BEGIN
  IF TG_TABLE_NAME = 'bookings' THEN
    v_type := 'booking'; v_ref_type := 'booking';
    v_message := 'New booking from ' || COALESCE(NEW.name, 'Unknown')
                 || COALESCE(' for ' || NULLIF(btrim(NEW.service_type), ''), '');
  ELSIF TG_TABLE_NAME = 'quote_requests' THEN
    v_type := 'quote'; v_ref_type := 'quote';
    v_message := 'New quote request from ' || COALESCE(NEW.name, 'Unknown');
  ELSIF TG_TABLE_NAME = 'contact_submissions' THEN
    v_type := 'contact'; v_ref_type := 'contact';
    v_message := 'New contact from ' || COALESCE(NEW.name, 'Unknown');
  ELSIF TG_TABLE_NAME = 'cleaner_applications' THEN
    v_type := 'cleaner_application'; v_ref_type := 'cleaner_application';
    v_message := 'New cleaner application from ' || COALESCE(NEW.full_name, 'Unknown');
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (type, message, reference_id, reference_type, user_id)
  VALUES (v_type, v_message, NEW.id, v_ref_type, NULL);

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.parse_time_slot(p_slot text)
 RETURNS tsrange
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  s text := trim(coalesce(p_slot, ''));
  parts text[];
  start_t time;
  end_t   time;
  base date := DATE '2000-01-01';
BEGIN
  IF s = '' THEN RETURN NULL; END IF;
  IF position(' - ' in s) > 0 OR position('-' in s) > 0 THEN
    parts := regexp_split_to_array(s, '\s*-\s*');
    IF array_length(parts, 1) = 2 THEN
      BEGIN
        start_t := parts[1]::time;
        end_t   := parts[2]::time;
      EXCEPTION WHEN OTHERS THEN RETURN NULL;
      END;
      RETURN tsrange(base + start_t, base + end_t, '[)');
    END IF;
  END IF;
  BEGIN
    start_t := s::time;
    RETURN tsrange(base + start_t, base + start_t + INTERVAL '1 hour', '[)');
  EXCEPTION WHEN OTHERS THEN RETURN NULL;
  END;
END;
$function$;

CREATE OR REPLACE FUNCTION public.submit_review(p_booking_id uuid, p_email text, p_rating integer, p_comment text, p_name text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  b bookings%ROWTYPE;
  new_id uuid;
BEGIN
  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'INVALID_RATING';
  END IF;

  SELECT * INTO b FROM bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOOKING_NOT_FOUND';
  END IF;

  IF lower(trim(b.email)) <> lower(trim(coalesce(p_email, ''))) THEN
    RAISE EXCEPTION 'EMAIL_MISMATCH';
  END IF;

  IF b.status <> 'completed' THEN
    RAISE EXCEPTION 'BOOKING_NOT_COMPLETED';
  END IF;

  INSERT INTO reviews (booking_id, customer_name, rating, comment, is_public)
  VALUES (p_booking_id, COALESCE(NULLIF(trim(p_name), ''), b.name, 'Customer'), p_rating, NULLIF(trim(p_comment), ''), false)
  ON CONFLICT (booking_id) DO UPDATE
    SET rating = EXCLUDED.rating,
        comment = EXCLUDED.comment,
        customer_name = EXCLUDED.customer_name
  RETURNING id INTO new_id;

  RETURN jsonb_build_object('id', new_id, 'ok', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- ------------------------------------------------------------
-- 5. Triggers
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_enforce_booking_date_not_past ON public.bookings;
CREATE TRIGGER trg_enforce_booking_date_not_past BEFORE INSERT OR UPDATE OF booking_date ON public.bookings FOR EACH ROW EXECUTE FUNCTION enforce_booking_date_not_past();
DROP TRIGGER IF EXISTS trg_notify_new_booking ON public.bookings;
CREATE TRIGGER trg_notify_new_booking AFTER INSERT ON public.bookings FOR EACH ROW EXECUTE FUNCTION notify_admins_on_submission();
DROP TRIGGER IF EXISTS trg_notify_new_application ON public.cleaner_applications;
CREATE TRIGGER trg_notify_new_application AFTER INSERT ON public.cleaner_applications FOR EACH ROW EXECUTE FUNCTION notify_admins_on_submission();
DROP TRIGGER IF EXISTS update_cleaner_applications_updated_at ON public.cleaner_applications;
CREATE TRIGGER update_cleaner_applications_updated_at BEFORE UPDATE ON public.cleaner_applications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_condition_settings_updated ON public.condition_settings;
CREATE TRIGGER trg_condition_settings_updated BEFORE UPDATE ON public.condition_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_notify_new_contact ON public.contact_submissions;
CREATE TRIGGER trg_notify_new_contact AFTER INSERT ON public.contact_submissions FOR EACH ROW EXECUTE FUNCTION notify_admins_on_submission();
DROP TRIGGER IF EXISTS update_contact_submissions_updated_at ON public.contact_submissions;
CREATE TRIGGER update_contact_submissions_updated_at BEFORE UPDATE ON public.contact_submissions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_google_reviews_updated_at ON public.google_reviews;
CREATE TRIGGER update_google_reviews_updated_at BEFORE UPDATE ON public.google_reviews FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS set_invoice_number ON public.invoices;
CREATE TRIGGER set_invoice_number BEFORE INSERT ON public.invoices FOR EACH ROW EXECUTE FUNCTION generate_invoice_number();
DROP TRIGGER IF EXISTS update_invoices_updated_at ON public.invoices;
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_page_content_updated_at ON public.page_content;
CREATE TRIGGER update_page_content_updated_at BEFORE UPDATE ON public.page_content FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_quote_drafts_updated_at ON public.quote_drafts;
CREATE TRIGGER update_quote_drafts_updated_at BEFORE UPDATE ON public.quote_drafts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_notify_new_quote ON public.quote_requests;
CREATE TRIGGER trg_notify_new_quote AFTER INSERT ON public.quote_requests FOR EACH ROW EXECUTE FUNCTION notify_admins_on_submission();
DROP TRIGGER IF EXISTS trg_service_areas_updated ON public.service_areas;
CREATE TRIGGER trg_service_areas_updated BEFORE UPDATE ON public.service_areas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_service_fields_updated_at ON public.service_fields;
CREATE TRIGGER update_service_fields_updated_at BEFORE UPDATE ON public.service_fields FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_pricing_rules_updated ON public.service_pricing_rules;
CREATE TRIGGER trg_pricing_rules_updated BEFORE UPDATE ON public.service_pricing_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_service_types_updated ON public.service_types;
CREATE TRIGGER trg_service_types_updated BEFORE UPDATE ON public.service_types FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_services_updated_at ON public.services;
CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_site_settings_updated_at ON public.site_settings;
CREATE TRIGGER update_site_settings_updated_at BEFORE UPDATE ON public.site_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_social_links_updated_at ON public.social_links;
CREATE TRIGGER update_social_links_updated_at BEFORE UPDATE ON public.social_links FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_testimonials_updated_at ON public.testimonials;
CREATE TRIGGER update_testimonials_updated_at BEFORE UPDATE ON public.testimonials FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------
-- 6. Access permissions and row-level security
-- ------------------------------------------------------------
ALTER TABLE public.availability_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branding_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cleaner_application_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cleaner_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.condition_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homepage_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permission_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_multipliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;


GRANT USAGE, SELECT ON SEQUENCE public.invoice_number_seq TO authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.receipt_number_seq TO authenticated, service_role;

DROP POLICY IF EXISTS "Admins can manage availability" ON public.availability_settings;
CREATE POLICY "Admins can manage availability" ON public.availability_settings AS PERMISSIVE FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Anyone can read availability" ON public.availability_settings;
CREATE POLICY "Anyone can read availability" ON public.availability_settings AS PERMISSIVE FOR SELECT TO public
  USING (true);
DROP POLICY IF EXISTS "Permitted users manage availability" ON public.availability_settings;
CREATE POLICY "Permitted users manage availability" ON public.availability_settings AS PERMISSIVE FOR ALL TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_edit_availability'::text)))
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_edit_availability'::text)));
DROP POLICY IF EXISTS "Admins can manage blocked dates" ON public.blocked_dates;
CREATE POLICY "Admins can manage blocked dates" ON public.blocked_dates AS PERMISSIVE FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Anyone can read blocked dates" ON public.blocked_dates;
CREATE POLICY "Anyone can read blocked dates" ON public.blocked_dates AS PERMISSIVE FOR SELECT TO public
  USING (true);
DROP POLICY IF EXISTS "Permitted users manage blocked dates" ON public.blocked_dates;
CREATE POLICY "Permitted users manage blocked dates" ON public.blocked_dates AS PERMISSIVE FOR ALL TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_edit_availability'::text)))
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_edit_availability'::text)));
DROP POLICY IF EXISTS "Admin roles can insert booking activity" ON public.booking_activity_logs;
CREATE POLICY "Admin roles can insert booking activity" ON public.booking_activity_logs AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'staff'::app_role) OR has_permission(auth.uid(), 'can_manage_bookings'::text)));
DROP POLICY IF EXISTS "Admin roles can view booking activity" ON public.booking_activity_logs;
CREATE POLICY "Admin roles can view booking activity" ON public.booking_activity_logs AS PERMISSIVE FOR SELECT TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'staff'::app_role) OR has_permission(auth.uid(), 'can_manage_bookings'::text)));
DROP POLICY IF EXISTS "Admins can delete bookings" ON public.bookings;
CREATE POLICY "Admins can delete bookings" ON public.bookings AS PERMISSIVE FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins can manage bookings" ON public.bookings;
CREATE POLICY "Admins can manage bookings" ON public.bookings AS PERMISSIVE FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins can view all bookings" ON public.bookings;
CREATE POLICY "Admins can view all bookings" ON public.bookings AS PERMISSIVE FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins have full control over bookings" ON public.bookings;
CREATE POLICY "Admins have full control over bookings" ON public.bookings AS PERMISSIVE FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Allow public booking creation" ON public.bookings;
CREATE POLICY "Allow public booking creation" ON public.bookings AS PERMISSIVE FOR INSERT TO anon, authenticated
  WITH CHECK (((name IS NOT NULL) AND ((length(btrim(name)) >= 1) AND (length(btrim(name)) <= 200)) AND (email IS NOT NULL) AND (length(email) <= 254) AND (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'::text) AND (status = 'pending'::text) AND ((payment_status IS NULL) OR (payment_status = 'unpaid'::text)) AND (paid_at IS NULL) AND (COALESCE(subtotal, (0)::numeric) >= (0)::numeric) AND (COALESCE(tax_amount, (0)::numeric) >= (0)::numeric) AND (COALESCE(total_amount, (0)::numeric) >= (0)::numeric) AND (COALESCE(total_price, (0)::numeric) >= (0)::numeric) AND (cancellation_reason IS NULL)));
DROP POLICY IF EXISTS "Permitted users can update bookings" ON public.bookings;
CREATE POLICY "Permitted users can update bookings" ON public.bookings AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_manage_bookings'::text)))
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_manage_bookings'::text)));
DROP POLICY IF EXISTS "Permitted users can view bookings" ON public.bookings;
CREATE POLICY "Permitted users can view bookings" ON public.bookings AS PERMISSIVE FOR SELECT TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_manage_bookings'::text)));
DROP POLICY IF EXISTS "Admins can manage branding" ON public.branding_settings;
CREATE POLICY "Admins can manage branding" ON public.branding_settings AS PERMISSIVE FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Anyone can read branding" ON public.branding_settings;
CREATE POLICY "Anyone can read branding" ON public.branding_settings AS PERMISSIVE FOR SELECT TO public
  USING (true);
DROP POLICY IF EXISTS "Staff can add application responses" ON public.cleaner_application_responses;
CREATE POLICY "Staff can add application responses" ON public.cleaner_application_responses AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_manage_applications'::text)));
DROP POLICY IF EXISTS "Staff can delete application responses" ON public.cleaner_application_responses;
CREATE POLICY "Staff can delete application responses" ON public.cleaner_application_responses AS PERMISSIVE FOR DELETE TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_manage_applications'::text)));
DROP POLICY IF EXISTS "Staff can update application responses" ON public.cleaner_application_responses;
CREATE POLICY "Staff can update application responses" ON public.cleaner_application_responses AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_manage_applications'::text)));
DROP POLICY IF EXISTS "Staff can view application responses" ON public.cleaner_application_responses;
CREATE POLICY "Staff can view application responses" ON public.cleaner_application_responses AS PERMISSIVE FOR SELECT TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_manage_applications'::text)));
DROP POLICY IF EXISTS "Admins can delete cleaner applications" ON public.cleaner_applications;
CREATE POLICY "Admins can delete cleaner applications" ON public.cleaner_applications AS PERMISSIVE FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Anyone can submit cleaner applications" ON public.cleaner_applications;
CREATE POLICY "Anyone can submit cleaner applications" ON public.cleaner_applications AS PERMISSIVE FOR INSERT TO anon, authenticated
  WITH CHECK (((full_name IS NOT NULL) AND ((length(btrim(full_name)) >= 1) AND (length(btrim(full_name)) <= 200)) AND (email IS NOT NULL) AND (length(email) <= 254) AND (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'::text) AND (status = 'new'::text) AND (admin_notes IS NULL) AND (reviewed_by IS NULL) AND (reviewed_at IS NULL)));
DROP POLICY IF EXISTS "Permitted users can update cleaner applications" ON public.cleaner_applications;
CREATE POLICY "Permitted users can update cleaner applications" ON public.cleaner_applications AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_manage_applications'::text)))
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_manage_applications'::text)));
DROP POLICY IF EXISTS "Permitted users can view cleaner applications" ON public.cleaner_applications;
CREATE POLICY "Permitted users can view cleaner applications" ON public.cleaner_applications AS PERMISSIVE FOR SELECT TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_manage_applications'::text)));
DROP POLICY IF EXISTS "Admins manage conditions" ON public.condition_settings;
CREATE POLICY "Admins manage conditions" ON public.condition_settings AS PERMISSIVE FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Anyone can read conditions" ON public.condition_settings;
CREATE POLICY "Anyone can read conditions" ON public.condition_settings AS PERMISSIVE FOR SELECT TO public
  USING (true);
DROP POLICY IF EXISTS "Admin roles can insert contact activity" ON public.contact_activity_logs;
CREATE POLICY "Admin roles can insert contact activity" ON public.contact_activity_logs AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'staff'::app_role) OR has_permission(auth.uid(), 'can_manage_messages'::text)));
DROP POLICY IF EXISTS "Admin roles can view contact activity" ON public.contact_activity_logs;
CREATE POLICY "Admin roles can view contact activity" ON public.contact_activity_logs AS PERMISSIVE FOR SELECT TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'staff'::app_role) OR has_permission(auth.uid(), 'can_manage_messages'::text)));
DROP POLICY IF EXISTS "Admins can delete submissions" ON public.contact_submissions;
CREATE POLICY "Admins can delete submissions" ON public.contact_submissions AS PERMISSIVE FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins can update submissions" ON public.contact_submissions;
CREATE POLICY "Admins can update submissions" ON public.contact_submissions AS PERMISSIVE FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins can view submissions" ON public.contact_submissions;
CREATE POLICY "Admins can view submissions" ON public.contact_submissions AS PERMISSIVE FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Permitted users can update contact_submissions" ON public.contact_submissions;
CREATE POLICY "Permitted users can update contact_submissions" ON public.contact_submissions AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_manage_messages'::text)))
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_manage_messages'::text)));
DROP POLICY IF EXISTS "Permitted users can view contact_submissions" ON public.contact_submissions;
CREATE POLICY "Permitted users can view contact_submissions" ON public.contact_submissions AS PERMISSIVE FOR SELECT TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_manage_messages'::text)));
DROP POLICY IF EXISTS "Public can submit contact form" ON public.contact_submissions;
CREATE POLICY "Public can submit contact form" ON public.contact_submissions AS PERMISSIVE FOR INSERT TO anon, authenticated
  WITH CHECK (((name IS NOT NULL) AND ((length(btrim(name)) >= 1) AND (length(btrim(name)) <= 200)) AND (email IS NOT NULL) AND (length(email) <= 254) AND (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'::text) AND (message IS NOT NULL) AND ((length(message) >= 1) AND (length(message) <= 5000)) AND (status = 'pending'::text) AND (admin_notes IS NULL)));
DROP POLICY IF EXISTS "Admins manage FAQs" ON public.faqs;
CREATE POLICY "Admins manage FAQs" ON public.faqs AS PERMISSIVE FOR ALL TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_manage_settings'::text)))
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_manage_settings'::text)));
DROP POLICY IF EXISTS "Public can read FAQs" ON public.faqs;
CREATE POLICY "Public can read FAQs" ON public.faqs AS PERMISSIVE FOR SELECT TO public
  USING (true);
DROP POLICY IF EXISTS "Admins can manage gallery" ON public.gallery;
CREATE POLICY "Admins can manage gallery" ON public.gallery AS PERMISSIVE FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins can read all gallery" ON public.gallery;
CREATE POLICY "Admins can read all gallery" ON public.gallery AS PERMISSIVE FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Anyone can view active gallery images" ON public.gallery;
CREATE POLICY "Anyone can view active gallery images" ON public.gallery AS PERMISSIVE FOR SELECT TO public
  USING ((is_active = true));
DROP POLICY IF EXISTS "Permitted users can manage gallery" ON public.gallery;
CREATE POLICY "Permitted users can manage gallery" ON public.gallery AS PERMISSIVE FOR ALL TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_manage_gallery'::text)))
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_manage_gallery'::text)));
DROP POLICY IF EXISTS "Anyone can read google reviews" ON public.google_reviews;
CREATE POLICY "Anyone can read google reviews" ON public.google_reviews AS PERMISSIVE FOR SELECT TO public
  USING (true);
DROP POLICY IF EXISTS "Admins can manage homepage images" ON public.homepage_images;
CREATE POLICY "Admins can manage homepage images" ON public.homepage_images AS PERMISSIVE FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Anyone can view homepage images" ON public.homepage_images;
CREATE POLICY "Anyone can view homepage images" ON public.homepage_images AS PERMISSIVE FOR SELECT TO public
  USING (true);
DROP POLICY IF EXISTS "Admin only invoices" ON public.invoices;
CREATE POLICY "Admin only invoices" ON public.invoices AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::app_role)))));
DROP POLICY IF EXISTS "Admin roles can insert invoices" ON public.invoices;
CREATE POLICY "Admin roles can insert invoices" ON public.invoices AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)));
DROP POLICY IF EXISTS "Admin roles can update invoices" ON public.invoices;
CREATE POLICY "Admin roles can update invoices" ON public.invoices AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)));
DROP POLICY IF EXISTS "Admin roles can view invoices" ON public.invoices;
CREATE POLICY "Admin roles can view invoices" ON public.invoices AS PERMISSIVE FOR SELECT TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'staff'::app_role)));
DROP POLICY IF EXISTS "Admins can delete invoices" ON public.invoices;
CREATE POLICY "Admins can delete invoices" ON public.invoices AS PERMISSIVE FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Operations can view linked invoices" ON public.invoices;
CREATE POLICY "Operations can view linked invoices" ON public.invoices AS PERMISSIVE FOR SELECT TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_manage_invoices'::text) OR has_permission(auth.uid(), 'can_manage_bookings'::text) OR has_permission(auth.uid(), 'can_manage_payment'::text)));
DROP POLICY IF EXISTS "Admin roles can update notifications" ON public.notifications;
CREATE POLICY "Admin roles can update notifications" ON public.notifications AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'staff'::app_role)));
DROP POLICY IF EXISTS "Admin roles can view all notifications" ON public.notifications;
CREATE POLICY "Admin roles can view all notifications" ON public.notifications AS PERMISSIVE FOR SELECT TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'staff'::app_role)));
DROP POLICY IF EXISTS "Admins can insert notifications" ON public.notifications;
CREATE POLICY "Admins can insert notifications" ON public.notifications AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'staff'::app_role)));
DROP POLICY IF EXISTS "Admins can manage page content" ON public.page_content;
CREATE POLICY "Admins can manage page content" ON public.page_content AS PERMISSIVE FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Anyone can read page content" ON public.page_content;
CREATE POLICY "Anyone can read page content" ON public.page_content AS PERMISSIVE FOR SELECT TO public
  USING (true);
DROP POLICY IF EXISTS "Admins manage registry" ON public.permission_registry;
CREATE POLICY "Admins manage registry" ON public.permission_registry AS PERMISSIVE FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Staff can read registry" ON public.permission_registry;
CREATE POLICY "Staff can read registry" ON public.permission_registry AS PERMISSIVE FOR SELECT TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'staff'::app_role)));
DROP POLICY IF EXISTS "Admins have full access to pricing_multipliers" ON public.pricing_multipliers;
CREATE POLICY "Admins have full access to pricing_multipliers" ON public.pricing_multipliers AS PERMISSIVE FOR ALL TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_edit_pricing'::text)));
DROP POLICY IF EXISTS "Public can read active multipliers" ON public.pricing_multipliers;
CREATE POLICY "Public can read active multipliers" ON public.pricing_multipliers AS PERMISSIVE FOR SELECT TO public
  USING ((is_active = true));
DROP POLICY IF EXISTS "Admins can manage quote drafts" ON public.quote_drafts;
CREATE POLICY "Admins can manage quote drafts" ON public.quote_drafts AS PERMISSIVE FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Managers can manage quote drafts" ON public.quote_drafts;
CREATE POLICY "Managers can manage quote drafts" ON public.quote_drafts AS PERMISSIVE FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role));
DROP POLICY IF EXISTS "Staff can manage quote drafts" ON public.quote_drafts;
CREATE POLICY "Staff can manage quote drafts" ON public.quote_drafts AS PERMISSIVE FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'staff'::app_role))
  WITH CHECK (has_role(auth.uid(), 'staff'::app_role));
DROP POLICY IF EXISTS "Admins can manage quote notes" ON public.quote_notes;
CREATE POLICY "Admins can manage quote notes" ON public.quote_notes AS PERMISSIVE FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Manager can manage quote notes" ON public.quote_notes;
CREATE POLICY "Manager can manage quote notes" ON public.quote_notes AS PERMISSIVE FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role));
DROP POLICY IF EXISTS "Staff can manage quote notes" ON public.quote_notes;
CREATE POLICY "Staff can manage quote notes" ON public.quote_notes AS PERMISSIVE FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'staff'::app_role))
  WITH CHECK (has_role(auth.uid(), 'staff'::app_role));
DROP POLICY IF EXISTS "Admin can view all quotes" ON public.quote_requests;
CREATE POLICY "Admin can view all quotes" ON public.quote_requests AS PERMISSIVE FOR SELECT TO authenticated
  USING ((has_permission(auth.uid(), 'can_manage_quotes'::text) OR has_role(auth.uid(), 'admin'::app_role)));
DROP POLICY IF EXISTS "Admins can delete quotes" ON public.quote_requests;
CREATE POLICY "Admins can delete quotes" ON public.quote_requests AS PERMISSIVE FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins can manage quotes" ON public.quote_requests;
CREATE POLICY "Admins can manage quotes" ON public.quote_requests AS PERMISSIVE FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins can view all quotes" ON public.quote_requests;
CREATE POLICY "Admins can view all quotes" ON public.quote_requests AS PERMISSIVE FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Permitted users can update quotes" ON public.quote_requests;
CREATE POLICY "Permitted users can update quotes" ON public.quote_requests AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_manage_quotes'::text)))
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_manage_quotes'::text)));
DROP POLICY IF EXISTS "Public can submit quotes" ON public.quote_requests;
CREATE POLICY "Public can submit quotes" ON public.quote_requests AS PERMISSIVE FOR INSERT TO anon, authenticated
  WITH CHECK (((name IS NOT NULL) AND ((length(btrim(name)) >= 1) AND (length(btrim(name)) <= 200)) AND (email IS NOT NULL) AND (length(email) <= 254) AND (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'::text) AND (status = 'requested'::text) AND (close_reason IS NULL)));
DROP POLICY IF EXISTS "Admin only receipts" ON public.receipts;
CREATE POLICY "Admin only receipts" ON public.receipts AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::app_role)))));
DROP POLICY IF EXISTS "Admins can manage receipts" ON public.receipts;
CREATE POLICY "Admins can manage receipts" ON public.receipts AS PERMISSIVE FOR ALL TO public
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Block all non-admin access" ON public.receipts;
CREATE POLICY "Block all non-admin access" ON public.receipts AS PERMISSIVE FOR SELECT TO public
  USING (false);
DROP POLICY IF EXISTS "Admins manage reviews" ON public.reviews;
CREATE POLICY "Admins manage reviews" ON public.reviews AS PERMISSIVE FOR ALL TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_manage_testimonials'::text)))
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_manage_testimonials'::text)));
DROP POLICY IF EXISTS "Public can read public reviews" ON public.reviews;
CREATE POLICY "Public can read public reviews" ON public.reviews AS PERMISSIVE FOR SELECT TO public
  USING ((is_public = true));
DROP POLICY IF EXISTS "Admins manage service areas" ON public.service_areas;
CREATE POLICY "Admins manage service areas" ON public.service_areas AS PERMISSIVE FOR ALL TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_manage_settings'::text)))
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_manage_settings'::text)));
DROP POLICY IF EXISTS "Public can read active service areas" ON public.service_areas;
CREATE POLICY "Public can read active service areas" ON public.service_areas AS PERMISSIVE FOR SELECT TO public
  USING ((is_active = true));
DROP POLICY IF EXISTS "Admins manage service fields" ON public.service_fields;
CREATE POLICY "Admins manage service fields" ON public.service_fields AS PERMISSIVE FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Allow public read service fields" ON public.service_fields;
CREATE POLICY "Allow public read service fields" ON public.service_fields AS PERMISSIVE FOR SELECT TO public
  USING (true);
DROP POLICY IF EXISTS "Allow read service fields" ON public.service_fields;
CREATE POLICY "Allow read service fields" ON public.service_fields AS PERMISSIVE FOR SELECT TO public
  USING (true);
DROP POLICY IF EXISTS "Anyone can read service fields" ON public.service_fields;
CREATE POLICY "Anyone can read service fields" ON public.service_fields AS PERMISSIVE FOR SELECT TO public
  USING (true);
DROP POLICY IF EXISTS "Admins manage pricing rules" ON public.service_pricing_rules;
CREATE POLICY "Admins manage pricing rules" ON public.service_pricing_rules AS PERMISSIVE FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Allow public read pricing rules" ON public.service_pricing_rules;
CREATE POLICY "Allow public read pricing rules" ON public.service_pricing_rules AS PERMISSIVE FOR SELECT TO public
  USING (true);
DROP POLICY IF EXISTS "Allow read pricing rules" ON public.service_pricing_rules;
CREATE POLICY "Allow read pricing rules" ON public.service_pricing_rules AS PERMISSIVE FOR SELECT TO public
  USING (true);
DROP POLICY IF EXISTS "Anyone can read pricing rules" ON public.service_pricing_rules;
CREATE POLICY "Anyone can read pricing rules" ON public.service_pricing_rules AS PERMISSIVE FOR SELECT TO public
  USING (true);
DROP POLICY IF EXISTS "Block public insert pricing rules" ON public.service_pricing_rules;
CREATE POLICY "Block public insert pricing rules" ON public.service_pricing_rules AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (false);
DROP POLICY IF EXISTS "Block public update pricing rules" ON public.service_pricing_rules;
CREATE POLICY "Block public update pricing rules" ON public.service_pricing_rules AS PERMISSIVE FOR UPDATE TO public
  USING (false);
DROP POLICY IF EXISTS "Admins manage service types" ON public.service_types;
CREATE POLICY "Admins manage service types" ON public.service_types AS PERMISSIVE FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Allow public read service types" ON public.service_types;
CREATE POLICY "Allow public read service types" ON public.service_types AS PERMISSIVE FOR SELECT TO public
  USING (true);
DROP POLICY IF EXISTS "Allow read service types" ON public.service_types;
CREATE POLICY "Allow read service types" ON public.service_types AS PERMISSIVE FOR SELECT TO public
  USING (true);
DROP POLICY IF EXISTS "Anyone can read service types" ON public.service_types;
CREATE POLICY "Anyone can read service types" ON public.service_types AS PERMISSIVE FOR SELECT TO public
  USING (true);
DROP POLICY IF EXISTS "Block public insert service types" ON public.service_types;
CREATE POLICY "Block public insert service types" ON public.service_types AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (false);
DROP POLICY IF EXISTS "Block public update service types" ON public.service_types;
CREATE POLICY "Block public update service types" ON public.service_types AS PERMISSIVE FOR UPDATE TO public
  USING (false);
DROP POLICY IF EXISTS "Admins can manage services" ON public.services;
CREATE POLICY "Admins can manage services" ON public.services AS PERMISSIVE FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins can read all services" ON public.services;
CREATE POLICY "Admins can read all services" ON public.services AS PERMISSIVE FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Anyone can read active services" ON public.services;
CREATE POLICY "Anyone can read active services" ON public.services AS PERMISSIVE FOR SELECT TO public
  USING ((is_active = true));
DROP POLICY IF EXISTS "Admins can manage settings" ON public.site_settings;
CREATE POLICY "Admins can manage settings" ON public.site_settings AS PERMISSIVE FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Anyone can read settings" ON public.site_settings;
CREATE POLICY "Anyone can read settings" ON public.site_settings AS PERMISSIVE FOR SELECT TO public
  USING (true);
DROP POLICY IF EXISTS "Permitted users can manage site_settings" ON public.site_settings;
CREATE POLICY "Permitted users can manage site_settings" ON public.site_settings AS PERMISSIVE FOR ALL TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_manage_settings'::text)))
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_manage_settings'::text)));
DROP POLICY IF EXISTS "Admins read all socials" ON public.social_links;
CREATE POLICY "Admins read all socials" ON public.social_links AS PERMISSIVE FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Permitted users manage socials" ON public.social_links;
CREATE POLICY "Permitted users manage socials" ON public.social_links AS PERMISSIVE FOR ALL TO authenticated
  USING (has_permission(auth.uid(), 'can_manage_socials'::text))
  WITH CHECK (has_permission(auth.uid(), 'can_manage_socials'::text));
DROP POLICY IF EXISTS "Public read active socials" ON public.social_links;
CREATE POLICY "Public read active socials" ON public.social_links AS PERMISSIVE FOR SELECT TO public
  USING ((is_active = true));
DROP POLICY IF EXISTS "Admins can manage testimonials" ON public.testimonials;
CREATE POLICY "Admins can manage testimonials" ON public.testimonials AS PERMISSIVE FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins can read all testimonials" ON public.testimonials;
CREATE POLICY "Admins can read all testimonials" ON public.testimonials AS PERMISSIVE FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Anyone can read active testimonials" ON public.testimonials;
CREATE POLICY "Anyone can read active testimonials" ON public.testimonials AS PERMISSIVE FOR SELECT TO public
  USING ((is_active = true));
DROP POLICY IF EXISTS "Permitted users can manage testimonials" ON public.testimonials;
CREATE POLICY "Permitted users can manage testimonials" ON public.testimonials AS PERMISSIVE FOR ALL TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_manage_testimonials'::text)))
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_manage_testimonials'::text)));
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can manage roles" ON public.user_roles AS PERMISSIVE FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Admins can view all roles" ON public.user_roles AS PERMISSIVE FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Users can read their own role" ON public.user_roles;
CREATE POLICY "Users can read their own role" ON public.user_roles AS PERMISSIVE FOR SELECT TO authenticated
  USING ((auth.uid() = user_id));

-- Execute permissions on functions (anon only where intentionally public)
GRANT EXECUTE ON FUNCTION public.check_recent_submission(p_email text, p_table text) TO anon;
GRANT EXECUTE ON FUNCTION public.check_recent_submission(p_email text, p_table text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_recent_submission(p_email text, p_table text) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_slot_overlap(p_date date, p_time_slot text, p_exclude_booking uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.check_slot_overlap(p_date date, p_time_slot text, p_exclude_booking uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_slot_overlap(p_date date, p_time_slot text, p_exclude_booking uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_old_records(p_days integer, p_dry_run boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_records(p_days integer, p_dry_run boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.confirm_invoice_payment(p_invoice_id uuid, p_amount numeric, p_method text, p_reference text, p_payment_date date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_invoice_payment(p_invoice_id uuid, p_amount numeric, p_method text, p_reference text, p_payment_date date) TO service_role;
GRANT EXECUTE ON FUNCTION public.convert_quote_to_booking(p_quote_id uuid, p_booking_date date, p_time_slot text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.convert_quote_to_booking(p_quote_id uuid, p_booking_date date, p_time_slot text) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_invoice_from_booking(p_booking_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_invoice_from_booking(p_booking_id uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_receipt(p_invoice_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_receipt(p_invoice_id uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.enforce_booking_date_not_past() TO anon;
GRANT EXECUTE ON FUNCTION public.enforce_booking_date_not_past() TO authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_booking_date_not_past() TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_invoice_number() TO anon;
GRANT EXECUTE ON FUNCTION public.generate_invoice_number() TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_invoice_number() TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_receipt_number() TO anon;
GRANT EXECUTE ON FUNCTION public.generate_receipt_number() TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_receipt_number() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_display_names(_user_ids uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_display_names(_user_ids uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_booked_slots(p_date date) TO anon;
GRANT EXECUTE ON FUNCTION public.get_booked_slots(p_date date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_booked_slots(p_date date) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_public_stats() TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_stats() TO service_role;
GRANT EXECUTE ON FUNCTION public.has_permission(_user_id uuid, _key text) TO anon;
GRANT EXECUTE ON FUNCTION public.has_permission(_user_id uuid, _key text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(_user_id uuid, _key text) TO service_role;
GRANT EXECUTE ON FUNCTION public.has_role(_user_id uuid, _role app_role) TO anon;
GRANT EXECUTE ON FUNCTION public.has_role(_user_id uuid, _role app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(_user_id uuid, _role app_role) TO service_role;
GRANT EXECUTE ON FUNCTION public.log_contact_activity(p_contact_id uuid, p_action text, p_previous_status text, p_new_status text, p_notes text, p_details text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_contact_activity(p_contact_id uuid, p_action text, p_previous_status text, p_new_status text, p_notes text, p_details text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_invoice_paid(p_invoice_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_invoice_paid(p_invoice_id uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.notify_admins_on_submission() TO service_role;
GRANT EXECUTE ON FUNCTION public.parse_time_slot(p_slot text) TO anon;
GRANT EXECUTE ON FUNCTION public.parse_time_slot(p_slot text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.parse_time_slot(p_slot text) TO service_role;
GRANT EXECUTE ON FUNCTION public.submit_review(p_booking_id uuid, p_email text, p_rating integer, p_comment text, p_name text) TO anon;
GRANT EXECUTE ON FUNCTION public.submit_review(p_booking_id uuid, p_email text, p_rating integer, p_comment text, p_name text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_review(p_booking_id uuid, p_email text, p_rating integer, p_comment text, p_name text) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO anon;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO service_role;

-- ------------------------------------------------------------
-- 7. File storage buckets and their access rules
-- ------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('cleaner-resumes', 'cleaner-resumes', false, NULL, NULL)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('quote-attachments', 'quote-attachments', false, NULL, NULL)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('site-images', 'site-images', false, NULL, NULL)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Admins can delete site images" ON storage.objects;
CREATE POLICY "Admins can delete site images" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated
  USING (((bucket_id = 'site-images'::text) AND has_role(auth.uid(), 'admin'::app_role)));
DROP POLICY IF EXISTS "Admins can upload site images" ON storage.objects;
CREATE POLICY "Admins can upload site images" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((bucket_id = 'site-images'::text) AND has_role(auth.uid(), 'admin'::app_role)));
DROP POLICY IF EXISTS "Anyone can upload a cleaner resume" ON storage.objects;
CREATE POLICY "Anyone can upload a cleaner resume" ON storage.objects AS PERMISSIVE FOR INSERT TO anon, authenticated
  WITH CHECK (((bucket_id = 'cleaner-resumes'::text) AND ((storage.foldername(name))[1] = 'applications'::text) AND (array_length(storage.foldername(name), 1) = 1) AND (length(name) <= 200)));
DROP POLICY IF EXISTS "Anyone can upload quote attachments" ON storage.objects;
CREATE POLICY "Anyone can upload quote attachments" ON storage.objects AS PERMISSIVE FOR INSERT TO anon, authenticated
  WITH CHECK ((bucket_id = 'quote-attachments'::text));
DROP POLICY IF EXISTS "Public can upload quote attachments" ON storage.objects;
CREATE POLICY "Public can upload quote attachments" ON storage.objects AS PERMISSIVE FOR INSERT TO anon, authenticated
  WITH CHECK ((bucket_id = 'quote-attachments'::text));
DROP POLICY IF EXISTS "Staff can delete cleaner resumes" ON storage.objects;
CREATE POLICY "Staff can delete cleaner resumes" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated
  USING (((bucket_id = 'cleaner-resumes'::text) AND (has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_manage_applications'::text))));
DROP POLICY IF EXISTS "Staff can delete quote attachments" ON storage.objects;
CREATE POLICY "Staff can delete quote attachments" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated
  USING (((bucket_id = 'quote-attachments'::text) AND (has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_manage_quotes'::text))));
DROP POLICY IF EXISTS "Staff can read cleaner resumes" ON storage.objects;
CREATE POLICY "Staff can read cleaner resumes" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated
  USING (((bucket_id = 'cleaner-resumes'::text) AND (has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_manage_applications'::text))));
DROP POLICY IF EXISTS "Staff can read quote attachments" ON storage.objects;
CREATE POLICY "Staff can read quote attachments" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated
  USING (((bucket_id = 'quote-attachments'::text) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role))));
DROP POLICY IF EXISTS "Staff can view quote attachments" ON storage.objects;
CREATE POLICY "Staff can view quote attachments" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated
  USING (((bucket_id = 'quote-attachments'::text) AND (has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_manage_quotes'::text))));

-- ------------------------------------------------------------
-- 8. Live updates (realtime)
-- ------------------------------------------------------------
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.user_roles;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;
ALTER TABLE public.user_roles REPLICA IDENTITY FULL;

-- ------------------------------------------------------------
-- 9. Scheduled jobs
-- ------------------------------------------------------------
-- Daily Google review refresh. Replace <PROJECT-REF> and <ANON-KEY> with the
-- values of the database you are setting up, then this job runs every day at 03:00 UTC.
-- Requires the pg_cron and pg_net extensions (created in section 1).
DO $$ BEGIN
  PERFORM cron.unschedule('google-reviews-daily-sync');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'google-reviews-daily-sync',
  '0 3 * * *',
  $cronjob$
  SELECT net.http_post(
    url := 'https://<PROJECT-REF>.supabase.co/functions/v1/google-reviews-sync',
    headers := '{"Content-Type": "application/json", "apikey": "<ANON-KEY>"}'::jsonb,
    body := '{"action":"sync","cron":true}'::jsonb
  );
  $cronjob$
);

-- ------------------------------------------------------------
-- 10. Setup defaults (inserted only when missing)
-- ------------------------------------------------------------
-- availability_settings
INSERT INTO public.availability_settings (setting_key, setting_value) VALUES
  ('saturday_hours', '{"end": "17:00", "start": "08:00"}'::jsonb),
  ('time_slot_duration', '{"minutes": 120}'::jsonb),
  ('working_days', '{"days": [1, 2, 3, 4, 5, 6]}'::jsonb),
  ('working_hours', '{"end": "19:00", "start": "07:00"}'::jsonb)
ON CONFLICT (setting_key) DO NOTHING;

-- site_settings
INSERT INTO public.site_settings (setting_key, setting_value) VALUES
  ('about_mission_p1', 'At BlueRiver Services, we believe that a clean space is more than just tidy surfaces. It''s about creating environments where people feel comfortable, productive, and at ease. Founded with a simple vision of delivering reliable, high-quality cleaning services, we''ve grown into a trusted partner for homeowners and businesses alike.'),
  ('about_mission_p2', 'Our name reflects what we stand for: the steady flow of a blue river, consistent, refreshing, and dependable. We bring that same energy to every space we clean, from family homes to corporate offices. Our team is fully trained, insured, and committed to exceeding expectations on every visit.'),
  ('about_mission_title', 'Our Mission'),
  ('auto_approve_bookings', 'false'),
  ('booking_approval_mode', 'auto'),
  ('brand_color_hex', '#1E3A8A'),
  ('buffer_time_minutes', '30'),
  ('business_hours_mf', 'Monday to Friday 7:00 AM - 5:00 PM'),
  ('business_hours_sat', ''),
  ('business_hours_sun', ''),
  ('call_availability', '7:00 AM - 5:00 PM'),
  ('company_address', 'Bellevue, WA'),
  ('company_logo_url', ''),
  ('default_service_duration_minutes', '120'),
  ('email', 'info@blueriverservices.co'),
  ('footer_tagline', 'Professional cleaning services for homes and businesses across Washington State. Trusted by thousands.'),
  ('hero_headline', 'Reliable Cleaning Services You Can Trust'),
  ('hero_subheadline', 'From cozy homes to bustling offices, BlueRiver Services delivers spotless results with every visit. Serving communities across the United States.'),
  ('invoice_footer_note', ''),
  ('invoice_terms', ''),
  ('payment_methods', 'Pay via Zelle to info@blueriverservices.co. Cash also accepted on-site.'),
  ('phone', '(425) 369-7492'),
  ('phone_link', '+14253697492'),
  ('service_area', '14205 SE 36th ST, STE 100 Bellevue, WA 98006'),
  ('stats_clients', '2000+'),
  ('stats_rating', '5.0'),
  ('stats_satisfaction', '99%'),
  ('stats_years', '8+'),
  ('stripe_payment_link', ''),
  ('tax_rate', '2.5')
ON CONFLICT (setting_key) DO NOTHING;

-- branding_settings
INSERT INTO public.branding_settings (setting_key, setting_value) VALUES
  ('accent_color', '#f59e0b'),
  ('background_color', '#ffffff'),
  ('favicon_url', 'https://nraxnlalvrifektbbibd.supabase.co/storage/v1/object/public/site-images/branding/1778081063240-wdwo14e1hff.jpg'),
  ('font_family', 'Inter'),
  ('logo_size', 'large'),
  ('logo_url', 'https://nraxnlalvrifektbbibd.supabase.co/storage/v1/object/public/site-images/branding/1775675912562-f2kicnl8p14.png'),
  ('primary_color', '#1a73e8'),
  ('secondary_color', '#0097a7')
ON CONFLICT (setting_key) DO NOTHING;

-- permission_registry
INSERT INTO public.permission_registry (key, label, description) VALUES
  ('bundle.content', 'Content Bundle', 'FAQs, Reviews, Gallery, Site Content, Service Areas'),
  ('bundle.finance', 'Finance Bundle', 'Invoices, Payments, Pricing'),
  ('bundle.operations', 'Operations Bundle', 'Bookings, Quotes, Messages, Availability'),
  ('bundle.system_admin', 'System Admin Bundle', 'Business Rules, Socials, plus Operations + Finance + Content'),
  ('can_edit_availability', 'Edit Availability Settings', 'Edit availability settings'),
  ('can_edit_pricing', 'Edit Pricing', 'Change service prices and rules'),
  ('can_manage_applications', 'Manage Cleaner Applications', 'View, update, and triage cleaner job applications submitted via the public Become a Cleaner form.'),
  ('can_manage_bookings', 'Manage Bookings', 'Allows user to view, edit, and cancel customer bookings'),
  ('can_manage_business_rules', 'Manage Business Rules', 'Edit booking auto-approval and tax rate'),
  ('can_manage_gallery', 'Manage Gallery', 'View and manage gallery images'),
  ('can_manage_invoices', 'Manage Invoices', 'Generate, send, and mark invoices as paid'),
  ('can_manage_legal', 'Manage Legal Pages', 'Edit legal/policy content'),
  ('can_manage_messages', 'Manage Messages', 'View and manage contact submissions'),
  ('can_manage_payment', 'Manage Payment Settings', 'Edit payment methods (Cash, Zelle) and payout details'),
  ('can_manage_quotes', 'Manage Quotes', 'Allows user to view, edit, and cancel customer quotes'),
  ('can_manage_settings', 'Manage Settings', 'View and manage site settings'),
  ('can_manage_site_content', 'Manage Site Content', 'Edit homepage, about, footer copy and stats'),
  ('can_manage_socials', 'Manage Social Links', 'Add/edit/delete social media links'),
  ('can_manage_testimonials', 'Manage Testimonials', 'View and manage testimonials')
ON CONFLICT (key) DO NOTHING;

-- condition_settings
INSERT INTO public.condition_settings (name, surcharge_amount) VALUES
  ('Heavy', 50),
  ('Light', 10),
  ('Post-Construction', 100),
  ('Standard', 20)
ON CONFLICT (name) DO NOTHING;

-- homepage_images
INSERT INTO public.homepage_images (section_key, image_url, label) VALUES
  ('cta_banner', '', 'Call to Action Banner'),
  ('hero', 'https://nraxnlalvrifektbbibd.supabase.co/storage/v1/object/public/site-images/homepage/1776353730341-6dqd0xlwp2e.png', 'Hero Background Image')
ON CONFLICT (section_key) DO NOTHING;

COMMIT;

-- ============================================================
-- Done. Structure, security rules, storage, schedules and
-- setup defaults are all in place.
-- ============================================================
