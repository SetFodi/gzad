
-- Fix: The "Admins can view all clients" policy queries the clients table itself,
-- causing infinite recursion. Use auth.jwt() metadata instead to avoid self-reference.

-- First, drop the problematic admin policy
DROP POLICY IF EXISTS "Admins can view all clients" ON public.clients;

-- Recreate using a security definer function that bypasses RLS
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clients 
    WHERE auth_user_id = (select auth.uid()) 
    AND is_admin = true
  )
$$;

-- Now recreate the admin policy using the function
CREATE POLICY "Admins can view all clients" ON public.clients
  FOR ALL USING (public.is_admin());

-- Also fix all other admin policies that reference clients table (same recursion risk)
DROP POLICY IF EXISTS "Admins can manage all campaigns" ON public.campaigns;
CREATE POLICY "Admins can manage all campaigns" ON public.campaigns
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage all media" ON public.ad_media;
CREATE POLICY "Admins can manage all media" ON public.ad_media
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage all stats" ON public.play_stats;
CREATE POLICY "Admins can manage all stats" ON public.play_stats
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage all invoices" ON public.invoices;
CREATE POLICY "Admins can manage all invoices" ON public.invoices
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Admins manage play_logs" ON public.play_logs;
CREATE POLICY "Admins manage play_logs" ON public.play_logs
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Admins manage gps_logs" ON public.gps_logs;
CREATE POLICY "Admins manage gps_logs" ON public.gps_logs
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Admins manage devices" ON public.devices;
CREATE POLICY "Admins manage devices" ON public.devices
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Admins manage device_groups" ON public.device_groups;
CREATE POLICY "Admins manage device_groups" ON public.device_groups
  FOR ALL USING (public.is_admin());
;
