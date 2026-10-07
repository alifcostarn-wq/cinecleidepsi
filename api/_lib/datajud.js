// Conector da API Pública do DataJud (CNJ) — gratuita, consulta pelo número do processo.
// Documentação: https://datajud-wiki.cnj.jus.br/api-publica/
// A base pública NÃO traz nomes/documentos das partes (LGPD), só capa e movimentações.
import { ErroHttp, fetchComTimeout, tribunalDoCNJ, categoriaSituacao } from './util.js';

const BASE = 'https://api-publica.datajud.cnj.jus.br';
// Chave pública divulgada pelo CNJ. Pode ser trocada pelo CNJ a qualquer momento:
// nesse caso, configure DATAJUD_API_KEY com a chave vigente publicada na wiki.
const CHAVE_PUBLICA = 'cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==';

const GRAUS = {
  G1: '1º grau', G2: '2º grau', JE: 'Juizado Especial', TR: 'Turma Recursal',
  SUP: 'Tribunal Superior', TRU: 'Turma Regional de Uniformização', TNU: 'Turma Nacional de Uniformização'
};

// Códigos da Tabela Processual Unificada (TPU) usados para estimar a situação.
const MOV_DESARQUIVAMENTO = [893];
const MOV_ARQUIVAMENTO = [246, 861, 22];
const MOV_ARQUIVAMENTO_PROVISORIO = [245];
const MOV_TRANSITO = [848];

function dataDJ(v) {
  if (!v) return null;
  const s = String(v);
  if (/^\d{14}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(8, 10)}:${s.slice(10, 12)}:${s.slice(12, 14)}`;
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  return s;
}

function estimarSituacao(movs) {
  for (const m of movs) {
    const nome = String(m.titulo || '').toLowerCase();
    if (MOV_DESARQUIVAMENTO.includes(m.codigo) || nome.startsWith('desarquiv')) return 'Em andamento (desarquivado)';
    if (MOV_ARQUIVAMENTO_PROVISORIO.includes(m.codigo) || nome.includes('arquivado provisoriamente')) return 'Arquivado provisoriamente';
    if (MOV_ARQUIVAMENTO.includes(m.codigo) || nome.startsWith('arquiva') || nome === 'baixa definitiva') return 'Arquivado / baixado';
  }
  if (movs.some((m) => MOV_TRANSITO.includes(m.codigo))) return 'Transitado em julgado';
  return movs.length ? 'Em andamento' : 'Sem movimentações registradas';
}

function formatarValor(v) {
  const n = Number(v);
  if (!v || Number.isNaN(n)) return null;
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export async function buscarProcessoDatajud(p) {
  const trib = tribunalDoCNJ(p);
  if (!trib.aliasDatajud) {
    throw new ErroHttp(404, `O ${trib.nome} não disponibiliza processos na API pública do CNJ (DataJud).`, 'SEM_DATAJUD');
  }

  const r = await fetchComTimeout(`${BASE}/api_publica_${trib.aliasDatajud}/_search`, {
    method: 'POST',
    headers: {
      Authorization: 'APIKey ' + (process.env.DATAJUD_API_KEY || CHAVE_PUBLICA),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ size: 20, query: { match: { numeroProcesso: p.digitos } } })
  }, 50000, 'DataJud (CNJ)');

  if (r.status === 401 || r.status === 403) {
    throw new ErroHttp(502, 'A chave pública do DataJud foi recusada. O CNJ pode tê-la trocado: copie a chave vigente de datajud-wiki.cnj.jus.br/api-publica/acesso para a variável DATAJUD_API_KEY.', 'DATAJUD_AUTH');
  }
  if (!r.ok) throw new ErroHttp(502, `Erro na API pública do CNJ (HTTP ${r.status}).`, 'DATAJUD');

  const dados = await r.json();
  const registros = ((dados.hits && dados.hits.hits) || [])
    .map((h) => h._source)
    .filter((s) => s && s.numeroProcesso === p.digitos);
  if (!registros.length) return null;
  return normalizar(registros, p, trib);
}

// Um mesmo processo pode ter vários registros (1º grau, 2º grau, turma recursal...). Juntamos tudo.
function normalizar(registros, p, trib) {
  registros.sort((a, b) => String(b.dataHoraUltimaAtualizacao || '').localeCompare(String(a.dataHoraUltimaAtualizacao || '')));
  const base = registros[0];

  const vistos = new Set();
  const movimentacoes = [];
  for (const reg of registros) {
    for (const m of reg.movimentos || []) {
      const chave = `${m.codigo}|${m.dataHora}|${m.nome}`;
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      const complementos = (m.complementosTabelados || []).map((c) => c.nome || c.descricao).filter(Boolean);
      movimentacoes.push({
        data: dataDJ(m.dataHora),
        titulo: m.nome || `Movimento ${m.codigo}`,
        descricao: complementos.join(' · '),
        codigo: m.codigo,
        fonte: [reg.tribunal, GRAUS[reg.grau] || reg.grau].filter(Boolean).join(' · '),
        orgao: (m.orgaoJulgador && m.orgaoJulgador.nome) || null
      });
    }
  }
  movimentacoes.sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')));

  const assuntos = [...new Set([base.assuntos || []].flat(3).map((a) => a && a.nome).filter(Boolean))];
  const situacao = estimarSituacao(movimentacoes);
  const graus = [...new Set(registros.map((r) => GRAUS[r.grau] || r.grau).filter(Boolean))];
  const inicio = registros.map((r) => dataDJ(r.dataAjuizamento)).filter(Boolean).sort()[0] || null;

  return {
    numero: p.formatado,
    tribunal: trib.sigla,
    tribunalNome: trib.nome,
    segmento: trib.segmento,
    grau: graus.join(', ') || null,
    classe: (base.classe && base.classe.nome) || null,
    assuntos,
    area: null,
    orgaoJulgador: (base.orgaoJulgador && base.orgaoJulgador.nome) || null,
    local: null,
    situacao,
    statusCategoria: categoriaSituacao(situacao),
    valorCausa: formatarValor(base.valorCausa),
    dataInicio: inicio,
    dataUltimaMovimentacao: movimentacoes[0] ? movimentacoes[0].data : null,
    quantidadeMovimentacoes: movimentacoes.length,
    segredoJustica: registros.some((r) => Number(r.nivelSigilo) > 0),
    sistema: (base.sistema && base.sistema.nome) || null,
    formato: (base.formato && base.formato.nome) || null,
    poloAtivo: null,
    poloPassivo: null,
    partes: [],
    papelConsultado: null,
    fontes: [{ sigla: 'DataJud', descricao: 'Base Nacional de Dados do Poder Judiciário (CNJ)', tipo: 'BASE_PUBLICA', url: null }],
    url: null,
    processosRelacionados: [],
    atualizadoEm: base.dataHoraUltimaAtualizacao || null,
    observacao: 'A base pública do CNJ não informa os nomes das partes nem o conteúdo das decisões (proteção de dados — LGPD). A situação é estimada a partir das movimentações.',
    movimentacoes,
    origem: 'DataJud (CNJ)'
  };
}
