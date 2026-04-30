UPDATE public.condition_settings SET name = 'Post-Construction' WHERE name = 'Post-Renovation';
UPDATE public.service_types  SET name  = 'Recurring Cleaning' WHERE name  = 'Reccuring Cleaning';
UPDATE public.services       SET title = 'Recurring Cleaning' WHERE title = 'Reccuring Cleaning';
UPDATE public.bookings       SET service_type = 'Recurring Cleaning' WHERE service_type = 'Reccuring Cleaning';
UPDATE public.quote_requests SET service_type = 'Recurring Cleaning' WHERE service_type = 'Reccuring Cleaning';
DELETE FROM public.service_pricing_rules
 WHERE category IN ('Bedroom','Bathroom','FullBath','HalfBath','Kitchen','LivingRoom','OfficeRoom')
   AND unit_price = 0;