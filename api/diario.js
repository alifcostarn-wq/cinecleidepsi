// GET /api/diario?nome=NOME_DA_PARTE[&periodo=365][&pagina=N]
// GET /api/diario?oab=NUMERO&uf=UF[&periodo=365][&pagina=N]
// Busca gratuita no Diário de Justiça Eletrônico Nacional (DJEN/CNJ): encontra os processos
// com publicações em nome de uma parte ou de um(a) advogado(a). Alternativa à busca por CPF/CNPJ.
import { ErroHttp, responderErro, semCache, exigirMetodo, exigirSenha, UFS } from './_lib/util.js';
import { buscarProcessosNoDiario } from './_lib/djen.js';

const ROTULO_PERIODO = { 30: 'últimos 30 dias', 180: 'últimos 6 meses', 365: 'últimos 12 meses', 730: 'últimos 2 anos', todos: 'todo o período' };

export default async function handler(req, res) {
  semCache(res);
  try {
    exigirMetodo(req, 'GET');
    exigirSenha(req);
    const q = req.query || {};
    const periodo = ROTULO_PERIODO[q.periodo] ? String(q.periodo) : '365';
    const pagina = Math.max(1, Math.min(1000, parseInt(q.pagina, 10) || 1));

    let busca;
    if (q.oab !== undefined) {
      const oab = String(q.oab).toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/^0+(?=\d)/, '');
      const uf = String(q.uf || '').toUpperCase();
      if (!/^\d{1,7}[A-Z]?$/.test(oab)) throw new ErroHttp(400, 'Informe o número da OAB (só números, com letra final se houver, por exemplo 123456 ou 12345A).', 'OAB_INVALIDA');
      if (!UFS.includes(uf)) throw new ErroHttp(400, 'Escolha o estado (UF) da inscrição na OAB.', 'UF_INVALIDA');
      busca = { oab, uf, tipo: 'OAB', rotulo: 'Advogado(a) consultado(a)', termo: `OAB ${oab}/${uf}` };
    } else {
      const nome = String(q.nome || '').replace(/\s+/g, ' ').trim();
      const letras = (nome.match(/\p{L}/gu) || []).length;
      if (nome.length > 120) throw new ErroHttp(400, 'O nome está muito longo (máximo de 120 caracteres).', 'NOME_INVALIDO');
      if (letras < 4 || /\d{5,}/.test(nome)) throw new ErroHttp(400, 'Digite o nome da pessoa ou da empresa (pelo menos 4 letras). Para CPF, CNPJ ou número do processo, use a primeira aba.', 'NOME_INVALIDO');
      busca = { nome, tipo: 'NOME', rotulo: 'Nome da parte consultado', termo: nome };
    }

    const r = await buscarProcessosNoDiario({ nome: busca.nome, oab: busca.oab, uf: busca.uf, periodo, pagina });
    res.status(200).json({
      tipoDocumento: busca.tipo,
      rotuloConsulta: busca.rotulo,
      documento: busca.termo,
      periodo: ROTULO_PERIODO[periodo],
      envolvido: busca.tipo === 'NOME' ? { nome: busca.nome, tipoPessoa: null, quantidadeProcessos: null } : null,
      processos: r.processos,
      totalPublicacoes: r.totalPublicacoes,
      proximaPagina: r.proximaPagina,
      fonte: 'DJEN — Diário de Justiça Eletrônico Nacional',
      demo: false
    });
  } catch (e) {
    responderErro(res, e);
  }
}
