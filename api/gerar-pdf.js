export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const dados = req.body;
  if (!dados || !dados.nome) return res.status(400).json({ error: 'Dados obrigatórios' });

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: 'Chave de API não configurada' });

  async function chamarIA(prompt, max_tokens = 1500) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens, messages: [{ role: 'user', content: prompt }] }),
    });
    const d = await r.json();
    return d.content?.[0]?.text || '';
  }

  try {
    const nome = dados.nome || 'o(a) paciente';
    const diag = dados.diagnostico || 'não informado';
    const fl = dados.faixa === 'a' ? '1 a 9 anos' : '10 a 15 anos';
    const fins = (dados.fins || []).join(', ') || 'compartilhamento interprofissional';
    const inssOn = !!dados.inss;
    const cl = dados.cl || [];
    const clStr = cl.length
      ? cl.map(d => `[${d.dominio}]\n` + d.itens.map(i => `- ${i.label}: ${i.estado}${i.obs ? ` (${i.obs})` : ''}`).join('\n')).join('\n\n')
      : '(nenhum item avaliado)';

    const [txtDemanda, txtProcedimento, txtAnalise, txtConclusao] = await Promise.all([
      chamarIA(`Você é neuropsicóloga. Escreva o parágrafo "Descrição da demanda":
Paciente: ${nome} | Diagnóstico: ${diag} | Início: ${dados.anoInicio||'não informado'} | Finalidade: ${fins}
Contexto: ${dados.contextoClinico||'não informado'}
${inssOn ? `Mencione solicitação de ${dados.inss.b} no INSS, CID: ${dados.inss.cid}.` : ''}
Linguagem técnica, 3ª pessoa, português. Máx. 5 frases. Sem títulos.`, 1200),

      chamarIA(`Você é neuropsicóloga. Escreva o parágrafo "Procedimento":
Modalidade: ${dados.modalidade||'não informado'} | Frequência: ${dados.frequencia||'não informado'} | Duração: ${dados.duracao||'não informado'}
Áreas: ${dados.areas||'não informado'} | Instrumentos: ${dados.instrumentos||'não informado'}
Linguagem técnica, 3ª pessoa, português. Máx. 5 frases. Sem títulos.`, 1000),

      chamarIA(`Você é equipe interprofissional (psicóloga e psicopedagoga). ANÁLISE CLÍNICA INTERPRETATIVA de ${nome} (faixa: ${fl}), diagnóstico: ${diag}.

NÃO reescreva os dados. ANALISE clinicamente — interprete a significância, correlacione os dados, identifique padrões. Raciocínio clínico genuíno. NÃO sugira diagnósticos.

Gestacional/perinatal: ${dados.gestacao||'não informado'}
Desenvolvimento: ${dados.desenvolvimento||'não informado'}
Comportamento (família): ${dados.comportamento||'não informado'}

CHECKLIST (estado de cada função):
${clStr}

Obs. psicológicas: ${dados.psicologico||'não informado'}
Obs. psicopedagógicas: ${dados.psicopedagogico||'não informado'}
${inssOn ? `\nInclua análise do impacto funcional nas AVDs para fins do INSS (CID: ${dados.inss.cid}).` : ''}

ESTRUTURE:
1. Parágrafo introdutório: correlacione histórico gestacional e desenvolvimento com o quadro atual.
2. "Em acompanhamento Psicológico:" — análise interpretativa profunda dos domínios, o que os achados significam funcionalmente, como se correlacionam. NÃO liste itens.
3. "Em acompanhamento Psicopedagógico:" — perfil cognitivo e impacto na aprendizagem.
${inssOn ? '4. "Impacto funcional:" — limitações objetivas nas AVDs.' : ''}
Parágrafos corridos, sem listas. Linguagem técnica interpretativa. 3ª pessoa. Português formal.`, 2500),

      chamarIA(`Neuropsicóloga. CONCLUSÃO do relatório de ${nome}, diagnóstico: ${diag}.
Síntese integradora que articule a evolução e fundamente as recomendações. NÃO sugira novos diagnósticos.
Síntese: ${dados.sintese||'não informado'} | Recomendações: ${dados.recomendacoes||'não informado'} | Finalidade: ${fins}
${inssOn ? `Inclua parágrafo para o INSS: ${dados.inss.b}, CID ${dados.inss.cid}.` : ''}
Linguagem técnica, 3ª pessoa, português formal. Máx. 12 frases.`, 1500),
    ]);

    // Gera HTML rico que será convertido para PDF pelo navegador via resposta
    // Retorna os textos gerados para o frontend montar o PDF via print
    res.status(200).json({ txtDemanda, txtProcedimento, txtAnalise, txtConclusao });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro: ' + err.message });
  }
}
