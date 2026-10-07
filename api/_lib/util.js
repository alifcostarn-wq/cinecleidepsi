// Utilitários compartilhados pelas funções da pasta /api.
// Arquivos dentro de pastas iniciadas por "_" não viram rotas no Vercel.
import { timingSafeEqual } from 'node:crypto';

export class ErroHttp extends Error {
  constructor(status, mensagem, codigo) {
    super(mensagem);
    this.status = status;
    this.codigo = codigo || null;
  }
}

export function responderErro(res, err) {
  const status = err instanceof ErroHttp ? err.status : 500;
  if (!(err instanceof ErroHttp)) console.error(err);
  res.status(status).json({
    erro: err instanceof ErroHttp ? err.message : 'Erro interno: ' + (err && err.message ? err.message : String(err)),
    codigo: err.codigo || null
  });
}

export function semCache(res) {
  res.setHeader('Cache-Control', 'no-store');
}

export function exigirMetodo(req, metodo) {
  if (req.method !== metodo) throw new ErroHttp(405, 'Método não permitido.', 'METODO');
}

// Se SENHA_ACESSO estiver configurada, todas as consultas exigem o cabeçalho x-senha-acesso.
export function exigirSenha(req) {
  const senha = process.env.SENHA_ACESSO;
  if (!senha) return;
  const enviada = Buffer.from(String(req.headers['x-senha-acesso'] || ''));
  const esperada = Buffer.from(senha);
  if (enviada.length !== esperada.length || !timingSafeEqual(enviada, esperada)) {
    throw new ErroHttp(401, 'Senha de acesso inválida.', 'SENHA');
  }
}

export function lerCorpo(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { throw new ErroHttp(400, 'JSON inválido.', 'JSON'); }
  }
  return req.body;
}

export async function fetchComTimeout(url, opcoes = {}, ms = 25000, servico = 'serviço externo') {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opcoes, signal: ctrl.signal });
  } catch (e) {
    if (e.name === 'AbortError') throw new ErroHttp(504, `O ${servico} demorou demais para responder. Tente novamente.`, 'TIMEOUT');
    throw new ErroHttp(502, `Falha ao conectar ao ${servico}: ${e.message}`, 'REDE');
  } finally {
    clearTimeout(timer);
  }
}

// ── Documentos ──────────────────────────────────────────────

