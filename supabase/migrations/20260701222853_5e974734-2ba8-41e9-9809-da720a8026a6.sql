-- Sync all RLS policies: dev -> remote (idempotent)
-- Enable RLS on all public tables that have policies

ALTER TABLE public.availability_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branding_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cleaner_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.condition_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery ENABLE ROW LEVEL SECURITY;
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

-- Recreate every policy (drop-if-exists + create)

DROP POLICY IF EXISTS "Admins can manage availability" ON public.availability_settings;
CREATE POLICY "Admins can manage availability" ON public.availability_settings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Anyone can read availability" ON public.availability_settings;
CREATE POLICY "Anyone can read availability" ON public.availability_settings FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS "Permitted users manage availability" ON public.availability_settings;
CREATE POLICY "Permitted users manage availability" ON public.availability_settings FOR ALL TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_edit_availability'::text)))
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_edit_availability'::text)));

DROP POLICY IF EXISTS "Admins can manage blocked dates" ON public.blocked_dates;
CREATE POLICY "Admins can manage blocked dates" ON public.blocked_dates FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Anyone can read blocked dates" ON public.blocked_dates;
CREATE POLICY "Anyone can read blocked dates" ON public.blocked_dates FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS "Permitted users manage blocked dates" ON public.blocked_dates;
CREATE POLICY "Permitted users manage blocked dates" ON public.blocked_dates FOR ALL TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_edit_availability'::text)))
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_edit_availability'::text)));

DROP POLICY IF EXISTS "Admin roles can insert booking activity" ON public.booking_activity_logs;
CREATE POLICY "Admin roles can insert booking activity" ON public.booking_activity_logs FOR INSERT TO authenticated
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'staff'::app_role) OR has_permission(auth.uid(), 'can_manage_bookings'::text)));

DROP POLICY IF EXISTS "Admin roles can view booking activity" ON public.booking_activity_logs;
CREATE POLICY "Admin roles can view booking activity" ON public.booking_activity_logs FOR SELECT TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'staff'::app_role) OR has_permission(auth.uid(), 'can_manage_bookings'::text)));

DROP POLICY IF EXISTS "Admins can delete bookings" ON public.bookings;
CREATE POLICY "Admins can delete bookings" ON public.bookings FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can manage bookings" ON public.bookings;
CREATE POLICY "Admins can manage bookings" ON public.bookings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can view all bookings" ON public.bookings;
CREATE POLICY "Admins can view all bookings" ON public.bookings FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins have full control over bookings" ON public.bookings;
CREATE POLICY "Admins have full control over bookings" ON public.bookings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Allow public booking creation" ON public.bookings;
CREATE POLICY "Allow public booking creation" ON public.bookings FOR INSERT TO anon, authenticated
  WITH CHECK (((name IS NOT NULL) AND ((length(btrim(name)) >= 1) AND (length(btrim(name)) <= 200)) AND (email IS NOT NULL) AND (length(email) <= 254) AND (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'::text)));

DROP POLICY IF EXISTS "Permitted users can update bookings" ON public.bookings;
CREATE POLICY "Permitted users can update bookings" ON public.bookings FOR UPDATE TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_manage_bookings'::text)))
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_manage_bookings'::text)));

DROP POLICY IF EXISTS "Permitted users can view bookings" ON public.bookings;
CREATE POLICY "Permitted users can view bookings" ON public.bookings FOR SELECT TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_manage_bookings'::text)));

DROP POLICY IF EXISTS "Admins can manage branding" ON public.branding_settings;
CREATE POLICY "Admins can manage branding" ON public.branding_settings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Anyone can read branding" ON public.branding_settings;
CREATE POLICY "Anyone can read branding" ON public.branding_settings FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS "Admins can delete cleaner applications" ON public.cleaner_applications;
CREATE POLICY "Admins can delete cleaner applications" ON public.cleaner_applications FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Anyone can submit cleaner applications" ON public.cleaner_applications;
CREATE POLICY "Anyone can submit cleaner applications" ON public.cleaner_applications FOR INSERT TO anon, authenticated
  WITH CHECK (((full_name IS NOT NULL) AND ((length(btrim(full_name)) >= 1) AND (length(btrim(full_name)) <= 200)) AND (email IS NOT NULL) AND (length(email) <= 254) AND (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'::text)));

DROP POLICY IF EXISTS "Permitted users can update cleaner applications" ON public.cleaner_applications;
CREATE POLICY "Permitted users can update cleaner applications" ON public.cleaner_applications FOR UPDATE TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_manage_applications'::text)))
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_manage_applications'::text)));

DROP POLICY IF EXISTS "Permitted users can view cleaner applications" ON public.cleaner_applications;
CREATE POLICY "Permitted users can view cleaner applications" ON public.cleaner_applications FOR SELECT TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_manage_applications'::text)));

DROP POLICY IF EXISTS "Admins manage conditions" ON public.condition_settings;
CREATE POLICY "Admins manage conditions" ON public.condition_settings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Anyone can read conditions" ON public.condition_settings;
CREATE POLICY "Anyone can read conditions" ON public.condition_settings FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS "Admin roles can insert contact activity" ON public.contact_activity_logs;
CREATE POLICY "Admin roles can insert contact activity" ON public.contact_activity_logs FOR INSERT TO authenticated
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'staff'::app_role) OR has_permission(auth.uid(), 'can_manage_messages'::text)));

DROP POLICY IF EXISTS "Admin roles can view contact activity" ON public.contact_activity_logs;
CREATE POLICY "Admin roles can view contact activity" ON public.contact_activity_logs FOR SELECT TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'staff'::app_role) OR has_permission(auth.uid(), 'can_manage_messages'::text)));

