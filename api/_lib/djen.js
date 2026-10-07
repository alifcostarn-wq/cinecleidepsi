// Conector do Diário de Justiça Eletrônico Nacional (DJEN / Comunica PJe — CNJ).
// Gratuito e sem chave. Traz o texto integral das intimações e decisões publicadas,
// com os nomes das partes e dos advogados intimados — o que a base do DataJud não tem.
// Atenção: o serviço só aceita conexões vindas do Brasil (por isso as funções rodam em gru1).
import { ErroHttp, fetchComTimeout, normalizarNome } from './util.js';

const BASE = 'https://comunicaapi.pje.jus.br/api/v1/comunicacao';
const LIMITE_TEXTO = 8000;
const POLOS = { A: 'ATIVO', P: 'PASSIVO' };

const ENTIDADES = {
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", ordm: 'º', ordf: 'ª', sect: '§', para: '¶', deg: '°',
  ndash: '–', mdash: '—', hellip: '…', middot: '·', bull: '•', laquo: '«', raquo: '»',
  ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', szlig: 'ß', aelig: 'æ', AElig: 'Æ', oslash: 'ø', Oslash: 'Ø'
};
// Acentos (&aacute; &atilde; &ccedil; &Ecirc; ...): letra base + sinal diacrítico combinante.
const DIACRITICOS = { acute: '\u0301', grave: '\u0300', circ: '\u0302', tilde: '\u0303', uml: '\u0308', cedil: '\u0327', ring: '\u030A' };

function entidade(nome) {
  if (ENTIDADES[nome] !== undefined) return ENTIDADES[nome];
  if (ENTIDADES[nome.toLowerCase()] !== undefined) return ENTIDADES[nome.toLowerCase()];
  const m = nome.match(/^([a-zA-Z])(acute|grave|circ|tilde|uml|cedil|ring)$/);
  return m ? (m[1] + DIACRITICOS[m[2]]).normalize('NFC') : null;
}

