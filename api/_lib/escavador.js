// Conector da API v2 do Escavador (https://api.escavador.com/v2/docs).
// É o provedor usado para buscar processos por CPF/CNPJ, já que os tribunais
// não oferecem essa busca de forma pública e aberta.
import { ErroHttp, fetchComTimeout, normalizarNome, parseCNJ, tribunalDoCNJ, categoriaSituacao } from './util.js';

const BASE = 'https://api.escavador.com/api/v2';
const PARAMS_PAGINACAO = ['cursor', 'li', 'limit', 'ordena_por', 'ordem', 'incluir_homonimos', 'incluir_mesma_raiz_cnpj'];

export function escavadorAtivo() {
  return !!process.env.ESCAVADOR_API_KEY;
}

async function chamar(caminho, params = {}) {
  const url = new URL(BASE + caminho);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  }
  const r = await fetchComTimeout(url, {
    headers: {
      Authorization: 'Bearer ' + process.env.ESCAVADOR_API_KEY,
      'X-Requested-With': 'XMLHttpRequest',
      Accept: 'application/json'
    }
  }, 25000, 'provedor Escavador');

  let corpo = null;
  try { corpo = await r.json(); } catch { /* resposta sem JSON */ }
  if (r.ok) return corpo;

  const detalhe = corpo && (corpo.error || corpo.message) ? ` (${corpo.error || corpo.message})` : '';
  if (r.status === 404) return null;
  if (r.status === 401) throw new ErroHttp(502, 'O token do Escavador foi recusado. Confira a variável ESCAVADOR_API_KEY.', 'PROVEDOR_AUTH');
  if (r.status === 402) throw new ErroHttp(402, 'A conta do Escavador está sem créditos para novas consultas.', 'SEM_CREDITO');
  if (r.status === 422) throw new ErroHttp(400, 'O provedor recusou os dados enviados' + detalhe + '.', 'PROVEDOR_422');
  if (r.status === 429) throw new ErroHttp(429, 'Muitas consultas seguidas. Aguarde alguns segundos e tente de novo.', 'LIMITE');
  throw new ErroHttp(502, `Erro no provedor Escavador (HTTP ${r.status})${detalhe}.`, 'PROVEDOR');
}

// O "next" do Escavador é uma URL com cursor; devolvemos só os parâmetros de paginação.
function extrairPagina(next) {
  if (!next) return null;
  try {
    const u = new URL(next);
    const qs = new URLSearchParams();
    for (const k of PARAMS_PAGINACAO) if (u.searchParams.has(k)) qs.set(k, u.searchParams.get(k));
    return qs.has('cursor') ? qs.toString() : null;
  } catch {
    return null;
  }
}

export async function buscarPorDocumento(documento, pagina) {
  const params = { cpf_cnpj: documento, limit: 50, ordena_por: 'data_ultima_movimentacao', ordem: 'desc' };
  if (pagina) {
    const qs = new URLSearchParams(String(pagina));
    for (const k of PARAMS_PAGINACAO) if (qs.has(k)) params[k] = qs.get(k);
  }
  const dados = await chamar('/envolvido/processos', params);
  if (!dados) return { envolvido: null, processos: [], proximaPagina: null };

  const env = dados.envolvido_encontrado || {};
  const consultado = { documento, nome: env.nome };
  return {
    envolvido: env.nome ? {
      nome: env.nome,
      tipoPessoa: env.tipo_pessoa || null,
      quantidadeProcessos: env.quantidade_processos ?? null
    } : null,
    processos: (dados.items || []).map((it) => normalizarProcesso(it, consultado)),
    proximaPagina: extrairPagina(dados.links && dados.links.next)
  };
}

export async function buscarProcesso(numero, { capa = true } = {}) {
  const caminho = '/processos/numero_cnj/' + encodeURIComponent(numero);
  const [dadosCapa, movs] = await Promise.all([
    capa ? chamar(caminho) : Promise.resolve(null),
    chamar(caminho + '/movimentacoes', { limit: 100 })
  ]);
  if (capa && !dadosCapa) return null;
  const movimentacoes = ((movs && movs.items) || []).map(normalizarMovimentacao);
  if (!capa) return { numero, movimentacoes };
  return { ...normalizarProcesso(dadosCapa, null), movimentacoes };
}