DROP POLICY IF EXISTS "Admins can delete submissions" ON public.contact_submissions;
CREATE POLICY "Admins can delete submissions" ON public.contact_submissions FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update submissions" ON public.contact_submissions;
CREATE POLICY "Admins can update submissions" ON public.contact_submissions FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can view submissions" ON public.contact_submissions;
CREATE POLICY "Admins can view submissions" ON public.contact_submissions FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Permitted users can update contact_submissions" ON public.contact_submissions;
CREATE POLICY "Permitted users can update contact_submissions" ON public.contact_submissions FOR UPDATE TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_manage_messages'::text)))
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_manage_messages'::text)));

DROP POLICY IF EXISTS "Permitted users can view contact_submissions" ON public.contact_submissions;
CREATE POLICY "Permitted users can view contact_submissions" ON public.contact_submissions FOR SELECT TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_manage_messages'::text)));

DROP POLICY IF EXISTS "Public can submit contact form" ON public.contact_submissions;
CREATE POLICY "Public can submit contact form" ON public.contact_submissions FOR INSERT TO anon, authenticated
  WITH CHECK (((name IS NOT NULL) AND ((length(btrim(name)) >= 1) AND (length(btrim(name)) <= 200)) AND (email IS NOT NULL) AND (length(email) <= 254) AND (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'::text) AND (message IS NOT NULL) AND ((length(message) >= 1) AND (length(message) <= 5000))));

DROP POLICY IF EXISTS "Admins manage FAQs" ON public.faqs;
CREATE POLICY "Admins manage FAQs" ON public.faqs FOR ALL TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_manage_settings'::text)))
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_manage_settings'::text)));

DROP POLICY IF EXISTS "Public can read FAQs" ON public.faqs;
CREATE POLICY "Public can read FAQs" ON public.faqs FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS "Admins can manage gallery" ON public.gallery;
CREATE POLICY "Admins can manage gallery" ON public.gallery FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can read all gallery" ON public.gallery;
CREATE POLICY "Admins can read all gallery" ON public.gallery FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Anyone can view active gallery images" ON public.gallery;
CREATE POLICY "Anyone can view active gallery images" ON public.gallery FOR SELECT TO public
  USING ((is_active = true));

DROP POLICY IF EXISTS "Permitted users can manage gallery" ON public.gallery;
CREATE POLICY "Permitted users can manage gallery" ON public.gallery FOR ALL TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_manage_gallery'::text)))
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_manage_gallery'::text)));

DROP POLICY IF EXISTS "Admins can manage homepage images" ON public.homepage_images;
CREATE POLICY "Admins can manage homepage images" ON public.homepage_images FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Anyone can view homepage images" ON public.homepage_images;
CREATE POLICY "Anyone can view homepage images" ON public.homepage_images FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS "Admin only invoices" ON public.invoices;
CREATE POLICY "Admin only invoices" ON public.invoices FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::app_role)))));

