export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo nao permitido' });
  }

  const dados = req.body;
  if (!dados || !dados.nome) {
    return res.status(400).json({ error: 'Dados obrigatorios' });
  }

  const KEY = process.env.ANTHROPIC_API_KEY;
  if (!KEY) {
    return res.status(500).json({ error: 'Chave de API nao configurada' });
  }

  async function ia(prompt, max_tokens) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: max_tokens || 1500,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const d = await r.json();
    if (d.error) throw new Error(d.error.message || 'Erro IA');
    return (d.content && d.content[0] && d.content[0].text) || '';
  }

  try {
    const nome = dados.nome || 'o(a) paciente';
    const diag = dados.diagnostico || 'nao informado';
    const fl = dados.faixa === 'a' ? '1 a 9 anos' : '10 a 15 anos';
    const fins = (dados.fins || []).join(', ') || 'compartilhamento interprofissional';
    const inssOn = !!dados.inss;
    const cl = dados.cl || [];
    const clStr = cl.length
      ? cl.map(function(d) {
          return '[' + d.dominio + ']\n' + d.itens.map(function(i) {
            return '- ' + i.label + ': ' + i.estado + (i.obs ? ' (' + i.obs + ')' : '');
          }).join('\n');
        }).join('\n\n')
      : '(nenhum item avaliado)';

    const pDemanda = 'Voce e neuropsicologa. Escreva o paragrafo "Descricao da demanda":\n' +
      'Paciente: ' + nome + ' | Diagnostico: ' + diag + ' | Inicio: ' + (dados.anoInicio || 'nao informado') + ' | Finalidade: ' + fins + '\n' +
      'Contexto: ' + (dados.contextoClinico || 'nao informado') + '\n' +
      (inssOn ? 'Mencione solicitacao de ' + dados.inss.b + ' no INSS, CID: ' + dados.inss.cid + '.\n' : '') +
      'Linguagem tecnica, 3a pessoa, portugues. Max. 5 frases. Sem titulos.';

    const pProc = 'Voce e neuropsicologa. Escreva o paragrafo "Procedimento":\n' +
      'Modalidade: ' + (dados.modalidade || 'nao informado') + ' | Frequencia: ' + (dados.frequencia || 'nao informado') + ' | Duracao: ' + (dados.duracao || 'nao informado') + '\n' +
      'Areas: ' + (dados.areas || 'nao informado') + ' | Instrumentos: ' + (dados.instrumentos || 'nao informado') + '\n' +
      'Linguagem tecnica, 3a pessoa, portugues. Max. 5 frases. Sem titulos.';

    const pAnalise = 'Voce e equipe interprofissional (psicologa e psicopedagoga). ANALISE CLINICA INTERPRETATIVA de ' + nome + ' (faixa: ' + fl + '), diagnostico: ' + diag + '.\n\n' +
      'NAO reescreva os dados. ANALISE clinicamente - interprete a significancia, correlacione os dados, identifique padroes. Raciocinio clinico genuino. NAO sugira diagnosticos.\n\n' +
      'Gestacional/perinatal: ' + (dados.gestacao || 'nao informado') + '\n' +
      'Desenvolvimento: ' + (dados.desenvolvimento || 'nao informado') + '\n' +
      'Comportamento (familia): ' + (dados.comportamento || 'nao informado') + '\n\n' +
      'CHECKLIST (estado de cada funcao):\n' + clStr + '\n\n' +
      'Obs. psicologicas: ' + (dados.psicologico || 'nao informado') + '\n' +
      'Obs. psicopedagogicas: ' + (dados.psicopedagogico || 'nao informado') + '\n' +
      (inssOn ? '\nInclua analise do impacto funcional nas AVDs para fins do INSS (CID: ' + dados.inss.cid + ').\n' : '') +
      '\nESTRUTURE:\n' +
      '1. Paragrafo introdutorio: correlacione historico gestacional e desenvolvimento com o quadro atual.\n' +
      '2. "Em acompanhamento Psicologico:" - analise interpretativa profunda dos dominios, o que os achados significam funcionalmente, como se correlacionam. NAO liste itens.\n' +
      '3. "Em acompanhamento Psicopedagogico:" - perfil cognitivo e impacto na aprendizagem.\n' +
      (inssOn ? '4. "Impacto funcional:" - limitacoes objetivas nas AVDs.\n' : '') +
      'Paragrafos corridos, sem listas. Linguagem tecnica interpretativa. 3a pessoa. Portugues formal.';

    const pConcl = 'Neuropsicologa. CONCLUSAO do relatorio de ' + nome + ', diagnostico: ' + diag + '.\n' +
      'Sintese integradora que articule a evolucao e fundamente as recomendacoes. NAO sugira novos diagnosticos.\n' +
      'Sintese: ' + (dados.sintese || 'nao informado') + ' | Recomendacoes: ' + (dados.recomendacoes || 'nao informado') + ' | Finalidade: ' + fins + '\n' +
      (inssOn ? 'Inclua paragrafo para o INSS: ' + dados.inss.b + ', CID ' + dados.inss.cid + '.\n' : '') +
      'Linguagem tecnica, 3a pessoa, portugues formal. Max. 12 frases.';

    const results = await Promise.all([
      ia(pDemanda, 1200),
      ia(pProc, 1000),
      ia(pAnalise, 2500),
      ia(pConcl, 1500)
    ]);

    return res.status(200).json({
      txtDemanda: results[0],
      txtProcedimento: results[1],
      txtAnalise: results[2],
      txtConclusao: results[3]
    });

  } catch (err) {
    return res.status(500).json({ error: 'Erro: ' + (err.message || String(err)) });
  }
}
