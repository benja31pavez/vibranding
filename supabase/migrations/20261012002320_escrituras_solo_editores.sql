-- =====================================================================
-- Fase 0 · 3/5 — Escrituras solo para editores de la agencia (no viewer)
-- =====================================================================
-- Problema (H10): las policies INSERT/UPDATE/DELETE de muchas tablas usaban
-- owns_client(client_id), que es "cualquier miembro de la org del cliente",
-- incluido el rol viewer (solo lectura). Pasan a can_edit_client(client_id)
-- = owner/admin/agent de la org del cliente. Las policies SELECT no cambian
-- (un viewer sigue leyendo).
--
-- Lista exacta (generada desde pg_policies de producción el 2026-10-06,
-- 86 policies con owns_client en escritura: estas 83 más las 3 de
-- deliverable_review_links que ya corrigió 20261012002300):
--   ad_insights_daily, attributions, bot_knowledge, client_leads,
--   client_tasks, conversation_outcomes, deliverable_comments,
--   deliverable_folders, deliverables, ig_comment_triggers, ig_dm_triggers,
--   instagram_audience_snapshots (insert/update), instagram_grid_versions,
--   instagram_highlights, instagram_post_comments, instagram_posts,
--   instagram_profiles, landing_contact_submissions (delete), landing_pages,
--   lead_meta, multilink_items, multilinks, objectives,
--   plan_template_seeds (insert/delete), post_insights_daily,
--   whatsapp_bot_rules, whatsapp_conversations, whatsapp_flow_runs,
--   whatsapp_messages.
-- Además, con is_org_member en escritura (mismo problema a nivel de org):
--   clients insert                → can_edit_org(org_id)
--   objective_templates ins/upd/del → can_edit_org(org_id)
--
-- No se tocan: la policy INSERT "client users comment own deliverables" de
-- deliverable_comments (el cliente comenta lo suyo) ni las escrituras con
-- service_role (crons, webhooks), que no pasan por RLS.
-- Impacto hoy: la org tiene un solo miembro (owner) → nadie pierde permisos.
-- Re-ejecutable (ALTER POLICY solo reemplaza expresiones). Si producción
-- tuviera una policy de escritura con owns_client que no está en esta lista,
-- el bloque final aborta la migración completa para revisarla a mano.
-- =====================================================================

-- ad_insights_daily
ALTER POLICY "ad_insights delete" ON public.ad_insights_daily USING (public.can_edit_client(client_id));
ALTER POLICY "ad_insights insert" ON public.ad_insights_daily WITH CHECK (public.can_edit_client(client_id));
ALTER POLICY "ad_insights update" ON public.ad_insights_daily USING (public.can_edit_client(client_id)) WITH CHECK (public.can_edit_client(client_id));

-- attributions
ALTER POLICY "attributions delete" ON public.attributions USING (public.can_edit_client(client_id));
ALTER POLICY "attributions insert" ON public.attributions WITH CHECK (public.can_edit_client(client_id));
ALTER POLICY "attributions update" ON public.attributions USING (public.can_edit_client(client_id)) WITH CHECK (public.can_edit_client(client_id));

-- bot_knowledge
ALTER POLICY "bot_knowledge delete" ON public.bot_knowledge USING (public.can_edit_client(client_id));
ALTER POLICY "bot_knowledge insert" ON public.bot_knowledge WITH CHECK (public.can_edit_client(client_id));
ALTER POLICY "bot_knowledge update" ON public.bot_knowledge USING (public.can_edit_client(client_id)) WITH CHECK (public.can_edit_client(client_id));

-- client_leads
ALTER POLICY "client_leads delete" ON public.client_leads USING (public.can_edit_client(client_id));
ALTER POLICY "client_leads insert" ON public.client_leads WITH CHECK (public.can_edit_client(client_id));
ALTER POLICY "client_leads update" ON public.client_leads USING (public.can_edit_client(client_id)) WITH CHECK (public.can_edit_client(client_id));

-- client_tasks
ALTER POLICY "del" ON public.client_tasks USING (public.can_edit_client(client_id));
ALTER POLICY "ins" ON public.client_tasks WITH CHECK (public.can_edit_client(client_id));
ALTER POLICY "upd" ON public.client_tasks USING (public.can_edit_client(client_id)) WITH CHECK (public.can_edit_client(client_id));

-- conversation_outcomes
ALTER POLICY "conversation_outcomes delete" ON public.conversation_outcomes USING (public.can_edit_client(client_id));
ALTER POLICY "conversation_outcomes insert" ON public.conversation_outcomes WITH CHECK (public.can_edit_client(client_id) AND marked_by = auth.uid());
ALTER POLICY "conversation_outcomes update" ON public.conversation_outcomes USING (public.can_edit_client(client_id)) WITH CHECK (public.can_edit_client(client_id));

