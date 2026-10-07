// GET /api/consulta?documento=CPF_OU_CNPJ[&pagina=...][&demo=1]
// Lista os processos em que o CPF/CNPJ aparece como parte.
import {
  ErroHttp, responderErro, semCache, exigirMetodo, exigirSenha,
  identificarEntrada, validarCPF, validarCNPJ, formatarDocumento
} from './_lib/util.js';
import { escavadorAtivo, buscarPorDocumento } from './_lib/escavador.js';
import { demoConsulta } from './_lib/demo.js';

export default async function handler(req, res) {
  semCache(res);
  try {
    exigirMetodo(req, 'GET');
    exigirSenha(req);
    const q = req.query || {};
    if (q.demo === '1') return res.status(200).json(demoConsulta());

    const ent = identificarEntrada(q.documento);
    if (ent.tipo === 'CPF' && !validarCPF(ent.valor)) throw new ErroHttp(400, 'CPF inválido. Confira os números digitados.', 'DOC_INVALIDO');
    if (ent.tipo === 'CNPJ' && !validarCNPJ(ent.valor)) throw new ErroHttp(400, 'CNPJ inválido. Confira os caracteres digitados.', 'DOC_INVALIDO');
    if (ent.tipo !== 'CPF' && ent.tipo !== 'CNPJ') throw new ErroHttp(400, 'Informe um CPF (11 dígitos) ou um CNPJ (14 caracteres).', 'DOC_INVALIDO');

    if (!escavadorAtivo()) {
      throw new ErroHttp(501,
        'A busca por CPF/CNPJ precisa de um provedor de dados configurado (variável ESCAVADOR_API_KEY). ' +
        'Os tribunais não oferecem busca pública por documento sem login gov.br. ' +
        'Enquanto isso, você pode consultar pelo número do processo (gratuito, base do CNJ) ou ver a demonstração.',
        'SEM_PROVEDOR');
    }

    const r = await buscarPorDocumento(ent.valor, q.pagina);
    res.status(200).json({
      tipoDocumento: ent.tipo,
      documento: formatarDocumento(ent.tipo, ent.valor),
      ...r,
      fonte: 'Escavador',
      demo: false
    });
  } catch (e) {
    responderErro(res, e);
  }
}