function normalizarMovimentacao(m) {
  const f = m.fonte || {};
  const classif = m.classificacao_predita || {};
  return {
    data: m.data || null,
    titulo: classif.nome || m.texto_categoria || m.tipo || 'Movimentação',
    descricao: m.conteudo || '',
    explicacaoTipo: classif.descricao || null,
    fonte: [f.sigla, f.grau_formatado].filter(Boolean).join(' · ') || f.nome || null
  };
}

function oabs(adv) {
  return (adv.oabs || []).map((o) => `${o.numero}/${o.uf}`).join(', ');
}

function normalizarProcesso(it, consultado) {
  const fontes = it.fontes || [];
  const principal = fontes.find((f) => f.tipo === 'TRIBUNAL' && f.capa) || fontes.find((f) => f.capa) || fontes[0] || {};
  const capa = principal.capa || {};
  const cnj = parseCNJ(it.numero_cnj);
  const trib = cnj ? tribunalDoCNJ(cnj) : {};

  // Une os envolvidos de todas as fontes (1º grau, 2º grau, diários), sem repetir.
  const partesMap = new Map();
  let papelConsultado = null;
  const docConsultado = consultado && consultado.documento;
  const nomeConsultado = consultado && normalizarNome(consultado.nome);
  for (const f of fontes) {
    for (const e of f.envolvidos || []) {
      if (e.polo === 'ADVOGADO') continue;
      const chave = normalizarNome(e.nome) + '|' + (e.polo || '');
      const doc = String(e.cpf || e.cnpj || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
      const ehConsultado = !!consultado && ((docConsultado && doc && doc === docConsultado) || (nomeConsultado && normalizarNome(e.nome) === nomeConsultado));
      if (ehConsultado && !papelConsultado) {
        papelConsultado = { nome: e.nome, tipo: e.tipo_normalizado || e.tipo || null, polo: e.polo || null };
      }
      if (partesMap.has(chave)) continue;
      partesMap.set(chave, {
        nome: e.nome,
        tipo: e.tipo_normalizado || e.tipo || null,
        polo: e.polo || 'OUTROS',
        tipoPessoa: e.tipo_pessoa || null,
        advogados: (e.advogados || []).map((a) => ({ nome: a.nome, oab: oabs(a) }))
      });
    }
  }

  const situacao = capa.situacao
    || (it.fontes_tribunais_estao_arquivadas ? 'Arquivado' : null)
    || (principal.status_predito === 'INATIVO' ? 'Inativo (estimado)' : principal.status_predito === 'ATIVO' ? 'Ativo (estimado)' : null);

  const unidade = capa.orgao_julgador_normalizado || it.unidade_origem || {};
  const local = [unidade.cidade, unidade.estado && unidade.estado.sigla].filter(Boolean).join('/');
  const assuntos = (capa.assuntos_normalizados || []).map((a) => a.nome).filter(Boolean);

  return {
    numero: it.numero_cnj,
    tribunal: principal.sigla || unidade.tribunal_sigla || trib.sigla || null,
    tribunalNome: (principal.tribunal && principal.tribunal.nome) || principal.nome || trib.nome || null,
    segmento: trib.segmento || null,
    grau: principal.grau_formatado || null,
    classe: (capa.classe_normalizada && capa.classe_normalizada.nome) || capa.classe || null,
    assuntos: assuntos.length ? assuntos : (capa.assunto ? [capa.assunto] : []),
    area: capa.area || null,
    orgaoJulgador: capa.orgao_julgador || unidade.nome || null,
    local: local || null,
    situacao: situacao || null,
    statusCategoria: categoriaSituacao(situacao),
    valorCausa: (capa.valor_causa && capa.valor_causa.valor_formatado) || null,
    dataInicio: it.data_inicio || capa.data_distribuicao || null,
    dataUltimaMovimentacao: it.data_ultima_movimentacao || null,
    quantidadeMovimentacoes: it.quantidade_movimentacoes ?? null,
    segredoJustica: fontes.some((f) => f.segredo_justica),
    sistema: principal.sistema || null,
    poloAtivo: it.titulo_polo_ativo || null,
    poloPassivo: it.titulo_polo_passivo || null,
    partes: [...partesMap.values()],
    papelConsultado,
    fontes: fontes.map((f) => ({ sigla: f.sigla, descricao: f.descricao, tipo: f.tipo, url: f.url || null })),
    url: principal.url || null,
    processosRelacionados: (it.processos_relacionados || []).map((p) => p.numero).filter(Boolean),
    atualizadoEm: it.data_ultima_verificacao || null,
    movimentacoes: null,
    origem: 'Escavador'
  };
}
