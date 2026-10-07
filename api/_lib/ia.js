// Camada de IA: usa Groq (GROQ_API_KEY) ou Anthropic (ANTHROPIC_API_KEY).
// IA_PROVEDOR=groq|anthropic força um deles quando as duas chaves existem.
import { ErroHttp, fetchComTimeout } from './util.js';

// Ordem de preferência no Groq. O Groq desativa modelos com frequência (o llama-3.3-70b-versatile
// saiu do ar em 16/08/2026); se um modelo não existir mais, o próximo da lista é usado.
const MODELOS_GROQ = ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b', 'openai/gpt-oss-20b'];
const MODELO_ANTHROPIC = 'claude-opus-5-5';

export function provedorIA() {
  const preferido = String(process.env.IA_PROVEDOR || '').toLowerCase();
  if (preferido === 'anthropic' && process.env.ANTHROPIC_API_KEY) return 'anthropic';
  if (preferido === 'groq' && process.env.GROQ_API_KEY) return 'groq';
  if (process.env.GROQ_API_KEY) return 'groq';
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  return null;
}

function modeloIndisponivel(erro) {
  const codigo = String((erro && erro.code) || '');
  const msg = String((erro && erro.message) || '');
  return codigo === 'model_not_found' || codigo === 'model_decommissioned' || /does not exist|decommissioned|no longer supported/i.test(msg);
}

async function requisicaoGroq(modelo, sistema, usuario, maxTokens, modoJSON) {
  const corpo = {
    model: modelo,
    max_completion_tokens: maxTokens,
    temperature: 0.3,
    messages: [{ role: 'system', content: sistema }, { role: 'user', content: usuario }]
  };
  if (modoJSON) corpo.response_format = { type: 'json_object' };
  // Modelos de raciocínio: pouco raciocínio (resposta mais rápida) e sem devolvê-lo no corpo.
  if (modelo.startsWith('openai/gpt-oss')) Object.assign(corpo, { reasoning_effort: 'low', include_reasoning: false });
  else if (modelo.startsWith('qwen/qwen3')) corpo.reasoning_effort = 'none';

  const r = await fetchComTimeout('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + process.env.GROQ_API_KEY },
    body: JSON.stringify(corpo)
  }, 45000, 'serviço de IA (Groq)');
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.error) return { erro: d.error || { message: `HTTP ${r.status}` } };
  return { texto: (d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || '' };
}

async function chamarGroq(sistema, usuario, maxTokens) {
  const candidatos = [...new Set([process.env.GROQ_MODEL, ...MODELOS_GROQ].filter(Boolean))];
  let ultimoErro = null;
  for (const modelo of candidatos) {
    let r = await requisicaoGroq(modelo, sistema, usuario, maxTokens, true);
    // O modo JSON do Groq às vezes rejeita a saída; tentamos de novo sem ele.
    if (r.erro && r.erro.code === 'json_validate_failed') r = await requisicaoGroq(modelo, sistema, usuario, maxTokens, false);
    if (!r.erro) return { texto: r.texto, modelo };
    ultimoErro = r.erro;
    if (!modeloIndisponivel(r.erro)) break;
  }
  throw new ErroHttp(502, 'Erro no serviço de IA (Groq): ' + (ultimoErro.message || 'falha desconhecida'), 'IA');
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

export async function gerarJSON({ sistema, usuario, maxTokens = 4000 }) {
  const provedor = provedorIA();
  if (!provedor) {
    throw new ErroHttp(501, 'Nenhuma IA configurada. Cadastre GROQ_API_KEY (ou ANTHROPIC_API_KEY) nas variáveis de ambiente do Vercel.', 'SEM_IA');
  }
  const { texto, modelo } = provedor === 'groq'
    ? await chamarGroq(sistema, usuario, maxTokens)
    : await chamarAnthropic(sistema, usuario, maxTokens);
  return { dados: extrairJSON(texto), provedor, modelo };
}
