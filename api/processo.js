// GET /api/processo?numero=NNNNNNN-DD.AAAA.J.TR.OOOO[&capa=0][&demo=1]
// Dados completos e movimentações de um processo. Usa o Escavador (se configurado)
// e, como alternativa gratuita, as bases públicas do CNJ: DataJud e DJEN.
import { ErroHttp, responderErro, semCache, exigirMetodo, exigirSenha, parseCNJ, tribunalDoCNJ } from './_lib/util.js';
import { escavadorAtivo, buscarProcesso } from './_lib/escavador.js';
import { buscarProcessoDatajud } from './_lib/datajud.js';
import { buscarComunicacoesDjen, mesclarDjen, processoDoDjen } from './_lib/djen.js';
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
    const avisos = [];
    if (escavadorAtivo()) {
      try {
        processo = await buscarProcesso(p.formatado, { capa: q.capa !== '0' });
      } catch (e) {
        if (!(e instanceof ErroHttp)) throw e;
        avisos.push(e.message + ' Usando as bases públicas do CNJ.');
      }
    }

    // Bases públicas do CNJ, consultadas em paralelo: DataJud (capa e movimentações)
    // e DJEN (partes, advogados e texto das publicações).
    if (!processo) {
      const [datajud, djen] = await Promise.allSettled([buscarProcessoDatajud(p), buscarComunicacoesDjen(p)]);
      const temDjen = djen.status === 'fulfilled' && djen.value.publicacoes.length > 0;
      if (datajud.status === 'rejected' && !temDjen) throw datajud.reason;
      processo = datajud.status === 'fulfilled' ? datajud.value : null;
      if (temDjen) processo = mesclarDjen(processo || processoDoDjen(p, djen.value, tribunalDoCNJ(p)), djen.value);
      if (datajud.status === 'rejected' && temDjen) avisos.push(datajud.reason.message + ' Mostrando só as publicações do Diário de Justiça.');
      if (djen.status === 'rejected') avisos.push('Não foi possível carregar as publicações do Diário de Justiça Eletrônico Nacional: ' + djen.reason.message);
    }

    if (!processo) {
      throw new ErroHttp(404, 'Processo não encontrado. Confira o número ou tente mais tarde — alguns tribunais demoram a enviar dados ao CNJ.', 'NAO_ENCONTRADO');
    }
    res.status(200).json({ processo, fonte: processo.origem || 'Escavador', aviso: avisos.join(' ') || null });
  } catch (e) {
    responderErro(res, e);
  }
}
