
-- Bookings table
CREATE TABLE public.bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  address TEXT NOT NULL,
  service_type TEXT,
  booking_date DATE NOT NULL,
  time_slot TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  consent_given BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create bookings" ON public.bookings FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Admins can view all bookings" ON public.bookings FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage bookings" ON public.bookings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Quote requests table (separate from contact_submissions)
CREATE TABLE public.quote_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  service_type TEXT,
  description TEXT NOT NULL,
  preferred_contact TEXT DEFAULT 'email',
  attachment_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  consent_given BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.quote_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit quote requests" ON public.quote_requests FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Admins can view all quotes" ON public.quote_requests FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage quotes" ON public.quote_requests FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Availability settings (working days, hours, time slot duration)
CREATE TABLE public.availability_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.availability_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read availability" ON public.availability_settings FOR SELECT TO public USING (true);
CREATE POLICY "Admins can manage availability" ON public.availability_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Blocked dates
CREATE TABLE public.blocked_dates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  blocked_date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.blocked_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read blocked dates" ON public.blocked_dates FOR SELECT TO public USING (true);
CREATE POLICY "Admins can manage blocked dates" ON public.blocked_dates FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Insert default availability settings
INSERT INTO public.availability_settings (setting_key, setting_value) VALUES
  ('working_days', '{"days": [1, 2, 3, 4, 5, 6]}'),
  ('working_hours', '{"start": "07:00", "end": "19:00"}'),
  ('time_slot_duration', '{"minutes": 60}'),
  ('saturday_hours', '{"start": "08:00", "end": "17:00"}');

-- Enable realtime for bookings
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.quote_requests;
