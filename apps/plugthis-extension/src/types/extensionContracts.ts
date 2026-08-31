/**
 * Typed contracts between PlugThis extension ↔ Cloudflare Worker.
 * No Teable field IDs. No vendor secrets.
 */

export const DEFAULT_WORKER_API_BASE = 'https://api.theleveragelab.com';
export const EXTENSION_SOURCE = 'plugthis_extension' as const;

export interface ExtensionSettings {
  workerApiBaseUrl: string;
  extensionLicenseKey: string;
  executiveEmail: string;
  tenantId: string;
  debugMode: boolean;
  /** When true (default in scaffold), use local mock responses instead of live Worker */
  mockMode: boolean;
}

export interface PageCapturePage {
  title: string;
  url: string;
  canonical_url: string | null;
  meta_description: string | null;
  h1: string | null;
  selected_text: string | null;
  visible_text_excerpt: string;
  linkedin_url?: string | null;
}

export interface PageCapturePayload {
  source: typeof EXTENSION_SOURCE;
  captured_at: string;
  page: PageCapturePage;
  executive_context: {
    executive_email: string | null;
    tenant_id: string | null;
  };
}

export interface ExtensionValidationRequest {
  license_key: string;
  executive_email: string | null;
  tenant_id: string | null;
  extension_version: string;
}

export interface ExtensionValidationResponse {
  valid: boolean;
  mock?: boolean;
  executive_email?: string | null;
  tenant_id?: string | null;
  assigned_base_id?: string | null;
  message?: string;
  error?: string;
}

export interface LeadCaptureRequest {
  capture: PageCapturePayload;
  options?: {
    priority_hint?: 'High' | 'Medium' | 'Low';
  };
}

export interface LeadCaptureResponse {
  ok: boolean;
  mock?: boolean;
  lead_id?: string;
  research_run_id?: string;
  automation_log_id?: string;
  message?: string;
  error?: string;
}

export interface ResearchRunRequest {
  capture: PageCapturePayload;
  lead_id?: string;
  prompt_template_hint?: 'Company Research Brief';
}

export interface ResearchRunResponse {
  ok: boolean;
  mock?: boolean;
  research_run_id?: string;
  summary?: string;
  priority_score?: 'High' | 'Medium' | 'Low';
  automation_log_id?: string;
  message?: string;
  error?: string;
}

export type ContentDraftKind = 'linkedin_post' | 'email_hook';

export interface ContentDraftRequest {
  capture: PageCapturePayload;
  kind: ContentDraftKind;
  lead_id?: string;
  research_summary?: string;
}

export interface ContentDraftResponse {
  ok: boolean;
  mock?: boolean;
  kind: ContentDraftKind;
  draft_id?: string;
  title?: string;
  body: string;
  automation_log_id?: string;
  message?: string;
  error?: string;
}

export interface WebInsightRequest {
  capture: PageCapturePayload;
  notes?: string;
}

export interface WebInsightResponse {
  ok: boolean;
  mock?: boolean;
  insight_id?: string;
  summary?: string;
  automation_log_id?: string;
  message?: string;
  error?: string;
}

export interface AutomationLogRequest {
  action_type:
    | 'Research'
    | 'Copy Generation'
    | 'Image Generation'
    | 'Audio Generation'
    | 'Outreach'
    | 'Web Monitoring'
    | 'Security Monitoring'
    | 'System';
  status: 'Pending' | 'Success' | 'Failed';
  summary: string;
  related_lead_id?: string;
  related_content_id?: string;
  error_message?: string;
}

export interface AutomationLogResponse {
  ok: boolean;
  mock?: boolean;
  log_id?: string;
  message?: string;
  error?: string;
}

/** Messages between popup ↔ background ↔ content */
export type ExtensionRuntimeMessage =
  | { type: 'GET_PAGE_CAPTURE' }
  | { type: 'PAGE_CAPTURE_RESULT'; ok: true; capture: PageCapturePayload }
  | { type: 'PAGE_CAPTURE_RESULT'; ok: false; error: string }
  | { type: 'VALIDATE_LICENSE' }
  | {
      type: 'RUN_ACTION';
      action:
        | 'capture_lead'
        | 'run_research'
        | 'draft_linkedin'
        | 'draft_email'
        | 'log_web_insight';
    };
