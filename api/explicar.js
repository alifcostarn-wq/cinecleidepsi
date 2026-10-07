// POST /api/explicar  { processo: {...} }
// A IA "traduz" a situação do processo e aponta os próximos passos prováveis.
import { ErroHttp, responderErro, semCache, exigirMetodo, exigirSenha, lerCorpo } from './_lib/util.js';
import { gerarJSON } from './_lib/ia.js';
import { montarPedido, sanitizarExplicacao } from './_lib/explicacao.js';

export default async function handler(req, res) {
  semCache(res);
  try {
    exigirMetodo(req, 'POST');
    exigirSenha(req);
    const { processo } = lerCorpo(req);
    if (!processo || typeof processo !== 'object' || !processo.numero) {
      throw new ErroHttp(400, 'Envie os dados do processo para gerar a explicação.', 'SEM_PROCESSO');
    }
    const { sistema, usuario } = montarPedido(processo);
    const { dados, provedor, modelo } = await gerarJSON({ sistema, usuario, maxTokens: 4000 });
    res.status(200).json({
      explicacao: sanitizarExplicacao(dados),
      provedor,
      modelo,
      geradoEm: new Date().toISOString()
    });
  } catch (e) {
    responderErro(res, e);
  }
}
