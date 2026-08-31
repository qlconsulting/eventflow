/**
 * Popup UI controller — captures active tab URL, loads prompt templates,
 * posts orchestration payloads to the Worker via the background service worker.
 * No master API keys are stored or transmitted from this surface.
 */

const DEFAULT_API_BASE = 'https://api.theleveragelab.com';

const els = {
  targetUrl: document.getElementById('target-url'),
  promptSelect: document.getElementById('prompt-select'),
  optVisuals: document.getElementById('opt-visuals'),
  optAudio: document.getElementById('opt-audio'),
  optFuse: document.getElementById('opt-fuse'),
  btnRun: document.getElementById('btn-run'),
  btnRefresh: document.getElementById('btn-refresh'),
  status: document.getElementById('status'),
};

function setStatus(message, kind = '') {
  els.status.textContent = message;
  els.status.classList.remove('is-error', 'is-success');
  if (kind) els.status.classList.add(kind);
}

async function getSettings() {
  const stored = await chrome.storage.local.get(['apiBaseUrl', 'userJwt']);
  return {
    apiBaseUrl: stored.apiBaseUrl || DEFAULT_API_BASE,
    userJwt: stored.userJwt || '',
  };
}

async function captureActiveTabUrl() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url || '';
  els.targetUrl.value = url;
  return url;
}

async function sendProxy(message) {
  return chrome.runtime.sendMessage(message);
}

async function loadPromptTemplates() {
  const { apiBaseUrl, userJwt } = await getSettings();
  if (!userJwt) {
    els.promptSelect.innerHTML = '<option value="">Sign in to load templates</option>';
    els.promptSelect.disabled = true;
    els.btnRun.disabled = true;
    setStatus('Add a User JWT in extension storage to continue.');
    return;
  }

  setStatus('Loading prompt templates…');
  const response = await sendProxy({
    type: 'FETCH_PROMPTS',
    apiBaseUrl,
    userJwt,
  });

  if (!response?.ok) {
    els.promptSelect.innerHTML = '<option value="">Unable to load templates</option>';
    els.promptSelect.disabled = true;
    els.btnRun.disabled = true;
    setStatus(response?.error || 'Failed to load templates', 'is-error');
    return;
  }

  const templates = Array.isArray(response.templates) ? response.templates : [];
  if (templates.length === 0) {
    els.promptSelect.innerHTML = '<option value="">No templates found</option>';
    els.promptSelect.disabled = true;
    els.btnRun.disabled = true;
    setStatus('No prompt templates in your private base.', 'is-error');
    return;
  }

  els.promptSelect.innerHTML = templates
    .map(
      (t) =>
        `<option value="${escapeAttr(t.id)}">${escapeHtml(t.name || t.id)}</option>`,
    )
    .join('');
  els.promptSelect.disabled = false;
  els.btnRun.disabled = !els.targetUrl.value;
  setStatus(`${templates.length} template${templates.length === 1 ? '' : 's'} ready.`, 'is-success');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, '&#39;');
}

async function runPipeline() {
  const { apiBaseUrl, userJwt } = await getSettings();
  const targetUrl = els.targetUrl.value.trim();
  const promptTemplateId = els.promptSelect.value;

  if (!userJwt) {
    setStatus('Missing User JWT.', 'is-error');
    return;
  }
  if (!targetUrl || !promptTemplateId) {
    setStatus('Target URL and prompt template are required.', 'is-error');
    return;
  }

  els.btnRun.disabled = true;
  setStatus('Running Retriever → Katteb → Qolaba pipeline…');

  const response = await sendProxy({
    type: 'ORCHESTRATE',
    apiBaseUrl,
    userJwt,
    payload: {
      promptTemplateId,
      targetUrl,
      options: {
        generateVisuals: els.optVisuals.checked,
        generateAudio: els.optAudio.checked,
        syncToFuse: els.optFuse.checked,
      },
    },
  });

  els.btnRun.disabled = false;

  if (!response?.ok) {
    setStatus(response?.error || 'Pipeline failed', 'is-error');
    return;
  }

  setStatus('Pipeline completed successfully.', 'is-success');
}

els.btnRefresh.addEventListener('click', () => {
  loadPromptTemplates().catch((err) => {
    setStatus(err instanceof Error ? err.message : 'Refresh failed', 'is-error');
  });
});

els.btnRun.addEventListener('click', () => {
  runPipeline().catch((err) => {
    els.btnRun.disabled = false;
    setStatus(err instanceof Error ? err.message : 'Run failed', 'is-error');
  });
});

captureActiveTabUrl()
  .then(() => loadPromptTemplates())
  .catch((err) => {
    setStatus(err instanceof Error ? err.message : 'Init failed', 'is-error');
  });
