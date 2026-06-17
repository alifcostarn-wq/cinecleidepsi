export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo nao permitido' });
  }

  const dados = req.body;
  if (!dados || !dados.nome) {
    return res.status(400).json({ error: 'Dados obrigatorios' });
  }

  const KEY = process.env.GROQ_API_KEY;
  if (!KEY) {
    return res.status(500).json({ error: 'Chave GROQ_API_KEY nao configurada' });
  }

  async function ia(prompt, max_tokens) {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + KEY
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: max_tokens || 1500,
        temperature: 0.6,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const d = await r.json();
    if (d.error) throw new Error(d.error.message || 'Erro IA');
    return (d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || '';
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
      'Linguagem tecnica, 3a pessoa, portugues brasileiro. Maximo 5 frases. Sem titulos. Responda apenas com o paragrafo.';

    const pProc = 'Voce e neuropsicologa. Escreva o paragrafo "Procedimento":\n' +
      'Modalidade: ' + (dados.modalidade || 'nao informado') + ' | Frequencia: ' + (dados.frequencia || 'nao informado') + ' | Duracao: ' + (dados.duracao || 'nao informado') + '\n' +
      'Areas: ' + (dados.areas || 'nao informado') + ' | Instrumentos: ' + (dados.instrumentos || 'nao informado') + '\n' +
      'Linguagem tecnica, 3a pessoa, portugues brasileiro. Maximo 5 frases. Sem titulos. Responda apenas com o paragrafo.';

    const pAnalise = 'Voce e uma equipe interprofissional (psicologa e psicopedagoga) elaborando a ANALISE CLINICA INTERPRETATIVA de ' + nome + ' (faixa etaria: ' + fl + '), diagnostico: ' + diag + '.\n\n' +
      'IMPORTANTE: NAO reescreva os dados. ANALISE clinicamente - interprete a significancia dos achados, correlacione os dados entre si, identifique padroes, relacione o historico de desenvolvimento com o quadro atual. Produza raciocinio clinico genuino. NAO sugira diagnosticos ou hipoteses diagnosticas.\n\n' +
      'DADOS:\n' +
      'Gestacional/perinatal: ' + (dados.gestacao || 'nao informado') + '\n' +
      'Desenvolvimento neuropsicomotor: ' + (dados.desenvolvimento || 'nao informado') + '\n' +
      'Comportamento atual (familia): ' + (dados.comportamento || 'nao informado') + '\n\n' +
      'CHECKLIST CLINICO (cada funcao avaliada como Preservada, Parcialmente preservada ou Comprometida):\n' + clStr + '\n\n' +
      'Observacoes psicologicas: ' + (dados.psicologico || 'nao informado') + '\n' +
      'Observacoes psicopedagogicas: ' + (dados.psicopedagogico || 'nao informado') + '\n' +
      (inssOn ? '\nInclua analise do impacto funcional nas AVDs para fins do INSS (CID: ' + dados.inss.cid + ').\n' : '') +
      '\nESTRUTURE A ANALISE ASSIM:\n' +
      '1. Paragrafo introdutorio: correlacione os dados gestacionais e os marcos do desenvolvimento com o quadro atual, interpretando sua relevancia clinica.\n' +
      '2. Comece com "Em acompanhamento Psicologico:" e faca analise interpretativa profunda dos dominios observados, discutindo o que os achados significam para o funcionamento da crianca, como os dominios se relacionam entre si, e a significancia clinica dos padroes (o que esta preservado e comprometido e o que isso implica funcionalmente). NAO liste itens - integre numa analise fluida.\n' +
      '3. Comece com "Em acompanhamento Psicopedagogico:" e analise o perfil cognitivo e seu impacto na aprendizagem.\n' +
      (inssOn ? '4. Comece com "Impacto funcional:" e analise as limitacoes objetivas nas AVDs.\n' : '') +
      'Linguagem tecnica, interpretativa e aprofundada. Paragrafos corridos, sem listas. 3a pessoa. Portugues brasileiro formal. Responda apenas com a analise.';

    const pConcl = 'Voce e neuropsicologa elaborando a CONCLUSAO do relatorio de ' + nome + ', diagnostico: ' + diag + '.\n' +
      'Produza uma sintese conclusiva que INTEGRE a analise clinica, articule a evolucao observada e fundamente as recomendacoes. NAO sugira novos diagnosticos.\n' +
      'Sintese clinica: ' + (dados.sintese || 'nao informado') + '\n' +
      'Recomendacoes: ' + (dados.recomendacoes || 'nao informado') + '\n' +
      'Finalidade: ' + fins + '\n' +
      (inssOn ? 'Inclua paragrafo tecnico fundamentando a solicitacao de ' + dados.inss.b + ' junto ao INSS, CID ' + dados.inss.cid + '.\n' : '') +
      'Inclua sintese integradora da evolucao e do quadro atual, fundamentacao das recomendacoes, e observacao sobre a natureza dinamica do desenvolvimento. Linguagem tecnica, 3a pessoa, portugues formal. Paragrafos corridos. Maximo 12 frases. Responda apenas com a conclusao.';

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
