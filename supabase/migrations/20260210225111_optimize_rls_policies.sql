
-- Optimize RLS: replace auth.uid() with (select auth.uid()) to avoid per-row re-evaluation
-- This is a Supabase-recommended performance fix

-- clients
DROP POLICY IF EXISTS "Clients can view own profile" ON public.clients;
CREATE POLICY "Clients can view own profile" ON public.clients
  FOR SELECT USING (auth_user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can read own client record" ON public.clients;
CREATE POLICY "Users can read own client record" ON public.clients
  FOR SELECT USING (auth_user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Admins can view all clients" ON public.clients;
CREATE POLICY "Admins can view all clients" ON public.clients
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.clients WHERE auth_user_id = (select auth.uid()) AND is_admin = true)
  );

-- campaigns
DROP POLICY IF EXISTS "Clients can view own campaigns" ON public.campaigns;
CREATE POLICY "Clients can view own campaigns" ON public.campaigns
  FOR SELECT USING (
    client_id IN (SELECT id FROM public.clients WHERE auth_user_id = (select auth.uid()))
  );

DROP POLICY IF EXISTS "Clients can create campaigns" ON public.campaigns;
CREATE POLICY "Clients can create campaigns" ON public.campaigns
  FOR INSERT WITH CHECK (
    client_id IN (SELECT id FROM public.clients WHERE auth_user_id = (select auth.uid()))
  );

DROP POLICY IF EXISTS "Admins can manage all campaigns" ON public.campaigns;
CREATE POLICY "Admins can manage all campaigns" ON public.campaigns
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.clients WHERE auth_user_id = (select auth.uid()) AND is_admin = true)
  );

-- ad_media
DROP POLICY IF EXISTS "Clients can view own media" ON public.ad_media;
CREATE POLICY "Clients can view own media" ON public.ad_media
  FOR SELECT USING (
    campaign_id IN (
      SELECT c.id FROM public.campaigns c
      JOIN public.clients cl ON c.client_id = cl.id
      WHERE cl.auth_user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Clients can upload media" ON public.ad_media;
CREATE POLICY "Clients can upload media" ON public.ad_media
  FOR INSERT WITH CHECK (
    campaign_id IN (
      SELECT c.id FROM public.campaigns c
      JOIN public.clients cl ON c.client_id = cl.id
      WHERE cl.auth_user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admins can manage all media" ON public.ad_media;
CREATE POLICY "Admins can manage all media" ON public.ad_media
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.clients WHERE auth_user_id = (select auth.uid()) AND is_admin = true)
  );

-- play_stats
DROP POLICY IF EXISTS "Clients can view own stats" ON public.play_stats;
CREATE POLICY "Clients can view own stats" ON public.play_stats
  FOR SELECT USING (
    campaign_id IN (
      SELECT c.id FROM public.campaigns c
      JOIN public.clients cl ON c.client_id = cl.id
      WHERE cl.auth_user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admins can manage all stats" ON public.play_stats;
CREATE POLICY "Admins can manage all stats" ON public.play_stats
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.clients WHERE auth_user_id = (select auth.uid()) AND is_admin = true)
  );

-- invoices
DROP POLICY IF EXISTS "Clients can view own invoices" ON public.invoices;
CREATE POLICY "Clients can view own invoices" ON public.invoices
  FOR SELECT USING (
    client_id IN (SELECT id FROM public.clients WHERE auth_user_id = (select auth.uid()))
  );

DROP POLICY IF EXISTS "Admins can manage all invoices" ON public.invoices;
CREATE POLICY "Admins can manage all invoices" ON public.invoices
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.clients WHERE auth_user_id = (select auth.uid()) AND is_admin = true)
  );

-- play_logs
DROP POLICY IF EXISTS "Admins manage play_logs" ON public.play_logs;
CREATE POLICY "Admins manage play_logs" ON public.play_logs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.clients WHERE auth_user_id = (select auth.uid()) AND is_admin = true)
  );

DROP POLICY IF EXISTS "Clients view own play_logs" ON public.play_logs;
CREATE POLICY "Clients view own play_logs" ON public.play_logs
  FOR SELECT USING (
    campaign_id IN (
      SELECT c.id FROM public.campaigns c
      JOIN public.clients cl ON c.client_id = cl.id
      WHERE cl.auth_user_id = (select auth.uid())
    )
  );

-- gps_logs
DROP POLICY IF EXISTS "Admins manage gps_tracks" ON public.gps_logs;
CREATE POLICY "Admins manage gps_logs" ON public.gps_logs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.clients WHERE auth_user_id = (select auth.uid()) AND is_admin = true)
  );

-- devices
DROP POLICY IF EXISTS "Admins manage devices" ON public.devices;
CREATE POLICY "Admins manage devices" ON public.devices
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.clients WHERE auth_user_id = (select auth.uid()) AND is_admin = true)
  );

-- device_groups: remove duplicate "Authenticated users" policy, keep only admin
DROP POLICY IF EXISTS "Authenticated users can manage device_groups" ON public.device_groups;
DROP POLICY IF EXISTS "Admins manage device_groups" ON public.device_groups;
CREATE POLICY "Admins manage device_groups" ON public.device_groups
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.clients WHERE auth_user_id = (select auth.uid()) AND is_admin = true)
  );
;
