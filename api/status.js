// Informa ao front-end quais integrações estão configuradas (sem expor nenhuma chave).
import { semCache } from './_lib/util.js';
import { escavadorAtivo } from './_lib/escavador.js';
import { provedorIA } from './_lib/ia.js';

export default function handler(req, res) {
  semCache(res);
  res.status(200).json({
    buscaDocumento: escavadorAtivo() ? 'Escavador' : null,
    datajud: true,
    ia: provedorIA(),
    senhaObrigatoria: !!process.env.SENHA_ACESSO
  });
}
