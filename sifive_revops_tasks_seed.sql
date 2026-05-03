-- ============================================================================
-- SEED: RevOps + Lead Scoring build tasks for the SiFive project
-- ============================================================================
-- Logs every task completed during the RevOps Intelligence Platform build.
-- All tasks land with status='done' and are linked to the SiFive project.
--
-- HOW TO RUN:
--   1. Open Supabase Studio → SQL Editor
--   2. Paste this whole file
--   3. Hit Run
--
-- The first SELECT auto-resolves your SiFive project + user_id from the
-- project record, so you don't have to paste UUIDs by hand.
--
-- IDEMPOTENT: re-running this won't duplicate tasks (uses a unique title
-- prefix check). Safe to run multiple times.
-- ============================================================================

DO $$
DECLARE
    v_project_id UUID;
    v_user_id UUID;
    v_tasks JSONB := $tasks$
[
  {"phase": "1. Foundation", "title": "Build 4 custom Salesforce objects (Account_Signal__c, Lead_Quarantine__c, Integration_Status__c, Hypercare_Check__c)", "description": "10/12/9/8 fields respectively. Master-detail child for signals; standalone for the others.", "priority": "high"},
  {"phase": "1. Foundation", "title": "Build ~78 custom fields across Account, Lead, Contact, Opportunity, Campaign", "description": "Engagement_Score, Tier, ABM_Status, Lead_Grade, Composite_Score, Match_Confidence, etc. Plus all dedup/integration ID fields.", "priority": "high"},
  {"phase": "1. Foundation", "title": "Build 3 Custom Metadata Types with 24 default records", "description": "Scoring_Weight__mdt (9), Score_Threshold__mdt (12), Tier_Definition__mdt (3). Defines tunable scoring without code changes.", "priority": "high"},
  {"phase": "1. Foundation", "title": "Build ScoringConfig Apex helper class", "description": "CMDT selector with per-transaction caching + test seam.", "priority": "high"},
  {"phase": "1. Foundation", "title": "Build AccountSignalService (decay math + recompute)", "description": "Temporal decay scoring. score = sum of weight * exp(-ln(2) * age_days / halfLife).", "priority": "high"},
  {"phase": "1. Foundation", "title": "Build LeadGradingService (composite scoring)", "description": "0.5*fit + 0.4*behavior + 0.1*tier_boost. Maps to A/B/C/D via CMDT thresholds.", "priority": "high"},
  {"phase": "1. Foundation", "title": "Build AttributionService (30/40/30 multi-touch)", "description": "First/mid/closing campaign stamping on Closed-Won opportunities.", "priority": "high"},
  {"phase": "1. Foundation", "title": "Build DuplicateResolverService (5-path dedup)", "description": "Email-Contact, email-Lead, domain+company, Account.Domain match, then new Lead.", "priority": "high"},
  {"phase": "1. Foundation", "title": "Build HypercareMonitorService (5 health checks)", "description": "Integration health, lead volume, signal recency, stale quarantine, orphaned hot accounts.", "priority": "medium"},
  {"phase": "1. Foundation", "title": "Build HubSpotSyncService Apex (HubSpot module)", "description": "Outbound contact upsert with retry, rate limiting, integration heartbeat.", "priority": "medium"},
  {"phase": "1. Foundation", "title": "Build BomboraIntentService + Scheduler (Bombora module)", "description": "Daily intent surge ingest. Split into Queueable + Schedulable (Apex platform requirement).", "priority": "medium"},
  {"phase": "1. Foundation", "title": "Build ApolloLeadResource REST endpoint (Apollo module)", "description": "POST /services/apexrest/apollo/v1/lead — webhook for Apollo sequence replies.", "priority": "high"},
  {"phase": "1. Foundation", "title": "Build PoplScanResource REST endpoint (Popl module)", "description": "POST /services/apexrest/popl/v1/scan — booth-scan event capture.", "priority": "high"},
  {"phase": "1. Foundation", "title": "Build LeadConvertInvocable (Flow-callable)", "description": "Flow-callable wrapper for Database.convertLead. Bulk-safe up to 100 conversions.", "priority": "high"},
  {"phase": "1. Foundation", "title": "Build TriggerBypass utility class", "description": "Per-transaction switch to disable triggers during data loads.", "priority": "low"},
  {"phase": "1. Foundation", "title": "Build AccountSignalTrigger + handler", "description": "Stamp weight on before-insert; recompute parent Account on after-DML.", "priority": "high"},
  {"phase": "1. Foundation", "title": "Build LeadTrigger + handler", "description": "Quarantine flag + grading on before-mutate; quarantine row insert on after.", "priority": "high"},
  {"phase": "1. Foundation", "title": "Build 14 Apex test classes (85+ tests)", "description": "All services, REST endpoints, invocables, triggers covered. 75-100% coverage per class.", "priority": "high"},
  {"phase": "1. Foundation", "title": "Build RevOps_Admin permission set", "description": "Object CRUD + class access + FLS for all 75 writable custom fields.", "priority": "high"},
  {"phase": "1. Foundation", "title": "Build 2 Named Credentials (HubSpot, Bombora)", "description": "Auth tokens deferred to per-org configuration.", "priority": "medium"},
  {"phase": "1. Foundation", "title": "Update LeadStatus standard value set", "description": "Added 'Marketing Qualified Lead' and 'Sales Qualified Lead' status values.", "priority": "medium"},
  {"phase": "1. Foundation", "title": "Build Python scaffolding scripts", "description": "scaffold_metadata.py (objects/fields/CMDT), seed_cmdt.py, add_meta.py, generate_permset_fls.py.", "priority": "low"},

  {"phase": "2. Deploy & Bug Fixes", "title": "Round 1 deploy — 65 errors fixed", "description": "MasterDetail required tag, Lookup deleteConstraint, CMDT Currency type, upsert keyword, CampaignInfluence, FirstRespondedDate read-only, Schedulable+Queueable conflict.", "priority": "high"},
  {"phase": "2. Deploy & Bug Fixes", "title": "Round 2 deploy — Lead lookup constraints + permset", "description": "Lead lookup can't have Cascade/Restrict; made optional with SetNull. Added Account read perm to permset.", "priority": "high"},
  {"phase": "2. Deploy & Bug Fixes", "title": "Round 3 deploy — fixed 8 test failures", "description": "Math expectations, missing SOQL fields, double-quarantine race, schedulable-queueable split.", "priority": "high"},
  {"phase": "2. Deploy & Bug Fixes", "title": "Round 4 deploy — final test fixes + FLS auto-generation", "description": "LeadConvertInvocable explicit OwnerId. generate_permset_fls.py for FLS automation.", "priority": "high"},
  {"phase": "2. Deploy & Bug Fixes", "title": "All 55 tests passing — initial production-ready state", "description": "Org-wide coverage above 75% production minimum.", "priority": "high"},

  {"phase": "3. Modular Refactor", "title": "Split monolith into 7 SFDX package directories", "description": "Core + 4 active integration modules + 2 placeholders (MCAE, Slack).", "priority": "high"},
  {"phase": "3. Modular Refactor", "title": "Rename HubSpotMockResponses → HttpMockFactory", "description": "Generic test utility lives in core; reused by HubSpot + Bombora module tests.", "priority": "medium"},
  {"phase": "3. Modular Refactor", "title": "Build per-module permission sets", "description": "HubSpot_Module, Bombora_Module, Apollo_Module, Popl_Module — each grants its specific class access.", "priority": "high"},
  {"phase": "3. Modular Refactor", "title": "Strip integration class accesses out of RevOps_Admin", "description": "Core permset now only grants core classes. Modules ship their own permsets.", "priority": "medium"},
  {"phase": "3. Modular Refactor", "title": "Validate all 5 active packages deploy independently", "description": "63 core + 5 HubSpot + 6 Bombora + 6 Apollo + 5 Popl = 85 tests. All passing.", "priority": "high"},

  {"phase": "4. Auto-Convert Foundation", "title": "Add Account.Domain__c custom field", "description": "Text 100, unique, indexed external ID. Primary key for lead-to-account auto-match.", "priority": "high"},
  {"phase": "4. Auto-Convert Foundation", "title": "Add Lead.Matched_Account__c + Match_Confidence__c", "description": "Lookup + 0-100 confidence score. Stamped by DuplicateResolverService.", "priority": "high"},
  {"phase": "4. Auto-Convert Foundation", "title": "Build backfill_account_domain.apex script", "description": "Parses existing Account.Website → canonical domain. Idempotent, bulk-safe (200/chunk).", "priority": "medium"},
  {"phase": "4. Auto-Convert Foundation", "title": "Extend DuplicateResolverService with Domain match path", "description": "New path 4: when no Lead/Contact match, look up Account.Domain__c. Tier 1/2 = 95% confidence; Tier 3 = 75%.", "priority": "high"},

  {"phase": "5. Flows", "title": "Build flow #1 — Lead_Auto_Convert_On_Create", "description": "Record-triggered. ≥90% confidence → auto-convert via LeadConvertInvocable; 70-89% → suggest message; <70% → no action. Verified all 3 branches.", "priority": "high"},
  {"phase": "5. Flows", "title": "Build flow #2 — Account_Tier_Recompute_On_Update", "description": "Record-triggered. Decision on employees + revenue → sets Tier__c. Verified all 4 branches end-to-end.", "priority": "high"},
  {"phase": "5. Flows", "title": "Build flow #3 — Opportunity_Stage_To_Signal", "description": "Record-triggered. Creates Account_Signal__c on stage change. Verified score increment.", "priority": "high"},
  {"phase": "5. Flows", "title": "Build flow #4 — Hot_Account_Alert (Chatter, deferred to Slack module)", "description": "Record-triggered. Decision on score crossing 50. Logic verified; output channel deferred.", "priority": "medium"},
  {"phase": "5. Flows", "title": "Build flow #5 — Campaign_Member_to_Signal", "description": "Record-triggered on HasResponded flip. Get Records → Create Account_Signal__c. Verified live.", "priority": "high"},
  {"phase": "5. Flows", "title": "Build flow #6a — Lead_SLA_Stamp", "description": "Record-triggered. Stamps Last_MQL_At__c / Last_SQL_At__c on Status crossings. Verified.", "priority": "high"},
  {"phase": "5. Flows", "title": "Build flow #6b — Lead_SLA_Daily_Check (schedule-triggered)", "description": "Daily 7am PST. Marks SLA_Breached__c=true on leads stuck at SQL > 24h.", "priority": "medium"},
  {"phase": "5. Flows", "title": "Build flow #7 — Quarantine_Auto_Assign", "description": "Record-triggered. Reassigns OwnerId to Lead Quarantine Review queue. Verified.", "priority": "medium"},
  {"phase": "5. Flows", "title": "Build flow #8 — Account_Owner_From_Domain", "description": "Record-triggered. Tier 1 → senior AE auto-assignment.", "priority": "medium"},
  {"phase": "5. Flows", "title": "Build flow #9 — Stale_Opp_Alert (schedule-triggered)", "description": "Daily 7:30am PST. Stamps warning Description on opps with no activity > 14 days.", "priority": "medium"},
  {"phase": "5. Flows", "title": "Build flow #10 — Lead_Score_Decay_Daily (schedule-triggered)", "description": "Daily 2am PST. Calls RecomputeAllAccountsInvocable. Verified live: Edge dropped 64.78→64.27 in 24h.", "priority": "high"},
  {"phase": "5. Flows", "title": "Build flow #11 — Account_ABM_Status_Auto_Update", "description": "Record-triggered. Calls AbmStatusInvocable. State machine: Target → Engaged → Active → Won (sticky).", "priority": "high"},
  {"phase": "5. Flows", "title": "Build flow #12 — Daily_Stale_Quarantine_Reminder (schedule-triggered)", "description": "Daily 8am PST. Writes reminder on quarantine records unreviewed > 7 days.", "priority": "low"},
  {"phase": "5. Flows", "title": "Build flow #13 — Quarterly_Tier_Reassignment (schedule-triggered)", "description": "Daily 3am PST. Calls TierReassignmentInvocable. Verified live: 15 scanned, 7 reclassified.", "priority": "medium"},
  {"phase": "5. Flows", "title": "Build RecomputeAllAccountsInvocable Apex + 3 tests", "description": "Flow-callable bulk decay refresh. Used by flow #10.", "priority": "high"},
  {"phase": "5. Flows", "title": "Build AbmStatusInvocable Apex + 8 tests", "description": "Flow-callable ABM lifecycle state machine with sticky Won. Used by flow #11.", "priority": "high"},
  {"phase": "5. Flows", "title": "Build TierReassignmentInvocable Apex + 4 tests", "description": "Flow-callable quarterly tier audit. Used by flow #13.", "priority": "medium"},
  {"phase": "5. Flows", "title": "Create Lead Quarantine Review queue", "description": "Salesforce queue for routing quarantined leads. Required prerequisite for flow #7.", "priority": "medium"},

  {"phase": "6. Client Documentation", "title": "Build methodology HTML deck (15 SLDS-styled slides)", "description": "Live presentation deck. Cover, problem, stack, solution, 6-pillar methodology, dashboards, architecture, deploy, engagement model. Located: pdf-deliverables/methodology-deck/index.html", "priority": "high"},
  {"phase": "6. Client Documentation", "title": "Build As-Built Summary docx", "description": "10-section client leave-behind. Full component inventory + test results + deploy story. Located: pdf-deliverables/RevOps-Platform-AsBuilt-Summary.docx", "priority": "high"},
  {"phase": "6. Client Documentation", "title": "Build Modular Architecture Supplement docx", "description": "Technical follow-up for client architects. SFDX package model + per-client deploy patterns. Located: pdf-deliverables/RevOps-Modular-Architecture-Supplement.docx", "priority": "medium"},
  {"phase": "6. Client Documentation", "title": "Build Lead Journey Brief docx (1 page bulleted)", "description": "Scannable lead lifecycle reference card for client leave-behind. Located: pdf-deliverables/Lead-Journey-Brief.docx", "priority": "medium"},
  {"phase": "6. Client Documentation", "title": "Build Lead Journey Walkthrough Script docx", "description": "4-minute presenter rehearsal script with stage directions and Q&A appendix. Located: pdf-deliverables/Lead-Journey-Walkthrough-Script.docx", "priority": "low"},

  {"phase": "7. SiFive Customization", "title": "Rewrite deck in client-friendly language", "description": "Replaced developer jargon (Account_Signal__c, CMDT, SFDX) with outcomes-first language for VP Marketing audience.", "priority": "high"},
  {"phase": "7. SiFive Customization", "title": "Add slide 2.5 — SiFive stack mapping", "description": "Confident framing: HubSpot + Apollo + Popl as native modules already built. No discovery needed.", "priority": "high"},
  {"phase": "7. SiFive Customization", "title": "Add slide 10.5 — Maria-at-Apple journey table", "description": "10-week lead journey from booth scan to Closed Won. Ties all 6 pillars together.", "priority": "high"},
  {"phase": "7. SiFive Customization", "title": "Reframe lead capture as dual-channel (web + events)", "description": "Slides 6 + 8: HubSpot inbound AND Popl field events both feeding one engine.", "priority": "medium"},
  {"phase": "7. SiFive Customization", "title": "Remove Inspired Ideation Strategies branding", "description": "Per client request — deck reads as SiFive-focused presentation.", "priority": "low"},
  {"phase": "7. SiFive Customization", "title": "Build Project Task Log docx", "description": "This document — comprehensive build phase log with hours estimates. Located: pdf-deliverables/RevOps-Build-Task-Log.docx", "priority": "low"}
]
$tasks$::JSONB;
    v_task JSONB;
    v_inserted INT := 0;
    v_skipped INT := 0;