export function htmlParaTexto(html) {
  return String(html || '')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/\s*(p|div|li|tr|h\d)\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => {
      if (e[0] === '#') {
        const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : m;
      }
      return entidade(e) ?? m;
    })
    .replace(/[ \t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const digitos = (v) => String(v || '').replace(/\D/g, '');

function dataISO(it) {
  const v = it.data_disponibilizacao || it.dataDisponibilizacao || it.datadisponibilizacao || '';
  const br = String(v).match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  return br ? `${br[3]}-${br[2]}-${br[1]}` : (String(v).slice(0, 10) || null);
}

export async function buscarComunicacoesDjen(p) {
  const url = new URL(BASE);
  url.searchParams.set('numeroProcesso', p.digitos);
  url.searchParams.set('pagina', '1');
  url.searchParams.set('itensPorPagina', '100');
  const r = await fetchComTimeout(url, { headers: { Accept: 'application/json' } }, 20000, 'Diário de Justiça Eletrônico Nacional (DJEN)');
  if (r.status === 403) throw new ErroHttp(502, 'O Diário de Justiça Eletrônico Nacional recusou a conexão (ele só aceita acessos a partir do Brasil).', 'DJEN_BLOQUEADO');
  if (r.status === 429) throw new ErroHttp(429, 'O Diário de Justiça Eletrônico Nacional limitou as consultas. Tente de novo em alguns segundos.', 'DJEN_LIMITE');
  if (!r.ok) throw new ErroHttp(502, `Erro no Diário de Justiça Eletrônico Nacional (HTTP ${r.status}).`, 'DJEN');
  const d = await r.json().catch(() => ({}));
  const itens = (d.items || d.itens || []).filter((it) =>
    digitos(it.numero_processo || it.numeroProcesso || it.numeroprocessocommascara) === p.digitos);
  return normalizar(itens);
}

function normalizar(itens) {
  const partes = new Map();
  const advogados = new Map();
  const publicacoes = [];

  for (const it of itens) {
    for (const dest of it.destinatarios || []) {
      if (!dest || !dest.nome) continue;
      const polo = POLOS[String(dest.polo || '').toUpperCase()] || 'OUTROS';
      const chave = normalizarNome(dest.nome) + '|' + polo;
      if (!partes.has(chave)) partes.set(chave, { nome: dest.nome.trim(), tipo: null, polo, tipoPessoa: null, advogados: [] });
    }
    for (const da of it.destinatarioadvogados || it.destinatarioAdvogados || []) {
      const adv = (da && (da.advogado || da)) || {};
      if (!adv.nome) continue;
      const oab = adv.numero_oab ? `${adv.numero_oab}${adv.uf_oab ? '/' + adv.uf_oab : ''}` : '';
      const chave = normalizarNome(adv.nome);
      if (!advogados.has(chave)) advogados.set(chave, { nome: adv.nome.trim(), oab });
    }

    let texto = htmlParaTexto(it.texto);
    if (texto.length > LIMITE_TEXTO) texto = texto.slice(0, LIMITE_TEXTO) + '…';
    const tipo = [it.tipoComunicacao, it.tipoDocumento].filter(Boolean).join(' — ');
    publicacoes.push({
      data: dataISO(it),
      titulo: tipo || 'Publicação no Diário',
      descricao: texto,
      fonte: ['DJEN', it.siglaTribunal].filter(Boolean).join(' · '),
      orgao: it.nomeOrgao || null,
      link: /^https?:\/\//i.test(it.link || '') ? it.link : null,
      publicacao: true
    });
  }
  publicacoes.sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')));

  const ultimo = itens[0] || {};
  return {
    publicacoes,
    partes: [...partes.values()],
    advogados: [...advogados.values()],
    classe: ultimo.nomeClasse || null,
    orgao: ultimo.nomeOrgao || null,
    tribunal: ultimo.siglaTribunal || null
  };
}

function tituloPolo(partes, polo) {
  const lista = partes.filter((x) => x.polo === polo);
  if (!lista.length) return null;
  return lista[0].nome + (lista.length > 1 ? ` e outros (${lista.length - 1})` : '');
}

// Junta as informações do DJEN a um processo vindo do DataJud (ou cria um processo só com elas).
export function mesclarDjen(processo, djen) {
  const movimentacoes = [...(processo.movimentacoes || []), ...djen.publicacoes]
    .sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')));
  const partes = processo.partes && processo.partes.length ? processo.partes : djen.partes;
  return {
    ...processo,
    classe: processo.classe || djen.classe,
    orgaoJulgador: processo.orgaoJulgador || djen.orgao,
    partes,
    advogados: djen.advogados,
    poloAtivo: processo.poloAtivo || tituloPolo(partes, 'ATIVO'),
    poloPassivo: processo.poloPassivo || tituloPolo(partes, 'PASSIVO'),
    movimentacoes,
    quantidadeMovimentacoes: movimentacoes.length,
    dataUltimaMovimentacao: movimentacoes[0] ? movimentacoes[0].data : processo.dataUltimaMovimentacao,
    quantidadePublicacoes: djen.publicacoes.length,
    origem: processo.origem === 'DJEN' ? 'DJEN' : `${processo.origem} + DJEN`,
    fontes: [...(processo.fontes || []), { sigla: 'DJEN', descricao: 'Diário de Justiça Eletrônico Nacional (CNJ)', tipo: 'DIARIO_OFICIAL', url: null }],
    observacao: djen.publicacoes.length
      ? 'Partes, advogados e textos das publicações vêm do Diário de Justiça Eletrônico Nacional (DJEN). As partes listadas são as pessoas intimadas nas publicações e podem não incluir todos os envolvidos. As demais movimentações vêm da base pública do CNJ (DataJud), que não traz o conteúdo dos atos.'
      : processo.observacao
  };
}

// Processo montado só com o DJEN, para quando a base do DataJud ainda não tem o número.
export function processoDoDjen(p, djen, trib) {
  return {
    numero: p.formatado,
    tribunal: djen.tribunal || trib.sigla,
    tribunalNome: trib.nome,
    segmento: trib.segmento,
    grau: null,
    classe: djen.classe,
    assuntos: [],
    area: null,
    orgaoJulgador: djen.orgao,
    local: null,
    situacao: null,
    statusCategoria: 'desconhecido',
    valorCausa: null,
    dataInicio: null,
    segredoJustica: false,
    sistema: null,
    partes: [],
    papelConsultado: null,
    fontes: [],
    url: null,
    processosRelacionados: [],
    atualizadoEm: null,
    movimentacoes: [],
    origem: 'DJEN'
  };
}
