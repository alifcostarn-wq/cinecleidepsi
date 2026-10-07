// GET /api/processo?numero=NNNNNNN-DD.AAAA.J.TR.OOOO[&capa=0][&demo=1]
// Dados completos e movimentações de um processo. Usa o Escavador (se configurado)
// e, como alternativa gratuita, a API pública do DataJud (CNJ).
import { ErroHttp, responderErro, semCache, exigirMetodo, exigirSenha, parseCNJ } from './_lib/util.js';
import { escavadorAtivo, buscarProcesso } from './_lib/escavador.js';
import { buscarProcessoDatajud } from './_lib/datajud.js';
import { demoProcesso } from './_lib/demo.js';

export default async function handler(req, res) {
  semCache(res);
  try {
    exigirMetodo(req, 'GET');
    exigirSenha(req);
    const q = req.query || {};
    const p = parseCNJ(q.numero);
    if (!p) throw new ErroHttp(400, 'O número do processo deve ter 20 dígitos (formato NNNNNNN-DD.AAAA.J.TR.OOOO).', 'NUMERO_INVALIDO');
    if (!p.valido) throw new ErroHttp(400, 'Número de processo inválido: o dígito verificador não confere. Confira o número digitado.', 'NUMERO_INVALIDO');

    if (q.demo === '1') {
      const demo = demoProcesso(p.formatado);
      if (!demo) throw new ErroHttp(404, 'Processo de demonstração não encontrado.', 'NAO_ENCONTRADO');
      return res.status(200).json({ processo: demo, fonte: demo.origem, aviso: null });
    }

    let processo = null;
    let fonte = null;
    let aviso = null;
    if (escavadorAtivo()) {
      try {
        processo = await buscarProcesso(p.formatado, { capa: q.capa !== '0' });
        if (processo) fonte = 'Escavador';
      } catch (e) {
        if (!(e instanceof ErroHttp)) throw e;
        aviso = e.message + ' Usando a base pública do CNJ.';
      }
    }
    if (!processo) {
      processo = await buscarProcessoDatajud(p);
      fonte = 'DataJud (CNJ)';
    }
    if (!processo) {
      throw new ErroHttp(404, 'Processo não encontrado. Confira o número ou tente mais tarde — alguns tribunais demoram a enviar dados ao CNJ.', 'NAO_ENCONTRADO');
    }
    res.status(200).json({ processo, fonte, aviso });
  } catch (e) {
    responderErro(res, e);
  }
}