DROP POLICY IF EXISTS "Admin roles can insert invoices" ON public.invoices;
CREATE POLICY "Admin roles can insert invoices" ON public.invoices FOR INSERT TO authenticated
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)));

DROP POLICY IF EXISTS "Admin roles can update invoices" ON public.invoices;
CREATE POLICY "Admin roles can update invoices" ON public.invoices FOR UPDATE TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)));

DROP POLICY IF EXISTS "Admin roles can view invoices" ON public.invoices;
CREATE POLICY "Admin roles can view invoices" ON public.invoices FOR SELECT TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'staff'::app_role)));

DROP POLICY IF EXISTS "Admins can delete invoices" ON public.invoices;
CREATE POLICY "Admins can delete invoices" ON public.invoices FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Operations can view linked invoices" ON public.invoices;
CREATE POLICY "Operations can view linked invoices" ON public.invoices FOR SELECT TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_manage_invoices'::text) OR has_permission(auth.uid(), 'can_manage_bookings'::text) OR has_permission(auth.uid(), 'can_manage_payment'::text)));

DROP POLICY IF EXISTS "Admin roles can update notifications" ON public.notifications;
CREATE POLICY "Admin roles can update notifications" ON public.notifications FOR UPDATE TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'staff'::app_role)));

DROP POLICY IF EXISTS "Admin roles can view all notifications" ON public.notifications;
CREATE POLICY "Admin roles can view all notifications" ON public.notifications FOR SELECT TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'staff'::app_role)));

DROP POLICY IF EXISTS "Admins can insert notifications" ON public.notifications;
CREATE POLICY "Admins can insert notifications" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'staff'::app_role)));

DROP POLICY IF EXISTS "Admins can manage page content" ON public.page_content;
CREATE POLICY "Admins can manage page content" ON public.page_content FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Anyone can read page content" ON public.page_content;
CREATE POLICY "Anyone can read page content" ON public.page_content FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS "Admins manage registry" ON public.permission_registry;
CREATE POLICY "Admins manage registry" ON public.permission_registry FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated read registry" ON public.permission_registry;
CREATE POLICY "Authenticated read registry" ON public.permission_registry FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins have full access to pricing_multipliers" ON public.pricing_multipliers;
CREATE POLICY "Admins have full access to pricing_multipliers" ON public.pricing_multipliers FOR ALL TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_edit_pricing'::text)));

DROP POLICY IF EXISTS "Public can read active multipliers" ON public.pricing_multipliers;
CREATE POLICY "Public can read active multipliers" ON public.pricing_multipliers FOR SELECT TO public
  USING ((is_active = true));

DROP POLICY IF EXISTS "Admins can manage quote drafts" ON public.quote_drafts;
CREATE POLICY "Admins can manage quote drafts" ON public.quote_drafts FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Managers can manage quote drafts" ON public.quote_drafts;
CREATE POLICY "Managers can manage quote drafts" ON public.quote_drafts FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

DROP POLICY IF EXISTS "Staff can manage quote drafts" ON public.quote_drafts;
CREATE POLICY "Staff can manage quote drafts" ON public.quote_drafts FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'staff'::app_role))
  WITH CHECK (has_role(auth.uid(), 'staff'::app_role));

DROP POLICY IF EXISTS "Admins can manage quote notes" ON public.quote_notes;
CREATE POLICY "Admins can manage quote notes" ON public.quote_notes FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Manager can manage quote notes" ON public.quote_notes;
CREATE POLICY "Manager can manage quote notes" ON public.quote_notes FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

