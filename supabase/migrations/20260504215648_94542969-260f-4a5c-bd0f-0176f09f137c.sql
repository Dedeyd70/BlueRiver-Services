
CREATE TABLE IF NOT EXISTS public.contact_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL,
  actor_id uuid,
  action text NOT NULL,
  previous_status text,
  new_status text,
  notes text,
  details text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_activity_logs_contact ON public.contact_activity_logs(contact_id, created_at DESC);

ALTER TABLE public.contact_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin roles can view contact activity"
  ON public.contact_activity_logs FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role) OR has_role(auth.uid(),'staff'::app_role) OR has_permission(auth.uid(),'can_manage_messages'));

CREATE POLICY "Admin roles can insert contact activity"
  ON public.contact_activity_logs FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role) OR has_role(auth.uid(),'staff'::app_role) OR has_permission(auth.uid(),'can_manage_messages'));

CREATE OR REPLACE FUNCTION public.log_contact_activity(
  p_contact_id uuid,
  p_action text,
  p_previous_status text DEFAULT NULL,
  p_new_status text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_details text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

GRANT EXECUTE ON FUNCTION public.log_contact_activity(uuid,text,text,text,text,text) TO authenticated;

-- Backfill existing admin_notes into activity entries (best-effort)
INSERT INTO public.contact_activity_logs(contact_id, actor_id, action, notes, created_at)
SELECT cs.id, NULL, 'note', cs.admin_notes, cs.updated_at
  FROM public.contact_submissions cs
 WHERE cs.admin_notes IS NOT NULL AND length(trim(cs.admin_notes)) > 0
   AND NOT EXISTS (SELECT 1 FROM public.contact_activity_logs l WHERE l.contact_id = cs.id);