export function soAlfanumerico(v) {
  return String(v || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
}

export function validarCPF(cpf) {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const dv = (tam) => {
    let soma = 0;
    for (let i = 0; i < tam; i++) soma += Number(cpf[i]) * (tam + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return dv(9) === Number(cpf[9]) && dv(10) === Number(cpf[10]);
}

// Aceita o CNPJ numérico e o novo CNPJ alfanumérico (IN RFB 2.229/2024, em vigor desde jul/2026).
export function validarCNPJ(cnpj) {
  if (!/^[0-9A-Z]{12}\d{2}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return false;
  const valor = (c) => c.charCodeAt(0) - 48;
  const dv = (tam) => {
    const pesos = tam === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let soma = 0;
    for (let i = 0; i < tam; i++) soma += valor(cnpj[i]) * pesos[i];
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  return dv(12) === Number(cnpj[12]) && dv(13) === Number(cnpj[13]);
}

export function identificarEntrada(valor) {
  const v = soAlfanumerico(valor);
  if (/^\d{20}$/.test(v)) return { tipo: 'PROCESSO', valor: v };
  if (/^\d{11}$/.test(v)) return { tipo: 'CPF', valor: v };
  if (/^[0-9A-Z]{12}\d{2}$/.test(v)) return { tipo: 'CNPJ', valor: v };
  return { tipo: null, valor: v };
}

export function formatarDocumento(tipo, v) {
  if (tipo === 'CPF') return v.replace(/^(.{3})(.{3})(.{3})(.{2})$/, '$1.$2.$3-$4');
  if (tipo === 'CNPJ') return v.replace(/^(.{2})(.{3})(.{3})(.{4})(.{2})$/, '$1.$2.$3/$4-$5');
  return v;
}

export function normalizarNome(n) {
  return String(n || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
}

// ── Número CNJ (Resolução CNJ 65/2008): NNNNNNN-DD.AAAA.J.TR.OOOO ──

export function parseCNJ(numero) {
  const d = String(numero || '').replace(/\D/g, '');
  if (d.length !== 20) return null;
  const p = {
    digitos: d,
    sequencial: d.slice(0, 7),
    dv: d.slice(7, 9),
    ano: d.slice(9, 13),
    segmento: d.slice(13, 14),
    tribunal: d.slice(14, 16),
    origem: d.slice(16, 20)
  };
  p.formatado = `${p.sequencial}-${p.dv}.${p.ano}.${p.segmento}.${p.tribunal}.${p.origem}`;
  p.valido = BigInt(p.sequencial + p.ano + p.segmento + p.tribunal + p.origem + p.dv) % 97n === 1n;
  return p;
}

const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SE', 'SP', 'TO'];
const UF_NOME = {
  AC: 'do Acre', AL: 'de Alagoas', AP: 'do Amapá', AM: 'do Amazonas', BA: 'da Bahia', CE: 'do Ceará',
  DF: 'do Distrito Federal e Territórios', ES: 'do Espírito Santo', GO: 'de Goiás', MA: 'do Maranhão',
  MT: 'de Mato Grosso', MS: 'de Mato Grosso do Sul', MG: 'de Minas Gerais', PA: 'do Pará', PB: 'da Paraíba',
  PR: 'do Paraná', PE: 'de Pernambuco', PI: 'do Piauí', RJ: 'do Rio de Janeiro', RN: 'do Rio Grande do Norte',
  RS: 'do Rio Grande do Sul', RO: 'de Rondônia', RR: 'de Roraima', SC: 'de Santa Catarina', SE: 'de Sergipe',
  SP: 'de São Paulo', TO: 'do Tocantins'
};
const SEGMENTOS = {
  1: 'Supremo Tribunal Federal', 2: 'Conselho Nacional de Justiça', 3: 'Superior Tribunal de Justiça',
  4: 'Justiça Federal', 5: 'Justiça do Trabalho', 6: 'Justiça Eleitoral', 7: 'Justiça Militar da União',
  8: 'Justiça Estadual', 9: 'Justiça Militar Estadual'
};

// Descobre o tribunal a partir do número CNJ e o "alias" correspondente na API pública do DataJud.
export function tribunalDoCNJ(p) {
  const j = Number(p.segmento);
  const tr = Number(p.tribunal);
  const uf = UFS[tr - 1];
  const r = { segmento: SEGMENTOS[j] || 'Justiça', sigla: null, nome: null, aliasDatajud: null };
  switch (j) {
    case 1: Object.assign(r, { sigla: 'STF', nome: 'Supremo Tribunal Federal' }); break;
    case 2: Object.assign(r, { sigla: 'CNJ', nome: 'Conselho Nacional de Justiça' }); break;
    case 3: Object.assign(r, { sigla: 'STJ', nome: 'Superior Tribunal de Justiça', aliasDatajud: 'stj' }); break;
    case 4:
      if (tr >= 1 && tr <= 6) Object.assign(r, { sigla: `TRF-${tr}`, nome: `Tribunal Regional Federal da ${tr}ª Região`, aliasDatajud: `trf${tr}` });
      else Object.assign(r, { sigla: 'CJF', nome: 'Conselho da Justiça Federal' });
      break;
    case 5:
      if (tr === 0) Object.assign(r, { sigla: 'TST', nome: 'Tribunal Superior do Trabalho', aliasDatajud: 'tst' });
      else if (tr >= 1 && tr <= 24) Object.assign(r, { sigla: `TRT-${tr}`, nome: `Tribunal Regional do Trabalho da ${tr}ª Região`, aliasDatajud: `trt${tr}` });
      else Object.assign(r, { sigla: 'CSJT', nome: 'Conselho Superior da Justiça do Trabalho' });
      break;
    case 6:
      if (tr === 0) Object.assign(r, { sigla: 'TSE', nome: 'Tribunal Superior Eleitoral', aliasDatajud: 'tse' });
      else if (uf) Object.assign(r, { sigla: `TRE-${uf}`, nome: `Tribunal Regional Eleitoral ${UF_NOME[uf]}`, aliasDatajud: `tre-${uf === 'DF' ? 'dft' : uf.toLowerCase()}` });
      break;
    case 7: Object.assign(r, { sigla: 'STM', nome: 'Superior Tribunal Militar', aliasDatajud: 'stm' }); break;
    case 8:
      if (uf === 'DF') Object.assign(r, { sigla: 'TJDFT', nome: 'Tribunal de Justiça do Distrito Federal e dos Territórios', aliasDatajud: 'tjdft' });
      else if (uf) Object.assign(r, { sigla: `TJ${uf}`, nome: `Tribunal de Justiça ${UF_NOME[uf]}`, aliasDatajud: `tj${uf.toLowerCase()}` });
      break;
    case 9: {
      const tjm = { 13: 'MG', 21: 'RS', 26: 'SP' }[tr];
      if (tjm) Object.assign(r, { sigla: `TJM-${tjm}`, nome: `Tribunal de Justiça Militar ${UF_NOME[tjm]}`, aliasDatajud: `tjm${tjm.toLowerCase()}` });
      break;
    }
  }
  if (!r.sigla) Object.assign(r, { sigla: `J${p.segmento}.TR${p.tribunal}`, nome: r.segmento });
  return r;
}

// Classifica um texto de situação em "ativo" ou "arquivado" para filtros e etiquetas.
export function categoriaSituacao(texto) {
  const t = normalizarNome(texto);
  if (!t) return 'desconhecido';
  if (/DESARQUIV/.test(t)) return 'ativo';
  if (/ARQUIV|BAIXAD|EXTINT|ENCERRAD|INATIV|FINALIZAD/.test(t)) return 'arquivado';
  if (/SUSPENS|SOBREST/.test(t)) return 'suspenso';
  return 'ativo';
}