DROP POLICY IF EXISTS "Staff can manage quote notes" ON public.quote_notes;
CREATE POLICY "Staff can manage quote notes" ON public.quote_notes FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'staff'::app_role))
  WITH CHECK (has_role(auth.uid(), 'staff'::app_role));

DROP POLICY IF EXISTS "Admin can view all quotes" ON public.quote_requests;
CREATE POLICY "Admin can view all quotes" ON public.quote_requests FOR SELECT TO authenticated
  USING ((has_permission(auth.uid(), 'can_manage_quotes'::text) OR has_role(auth.uid(), 'admin'::app_role)));

DROP POLICY IF EXISTS "Admins can delete quotes" ON public.quote_requests;
CREATE POLICY "Admins can delete quotes" ON public.quote_requests FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can manage quotes" ON public.quote_requests;
CREATE POLICY "Admins can manage quotes" ON public.quote_requests FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can view all quotes" ON public.quote_requests;
CREATE POLICY "Admins can view all quotes" ON public.quote_requests FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Permitted users can update quotes" ON public.quote_requests;
CREATE POLICY "Permitted users can update quotes" ON public.quote_requests FOR UPDATE TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_manage_quotes'::text)))
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_manage_quotes'::text)));

DROP POLICY IF EXISTS "Public can submit quotes" ON public.quote_requests;
CREATE POLICY "Public can submit quotes" ON public.quote_requests FOR INSERT TO anon, authenticated
  WITH CHECK (((name IS NOT NULL) AND ((length(btrim(name)) >= 1) AND (length(btrim(name)) <= 200)) AND (email IS NOT NULL) AND (length(email) <= 254) AND (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'::text)));

DROP POLICY IF EXISTS "Admin only receipts" ON public.receipts;
CREATE POLICY "Admin only receipts" ON public.receipts FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::app_role)))));

DROP POLICY IF EXISTS "Admins can manage receipts" ON public.receipts;
CREATE POLICY "Admins can manage receipts" ON public.receipts FOR ALL TO public
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Block all non-admin access" ON public.receipts;
CREATE POLICY "Block all non-admin access" ON public.receipts FOR SELECT TO public
  USING (false);

DROP POLICY IF EXISTS "Admins manage reviews" ON public.reviews;
CREATE POLICY "Admins manage reviews" ON public.reviews FOR ALL TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_manage_testimonials'::text)))
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_manage_testimonials'::text)));

DROP POLICY IF EXISTS "Public can read public reviews" ON public.reviews;
CREATE POLICY "Public can read public reviews" ON public.reviews FOR SELECT TO public
  USING ((is_public = true));

DROP POLICY IF EXISTS "Admins manage service areas" ON public.service_areas;
CREATE POLICY "Admins manage service areas" ON public.service_areas FOR ALL TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_manage_settings'::text)))
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_manage_settings'::text)));

DROP POLICY IF EXISTS "Public can read active service areas" ON public.service_areas;
CREATE POLICY "Public can read active service areas" ON public.service_areas FOR SELECT TO public
  USING ((is_active = true));

DROP POLICY IF EXISTS "Admins manage service fields" ON public.service_fields;
CREATE POLICY "Admins manage service fields" ON public.service_fields FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Allow public read service fields" ON public.service_fields;
CREATE POLICY "Allow public read service fields" ON public.service_fields FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS "Allow read service fields" ON public.service_fields;
CREATE POLICY "Allow read service fields" ON public.service_fields FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS "Anyone can read service fields" ON public.service_fields;
CREATE POLICY "Anyone can read service fields" ON public.service_fields FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS "Admins manage pricing rules" ON public.service_pricing_rules;
CREATE POLICY "Admins manage pricing rules" ON public.service_pricing_rules FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Allow public read pricing rules" ON public.service_pricing_rules;
CREATE POLICY "Allow public read pricing rules" ON public.service_pricing_rules FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS "Allow read pricing rules" ON public.service_pricing_rules;
CREATE POLICY "Allow read pricing rules" ON public.service_pricing_rules FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS "Anyone can read pricing rules" ON public.service_pricing_rules;
CREATE POLICY "Anyone can read pricing rules" ON public.service_pricing_rules FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS "Block public insert pricing rules" ON public.service_pricing_rules;
CREATE POLICY "Block public insert pricing rules" ON public.service_pricing_rules FOR INSERT TO public
  WITH CHECK (false);