BEGIN
    -- 1. Find SiFive project. Adjust the WHERE clause if your project is named differently.
    SELECT p.id, p.user_id INTO v_project_id, v_user_id
    FROM public.projects p
    WHERE p.name ILIKE '%sifive%'
       OR p.name ILIKE '%si five%'
    ORDER BY p.created_at DESC
    LIMIT 1;

    IF v_project_id IS NULL THEN
        RAISE EXCEPTION 'No project found matching SiFive. Update the WHERE clause in this script with your actual project name.';
    END IF;

    RAISE NOTICE 'Resolved SiFive project: %', v_project_id;
    RAISE NOTICE 'User: %', v_user_id;

    -- 2. Insert each task — idempotent via title-uniqueness check
    FOR v_task IN SELECT jsonb_array_elements(v_tasks) LOOP
        IF NOT EXISTS (
            SELECT 1 FROM public.tasks
            WHERE project_id = v_project_id
              AND title = v_task->>'title'
        ) THEN
            INSERT INTO public.tasks (
                project_id,
                user_id,
                title,
                description,
                status,
                priority,
                assignee
            ) VALUES (
                v_project_id,
                v_user_id,
                v_task->>'title',
                COALESCE(v_task->>'phase', '') || ' — ' || (v_task->>'description'),
                'done',
                v_task->>'priority',
                'me'
            );
            v_inserted := v_inserted + 1;
        ELSE
            v_skipped := v_skipped + 1;
        END IF;
    END LOOP;

    RAISE NOTICE 'Inserted: %, Skipped (already existed): %', v_inserted, v_skipped;
END $$;

-- Verify the result
SELECT
    SUBSTRING(description FROM 1 FOR 30) AS phase,
    title,
    status,
    priority
FROM public.tasks
WHERE project_id = (
    SELECT id FROM public.projects
    WHERE name ILIKE '%sifive%' OR name ILIKE '%si five%'
    ORDER BY created_at DESC LIMIT 1
)
ORDER BY created_at DESC
LIMIT 70;