-- deliverable_comments
ALTER POLICY "del" ON public.deliverable_comments USING (public.can_edit_client(client_id));
ALTER POLICY "ins" ON public.deliverable_comments WITH CHECK (public.can_edit_client(client_id));
ALTER POLICY "upd" ON public.deliverable_comments USING (public.can_edit_client(client_id)) WITH CHECK (public.can_edit_client(client_id));

-- deliverable_folders
ALTER POLICY "del" ON public.deliverable_folders USING (public.can_edit_client(client_id));
ALTER POLICY "ins" ON public.deliverable_folders WITH CHECK (public.can_edit_client(client_id));
ALTER POLICY "upd" ON public.deliverable_folders USING (public.can_edit_client(client_id)) WITH CHECK (public.can_edit_client(client_id));

-- deliverables
ALTER POLICY "del" ON public.deliverables USING (public.can_edit_client(client_id));
ALTER POLICY "ins" ON public.deliverables WITH CHECK (public.can_edit_client(client_id));
ALTER POLICY "upd" ON public.deliverables USING (public.can_edit_client(client_id)) WITH CHECK (public.can_edit_client(client_id));

-- ig_comment_triggers
ALTER POLICY "del" ON public.ig_comment_triggers USING (public.can_edit_client(client_id));
ALTER POLICY "ins" ON public.ig_comment_triggers WITH CHECK (public.can_edit_client(client_id));
ALTER POLICY "upd" ON public.ig_comment_triggers USING (public.can_edit_client(client_id)) WITH CHECK (public.can_edit_client(client_id));

-- ig_dm_triggers
ALTER POLICY "del" ON public.ig_dm_triggers USING (public.can_edit_client(client_id));
ALTER POLICY "ins" ON public.ig_dm_triggers WITH CHECK (public.can_edit_client(client_id));
ALTER POLICY "upd" ON public.ig_dm_triggers USING (public.can_edit_client(client_id)) WITH CHECK (public.can_edit_client(client_id));

-- instagram_audience_snapshots
ALTER POLICY "audience snapshots insert" ON public.instagram_audience_snapshots WITH CHECK (public.can_edit_client(client_id));
ALTER POLICY "audience snapshots update" ON public.instagram_audience_snapshots USING (public.can_edit_client(client_id)) WITH CHECK (public.can_edit_client(client_id));

-- instagram_grid_versions
ALTER POLICY "del" ON public.instagram_grid_versions USING (public.can_edit_client(client_id));
ALTER POLICY "ins" ON public.instagram_grid_versions WITH CHECK (public.can_edit_client(client_id));
ALTER POLICY "upd" ON public.instagram_grid_versions USING (public.can_edit_client(client_id)) WITH CHECK (public.can_edit_client(client_id));

-- instagram_highlights
ALTER POLICY "del" ON public.instagram_highlights USING (public.can_edit_client(client_id));
ALTER POLICY "ins" ON public.instagram_highlights WITH CHECK (public.can_edit_client(client_id));
ALTER POLICY "upd" ON public.instagram_highlights USING (public.can_edit_client(client_id)) WITH CHECK (public.can_edit_client(client_id));

-- instagram_post_comments
ALTER POLICY "del" ON public.instagram_post_comments USING (public.can_edit_client(client_id));
ALTER POLICY "ins" ON public.instagram_post_comments WITH CHECK (public.can_edit_client(client_id));
ALTER POLICY "upd" ON public.instagram_post_comments USING (public.can_edit_client(client_id)) WITH CHECK (public.can_edit_client(client_id));

-- instagram_posts
ALTER POLICY "del" ON public.instagram_posts USING (public.can_edit_client(client_id));
ALTER POLICY "ins" ON public.instagram_posts WITH CHECK (public.can_edit_client(client_id));
ALTER POLICY "upd" ON public.instagram_posts USING (public.can_edit_client(client_id)) WITH CHECK (public.can_edit_client(client_id));

-- instagram_profiles
ALTER POLICY "del" ON public.instagram_profiles USING (public.can_edit_client(client_id));
ALTER POLICY "ins" ON public.instagram_profiles WITH CHECK (public.can_edit_client(client_id));
ALTER POLICY "upd" ON public.instagram_profiles USING (public.can_edit_client(client_id)) WITH CHECK (public.can_edit_client(client_id));

-- landing_contact_submissions
ALTER POLICY "owner delete submissions" ON public.landing_contact_submissions USING (public.can_edit_client(client_id));

-- landing_pages
ALTER POLICY "landing_pages delete" ON public.landing_pages USING (public.can_edit_client(client_id));
ALTER POLICY "landing_pages insert" ON public.landing_pages WITH CHECK (public.can_edit_client(client_id));
ALTER POLICY "landing_pages update" ON public.landing_pages USING (public.can_edit_client(client_id)) WITH CHECK (public.can_edit_client(client_id));

-- lead_meta
ALTER POLICY "lead_meta delete" ON public.lead_meta USING (public.can_edit_client(client_id));
ALTER POLICY "lead_meta insert" ON public.lead_meta WITH CHECK (public.can_edit_client(client_id));
ALTER POLICY "lead_meta update" ON public.lead_meta USING (public.can_edit_client(client_id)) WITH CHECK (public.can_edit_client(client_id));