DROP POLICY IF EXISTS "Block public update pricing rules" ON public.service_pricing_rules;
CREATE POLICY "Block public update pricing rules" ON public.service_pricing_rules FOR UPDATE TO public
  USING (false);

DROP POLICY IF EXISTS "Admins manage service types" ON public.service_types;
CREATE POLICY "Admins manage service types" ON public.service_types FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Allow public read service types" ON public.service_types;
CREATE POLICY "Allow public read service types" ON public.service_types FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS "Allow read service types" ON public.service_types;
CREATE POLICY "Allow read service types" ON public.service_types FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS "Anyone can read service types" ON public.service_types;
CREATE POLICY "Anyone can read service types" ON public.service_types FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS "Block public insert service types" ON public.service_types;
CREATE POLICY "Block public insert service types" ON public.service_types FOR INSERT TO public
  WITH CHECK (false);

DROP POLICY IF EXISTS "Block public update service types" ON public.service_types;
CREATE POLICY "Block public update service types" ON public.service_types FOR UPDATE TO public
  USING (false);

DROP POLICY IF EXISTS "Admins can manage services" ON public.services;
CREATE POLICY "Admins can manage services" ON public.services FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can read all services" ON public.services;
CREATE POLICY "Admins can read all services" ON public.services FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Anyone can read active services" ON public.services;
CREATE POLICY "Anyone can read active services" ON public.services FOR SELECT TO public
  USING ((is_active = true));

DROP POLICY IF EXISTS "Admins can manage settings" ON public.site_settings;
CREATE POLICY "Admins can manage settings" ON public.site_settings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Anyone can read settings" ON public.site_settings;
CREATE POLICY "Anyone can read settings" ON public.site_settings FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS "Permitted users can manage site_settings" ON public.site_settings;
CREATE POLICY "Permitted users can manage site_settings" ON public.site_settings FOR ALL TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_manage_settings'::text)))
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_manage_settings'::text)));

DROP POLICY IF EXISTS "Admins read all socials" ON public.social_links;
CREATE POLICY "Admins read all socials" ON public.social_links FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Permitted users manage socials" ON public.social_links;
CREATE POLICY "Permitted users manage socials" ON public.social_links FOR ALL TO authenticated
  USING (has_permission(auth.uid(), 'can_manage_socials'::text))
  WITH CHECK (has_permission(auth.uid(), 'can_manage_socials'::text));

DROP POLICY IF EXISTS "Public read active socials" ON public.social_links;
CREATE POLICY "Public read active socials" ON public.social_links FOR SELECT TO public
  USING ((is_active = true));

DROP POLICY IF EXISTS "Admins can manage testimonials" ON public.testimonials;
CREATE POLICY "Admins can manage testimonials" ON public.testimonials FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can read all testimonials" ON public.testimonials;
CREATE POLICY "Admins can read all testimonials" ON public.testimonials FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Anyone can read active testimonials" ON public.testimonials;
CREATE POLICY "Anyone can read active testimonials" ON public.testimonials FOR SELECT TO public
  USING ((is_active = true));

DROP POLICY IF EXISTS "Permitted users can manage testimonials" ON public.testimonials;
CREATE POLICY "Permitted users can manage testimonials" ON public.testimonials FOR ALL TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_manage_testimonials'::text)))
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_manage_testimonials'::text)));

DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can read their own role" ON public.user_roles;
CREATE POLICY "Users can read their own role" ON public.user_roles FOR SELECT TO authenticated
  USING ((auth.uid() = user_id));