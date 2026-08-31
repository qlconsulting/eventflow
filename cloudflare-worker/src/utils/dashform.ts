/**
 * Normalize Dashform webhook JSON into OnboardingIntake.
 * Mapping-only until Dashform webhook is enabled in production.
 */

import type {
  BrandTone,
  ClientPackage,
  DashformAnswers,
  DashformWebhookPayload,
  OnboardingIntake,
  PreferredChannel,
  WebManagementScopeItem,
} from '../types';

const VALID_TONES = new Set([
  'Visionary/Inspirational',
  'Direct/Opinionated',
  'Academic/Analytical',
  'Bold/Provocative',
]);

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asBool(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    return v === 'true' || v === '1' || v === 'yes';
  }
  return false;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v));
  if (typeof value === 'string' && value.trim()) {
    return value.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function inferClientPackage(answers: DashformAnswers): ClientPackage {
  if (answers.client_package) return answers.client_package;
  if (answers.web_management_client) return 'The Leverage Lab + Web Management';
  return 'The Leverage Lab';

}

/**
 * Accept either the nested Dashform envelope or a flat answers object for local testing.
 */
export function parseDashformPayload(raw: unknown): {
  ok: true;
  intake: OnboardingIntake;
  envelope: DashformWebhookPayload;
} | {
  ok: false;
  message: string;
} {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, message: 'Payload must be a JSON object' };
  }

  const obj = raw as Record<string, unknown>;
  const hasEnvelope = typeof obj.answers === 'object' && obj.answers !== null;

  const answers = (hasEnvelope ? obj.answers : obj) as DashformAnswers;
  const executiveEmail = asString(answers.exec_email);
  const executiveName = asString(answers.exec_name);
  const companyName = asString(answers.company_name);
  const brandTone = asString(answers.brand_tone) as BrandTone;

  if (!executiveEmail || !executiveName || !companyName || !brandTone) {
    return {
      ok: false,
      message:
        'answers.exec_email, exec_name, company_name, and brand_tone are required',
    };
  }

  if (!VALID_TONES.has(brandTone)) {
    return {
      ok: false,
      message: `brand_tone must be one of: ${[...VALID_TONES].join(', ')}`,
    };
  }

  const preferredChannels = asStringArray(answers.preferred_channels) as PreferredChannel[];
  const webManagementScope = asStringArray(
    answers.web_management_scope,
  ) as WebManagementScopeItem[];

  const envelope: DashformWebhookPayload = {
    event: asString(obj.event) || 'form.submitted',
    form_id: asString(obj.form_id) || 'frm_leverage_lab_intake',
    submission_id: asString(obj.submission_id) || `sub_manual_${Date.now()}`,
    submitted_at: asString(obj.submitted_at) || new Date().toISOString(),
    answers: {
      ...answers,
      exec_email: executiveEmail,
      exec_name: executiveName,
      company_name: companyName,
      brand_tone: brandTone,
    },
    webhookSecret: typeof obj.webhookSecret === 'string' ? obj.webhookSecret : undefined,
  };

  const intake: OnboardingIntake = {
    submissionId: envelope.submission_id,
    formId: envelope.form_id,
    submittedAt: envelope.submitted_at,
    executiveName,
    executiveEmail,
    companyName,
    companyWebsite: asString(answers.company_website) || undefined,
    executiveLinkedIn: asString(answers.executive_linkedin) || undefined,
    targetAudience: asString(answers.target_audience) || undefined,
    coreOffer: asString(answers.core_offer) || undefined,
    brandTone,
    primaryPainPoint: asString(answers.primary_pain_point) || undefined,
    preferredChannels: preferredChannels.length ? preferredChannels : undefined,
    webManagementClient: asBool(answers.web_management_client),
    managedDomain: asString(answers.managed_domain) || undefined,
    webManagementScope: webManagementScope.length ? webManagementScope : undefined,
    brandVoiceNotes: asString(answers.brand_voice_notes) || undefined,
    clientPackage: inferClientPackage(answers),
  };

  return { ok: true, intake, envelope };
}
