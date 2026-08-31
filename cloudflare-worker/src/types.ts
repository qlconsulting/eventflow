/**
 * Shared TypeScript interfaces for The Leverage Lab Worker.
 * Field names mirror Teable Master Control + Executive Workspace schemas
 * (see config/teable-manifest.json).
 */

/** Brand tones seeded in Tone_Persona_Matrix / Client_Profile.Brand Tone */
export type BrandTone =
  | 'Visionary/Inspirational'
  | 'Direct/Opinionated'
  | 'Academic/Analytical'
  | 'Bold/Provocative'
  | string;

export type ClientPackage =
  | 'Web Management Only'
  | 'The Leverage Lab'
  | 'The Leverage Lab + Web Management'
  | 'VIP Managed Growth';

export type WorkspaceStatus =
  | 'Intake Received'
  | 'Provisioning'
  | 'Active'
  | 'Provisioning Error'
  | 'Suspended';

export type PreferredChannel = 'LinkedIn' | 'Email' | 'Blog' | 'Newsletter' | 'Website Content';

export type WebManagementScopeItem =
  | 'Website Management'
  | 'Security Monitoring'
  | 'Uptime Monitoring'
  | 'Backups'
  | 'Content Updates'
  | 'SEO Support'
  | 'Performance Monitoring';

/**
 * Runtime bindings. Secret keys via `wrangler secret`; base/table IDs via [vars]
 * from config/teable-manifest.json.
 */
export interface Env {
  ENVIRONMENT: string;
  API_BASE_URL: string;
  ALLOWED_ORIGINS: string;
  LAB_DASHBOARD_URL: string;
  DEFAULT_TIMEZONE: string;

  DASHFORM_FORM_ID: string;
  DASHFORM_FORM_UUID: string;
  DASHFORM_ORGANIZATION_ID: string;

  /** Defaults to https://app.teable.ai/api */
  TEABLE_API_BASE_URL: string;
  TEABLE_MASTER_BASE_ID: string;
  /** Folder node inside Master Control containing client template tables */
  TEABLE_TEMPLATE_FOLDER_ID: string;
  /** Space that receives per-client duplicated bases */
  TEABLE_SPACE_ID: string;

  TEABLE_EXECUTIVE_DIRECTORY_TABLE_ID: string;
  TEABLE_PROVISIONING_LOG_TABLE_ID: string;
  TEABLE_MASTER_PROMPT_TEMPLATES_TABLE_ID: string;
  TEABLE_TONE_PERSONA_MATRIX_TABLE_ID: string;
  TEABLE_GLOBAL_SYSTEM_VARIABLES_TABLE_ID: string;
  TEABLE_API_CREDIT_LEDGER_TABLE_ID: string;

  /** Source template table IDs (Master Control folder) — seed/reference only */
  TEABLE_TMPL_CLIENT_PROFILE_TABLE_ID: string;
  TEABLE_TMPL_PROMPT_LIBRARY_TABLE_ID: string;
  TEABLE_TMPL_INBOX_LEADS_TABLE_ID: string;
  TEABLE_TMPL_RESEARCH_RUNS_TABLE_ID: string;
  TEABLE_TMPL_THOUGHT_LEADERSHIP_TABLE_ID: string;
  TEABLE_TMPL_OUTREACH_QUEUE_TABLE_ID: string;
  TEABLE_TMPL_ASSET_LIBRARY_TABLE_ID: string;
  TEABLE_TMPL_AUTOMATION_LOG_TABLE_ID: string;
  TEABLE_TMPL_WEB_PROPERTIES_TABLE_ID: string;

  /** Secrets — never in the Chrome Extension */
  TEABLE_API_KEY: string;
  RETRIEVER_API_KEY: string;
  KATTEB_API_KEY: string;
  QOLABA_API_KEY: string;
  FUSE_API_KEY: string;
  JWT_SECRET: string;
  DASHFORM_WEBHOOK_SECRET: string;
  DASHFORM_API_KEY?: string;
}

export interface ApiErrorBody {
  error: string;
  message: string;
  details?: unknown;
}

export interface JwtClaims {
  sub: string;
  email: string;
  exp: number;
  iat?: number;
}

export interface DashformAnswers {
  exec_name: string;
  exec_email: string;
  company_name: string;
  company_website?: string;
  executive_linkedin?: string;
  target_audience?: string;
  core_offer?: string;
  brand_tone: BrandTone;
  primary_pain_point?: string;
  preferred_channels?: PreferredChannel[];
  web_management_client?: boolean;
  managed_domain?: string;
  web_management_scope?: WebManagementScopeItem[];
  brand_voice_notes?: string;
  client_package?: ClientPackage;
}

export interface DashformWebhookPayload {
  event: string;
  form_id: string;
  submission_id: string;
  submitted_at: string;
  answers: DashformAnswers;
  webhookSecret?: string;
}

export interface OnboardingIntake {
  submissionId: string;
  formId: string;
  submittedAt: string;
  executiveName: string;
  executiveEmail: string;
  companyName: string;
  companyWebsite?: string;
  executiveLinkedIn?: string;
  targetAudience?: string;
  coreOffer?: string;
  brandTone: BrandTone;
  primaryPainPoint?: string;
  preferredChannels?: PreferredChannel[];
  webManagementClient: boolean;
  managedDomain?: string;
  webManagementScope?: WebManagementScopeItem[];
  brandVoiceNotes?: string;
  clientPackage: ClientPackage;
}

export interface OrchestrateRequest {
  promptTemplateId: string;
  targetUrl: string;
  leadId?: string;
  options?: {
    generateVisuals?: boolean;
    generateAudio?: boolean;
    syncToFuse?: boolean;
  };
}

export interface OrchestrateResult {
  research: unknown;
  copy: unknown;
  assets?: unknown;
  researchRunId?: string;
  thoughtLeadershipId?: string;
  automationLogId?: string;
  fuseCampaignId?: string;
}

export interface ClientRegistryRecord {
  email: string;
  assignedBaseId: string;
  companyName?: string;
  fullName?: string;
  workspaceStatus?: WorkspaceStatus;
  recordId?: string;
}

/** Map of stable table name → table ID inside a client workspace base */
export type ClientTableMap = Record<string, string>;

export type ProvisioningStep =
  | 'Intake Received'
  | 'Template Base Cloned'
  | 'Client Profile Created'
  | 'Prompt Library Seeded'
  | 'Executive Directory Updated'
  | 'Welcome Email Queued'
  | 'Complete'
  | 'Error';