-- multilink_items
ALTER POLICY "multilink_items delete" ON public.multilink_items USING (public.can_edit_client(client_id));
ALTER POLICY "multilink_items insert" ON public.multilink_items WITH CHECK (public.can_edit_client(client_id));
ALTER POLICY "multilink_items update" ON public.multilink_items USING (public.can_edit_client(client_id)) WITH CHECK (public.can_edit_client(client_id));

-- multilinks
ALTER POLICY "multilinks delete" ON public.multilinks USING (public.can_edit_client(client_id));
ALTER POLICY "multilinks insert" ON public.multilinks WITH CHECK (public.can_edit_client(client_id));
ALTER POLICY "multilinks update" ON public.multilinks USING (public.can_edit_client(client_id)) WITH CHECK (public.can_edit_client(client_id));

-- objectives
ALTER POLICY "del" ON public.objectives USING (public.can_edit_client(client_id));
ALTER POLICY "ins" ON public.objectives WITH CHECK (public.can_edit_client(client_id));
ALTER POLICY "upd" ON public.objectives USING (public.can_edit_client(client_id)) WITH CHECK (public.can_edit_client(client_id));

-- plan_template_seeds
ALTER POLICY "plan_template_seeds delete" ON public.plan_template_seeds USING (public.can_edit_client(client_id));
ALTER POLICY "plan_template_seeds insert" ON public.plan_template_seeds WITH CHECK (public.can_edit_client(client_id));

-- post_insights_daily
ALTER POLICY "post_insights delete" ON public.post_insights_daily USING (public.can_edit_client(client_id));
ALTER POLICY "post_insights insert" ON public.post_insights_daily WITH CHECK (public.can_edit_client(client_id));
ALTER POLICY "post_insights update" ON public.post_insights_daily USING (public.can_edit_client(client_id)) WITH CHECK (public.can_edit_client(client_id));

-- whatsapp_bot_rules
ALTER POLICY "del" ON public.whatsapp_bot_rules USING (public.can_edit_client(client_id));
ALTER POLICY "ins" ON public.whatsapp_bot_rules WITH CHECK (public.can_edit_client(client_id));
ALTER POLICY "upd" ON public.whatsapp_bot_rules USING (public.can_edit_client(client_id)) WITH CHECK (public.can_edit_client(client_id));

-- whatsapp_conversations
ALTER POLICY "del" ON public.whatsapp_conversations USING (public.can_edit_client(client_id));
ALTER POLICY "ins" ON public.whatsapp_conversations WITH CHECK (public.can_edit_client(client_id));
ALTER POLICY "upd" ON public.whatsapp_conversations USING (public.can_edit_client(client_id)) WITH CHECK (public.can_edit_client(client_id));

-- whatsapp_flow_runs
ALTER POLICY "flow_runs delete" ON public.whatsapp_flow_runs USING (public.can_edit_client(client_id));
ALTER POLICY "flow_runs insert" ON public.whatsapp_flow_runs WITH CHECK (public.can_edit_client(client_id));
ALTER POLICY "flow_runs update" ON public.whatsapp_flow_runs USING (public.can_edit_client(client_id)) WITH CHECK (public.can_edit_client(client_id));

-- whatsapp_messages
ALTER POLICY "del" ON public.whatsapp_messages USING (public.can_edit_client(client_id));
ALTER POLICY "ins" ON public.whatsapp_messages WITH CHECK (public.can_edit_client(client_id));
ALTER POLICY "upd" ON public.whatsapp_messages USING (public.can_edit_client(client_id)) WITH CHECK (public.can_edit_client(client_id));

-- clients / objective_templates (nivel org)
ALTER POLICY "clients insert" ON public.clients
  WITH CHECK (user_id = auth.uid() AND public.can_edit_org(org_id));
ALTER POLICY "org members create objective templates" ON public.objective_templates
  WITH CHECK (public.can_edit_org(org_id));
ALTER POLICY "org members update objective templates" ON public.objective_templates
  USING (public.can_edit_org(org_id)) WITH CHECK (public.can_edit_org(org_id));
ALTER POLICY "org members delete objective templates" ON public.objective_templates
  USING (public.can_edit_org(org_id));

-- Verificación: ninguna policy de escritura en public sigue usando owns_client
-- ni is_org_member.
DO $$
DECLARE _left text;
BEGIN
  SELECT string_agg(format('%s.%s (%s)', tablename, policyname, cmd), ', ')
    INTO _left
    FROM pg_policies
   WHERE schemaname = 'public'
     AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
     AND (coalesce(qual, '') || coalesce(with_check, '')) ~ '(owns_client|is_org_member)\(';
  IF _left IS NOT NULL THEN
    RAISE EXCEPTION 'Quedan policies de escritura sin migrar: %', _left;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
