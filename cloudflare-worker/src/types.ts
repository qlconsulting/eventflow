/**
 * Shared TypeScript interfaces for The Leverage Lab Worker.
 */

export interface Env {
  ENVIRONMENT: string;
  API_BASE_URL: string;
  ALLOWED_ORIGINS: string;
  TEABLE_MASTER_BASE_ID: string;
  TEABLE_MASTER_TABLE_ID: string;
  TEABLE_API_KEY: string;
  RETRIEVER_API_KEY: string;
  KATTEB_API_KEY: string;
  QOLABA_API_KEY: string;
  FUSE_API_KEY: string;
  JWT_SECRET: string;
  DASHFORM_WEBHOOK_SECRET: string;
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

export interface DashformOnboardingPayload {
  email: string;
  fullName: string;
  companyName: string;
  brandTone: string;
  brandVoiceNotes?: string;
  websiteUrl?: string;
  webhookSecret?: string;
}

export interface OrchestrateRequest {
  promptTemplateId: string;
  targetUrl: string;
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
  teableRecordId?: string;
  fuseCampaignId?: string;
}

export interface ClientRegistryRecord {
  email: string;
  assignedBaseId: string;
  companyName?: string;
  fullName?: string;
}
