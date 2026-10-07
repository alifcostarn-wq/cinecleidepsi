// Camada de IA: usa Groq (GROQ_API_KEY) ou Anthropic (ANTHROPIC_API_KEY).
// IA_PROVEDOR=groq|anthropic força um deles quando as duas chaves existem.
import { ErroHttp, fetchComTimeout } from './util.js';

const MODELO_GROQ = 'llama-3.3-70b-versatile';
const MODELO_ANTHROPIC = 'claude-opus-5-5';

export function provedorIA() {
  const preferido = String(process.env.IA_PROVEDOR || '').toLowerCase();
  if (preferido === 'anthropic' && process.env.ANTHROPIC_API_KEY) return 'anthropic';
  if (preferido === 'groq' && process.env.GROQ_API_KEY) return 'groq';
  if (process.env.GROQ_API_KEY) return 'groq';
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  return null;
}

async function chamarGroq(sistema, usuario, maxTokens, modoJSON) {
  const modelo = process.env.GROQ_MODEL || MODELO_GROQ;
  const corpo = {
    model: modelo,
    max_tokens: maxTokens,
    temperature: 0.3,
    messages: [{ role: 'system', content: sistema }, { role: 'user', content: usuario }]
  };
  if (modoJSON) corpo.response_format = { type: 'json_object' };

  const r = await fetchComTimeout('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + process.env.GROQ_API_KEY },
    body: JSON.stringify(corpo)
  }, 45000, 'serviço de IA (Groq)');
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.error) {
    const msg = (d.error && d.error.message) || `HTTP ${r.status}`;
    // O modo JSON do Groq às vezes rejeita a saída; tentamos de novo sem ele.
    if (modoJSON && d.error && d.error.code === 'json_validate_failed') return chamarGroq(sistema, usuario, maxTokens, false);
    throw new ErroHttp(502, 'Erro no serviço de IA (Groq): ' + msg, 'IA');
  }
  return { texto: (d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || '', modelo };
}

async function chamarAnthropic(sistema, usuario, maxTokens) {
  const modelo = process.env.ANTHROPIC_MODEL || MODELO_ANTHROPIC;
  const r = await fetchComTimeout('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({ model: modelo, max_tokens: maxTokens, system: sistema, messages: [{ role: 'user', content: usuario }] })
  }, 55000, 'serviço de IA (Anthropic)');
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.type === 'error') {
    throw new ErroHttp(502, 'Erro no serviço de IA (Anthropic): ' + ((d.error && d.error.message) || `HTTP ${r.status}`), 'IA');
  }
  const texto = (d.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  return { texto, modelo };
}

function extrairJSON(texto) {
  const limpo = String(texto || '').replace(/```(?:json)?/gi, '').trim();
  const ini = limpo.indexOf('{');
  const fim = limpo.lastIndexOf('}');
  if (ini >= 0 && fim > ini) {
    try { return JSON.parse(limpo.slice(ini, fim + 1)); } catch { /* cai no erro abaixo */ }
  }
  throw new ErroHttp(502, 'A IA respondeu em um formato inesperado. Tente gerar novamente.', 'IA_FORMATO');
}

export async function gerarJSON({ sistema, usuario, maxTokens = 2200 }) {
  const provedor = provedorIA();
  if (!provedor) {
    throw new ErroHttp(501, 'Nenhuma IA configurada. Cadastre GROQ_API_KEY (ou ANTHROPIC_API_KEY) nas variáveis de ambiente do Vercel.', 'SEM_IA');
  }
  const { texto, modelo } = provedor === 'groq'
    ? await chamarGroq(sistema, usuario, maxTokens, true)
    : await chamarAnthropic(sistema, usuario, maxTokens);
  return { dados: extrairJSON(texto), provedor, modelo };
}
