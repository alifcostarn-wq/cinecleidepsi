// Monta o pedido para a IA "traduzir" o processo e valida a resposta.

const LIMITE_MOVIMENTACOES = 40;

const SISTEMA = `Você é um assistente que traduz processos judiciais brasileiros para pessoas leigas.
Seu trabalho é explicar, com linguagem simples, clara e respeitosa, em que pé o processo está e o que costuma acontecer a seguir.

Regras obrigatórias:
1. Use SOMENTE os dados fornecidos. Não invente fatos, valores, nomes, decisões ou datas. Se algo não puder ser concluído a partir dos dados, diga isso claramente.
2. Escreva em português do Brasil, sem juridiquês. Quando usar um termo técnico, explique-o em seguida ou inclua-o no glossário.
3. Ao prever os próximos passos, baseie-se nas regras processuais que se aplicam ao tipo de ação e à fase atual (por exemplo: CPC, CLT, Lei 9.099/95 dos Juizados Especiais, CPP, Lei 6.830/80 de Execução Fiscal) e indique a probabilidade de cada cenário: "alta", "media" ou "baixa". Prazos citados devem ser os prazos legais gerais, deixando claro que podem variar.
4. Nunca garanta resultado e não opine sobre quem tem razão.
5. Se o processo estiver em segredo de justiça ou com poucos dados, explique o que dá para saber e o que não dá.
6. Leve em conta a data de hoje para dizer há quanto tempo o processo está parado ou se um prazo provavelmente já passou.
7. Responda APENAS com um objeto JSON válido, sem nenhum texto antes ou depois, exatamente neste formato:

{
  "resumo": "2 a 4 frases: do que se trata o processo, quem está de cada lado e o que se pede",
  "fase": "nome curto da fase atual, ex.: Aguardando sentença, Fase de recurso, Cumprimento de sentença, Execução, Arquivado",
  "situacaoAtual": "tradução, em 2 a 5 frases, do momento atual do processo e do significado da última movimentação relevante",
  "papelDoConsultado": "o que significa, na prática, a pessoa consultada estar nessa posição no processo (deixe vazio se não houver pessoa consultada)",
  "ultimosAcontecimentos": [{ "data": "AAAA-MM-DD", "traducao": "o que essa movimentação significa em linguagem simples" }],
  "proximosPassos": [{ "titulo": "o que pode acontecer", "descricao": "explicação simples", "probabilidade": "alta|media|baixa", "prazoEstimado": "prazo legal típico ou estimativa, se houver" }],
  "pontosDeAtencao": ["prazos, riscos ou cuidados importantes"],
  "glossario": [{ "termo": "termo jurídico usado", "significado": "explicação simples" }],
  "recomendacao": "orientação prática e prudente, ex.: acompanhar intimações, procurar advogado ou Defensoria Pública"
}

Use no máximo 5 itens em "ultimosAcontecimentos", de 3 a 5 em "proximosPassos", até 5 em "pontosDeAtencao" e até 8 no "glossario".`;

const corta = (v, max) => {
  const s = String(v ?? '').replace(/\s+/g, ' ').trim();
  return s.length > max ? s.slice(0, max) + '…' : s;
};

const ROTULO_POLO = { ATIVO: 'polo ativo', PASSIVO: 'polo passivo' };

export function montarPedido(p, hoje = new Date()) {
  const linhas = [];
  const add = (rotulo, valor) => { if (valor !== null && valor !== undefined && valor !== '') linhas.push(`${rotulo}: ${valor}`); };

  linhas.push(`Data de hoje: ${hoje.toISOString().slice(0, 10)}`);
  add('Número do processo', corta(p.numero, 40));
  add('Tribunal', [p.tribunal, p.tribunalNome].filter(Boolean).map((v) => corta(v, 120)).join(' — '));
  add('Ramo da Justiça', corta(p.segmento, 60));
  add('Grau / instância', corta(p.grau, 80));
  add('Classe (tipo de ação)', corta(p.classe, 160));
  add('Assuntos', Array.isArray(p.assuntos) ? p.assuntos.slice(0, 8).map((a) => corta(a, 120)).join('; ') : '');
  add('Área', corta(p.area, 60));
  add('Órgão julgador', corta(p.orgaoJulgador, 160));
  add('Local', corta(p.local, 80));
  add('Situação informada pela fonte', corta(p.situacao, 80));
  add('Valor da causa', corta(p.valorCausa, 40));
  add('Data de início', corta(p.dataInicio, 25));
  add('Data da última movimentação', corta(p.dataUltimaMovimentacao, 25));
  add('Segredo de justiça', p.segredoJustica ? 'sim' : 'não');
  add('Polo ativo (quem entrou com a ação)', corta(p.poloAtivo, 160));
  add('Polo passivo (contra quem é a ação)', corta(p.poloPassivo, 160));

  const partes = Array.isArray(p.partes) ? p.partes.slice(0, 15) : [];
  if (partes.length) {
    linhas.push('Partes:');
    for (const pt of partes) {
      const advs = (pt.advogados || []).slice(0, 3).map((a) => corta(a.nome, 80)).join(', ');
      linhas.push(`- [${ROTULO_POLO[pt.polo] || 'outros'}] ${corta(pt.nome, 120)}${pt.tipo ? ` (${corta(pt.tipo, 60)})` : ''}${advs ? ` — advogado(s): ${advs}` : ''}`);
    }
  }

  const pc = p.papelConsultado;
  if (pc && pc.nome) {
    add('Pessoa consultada', `${corta(pc.nome, 120)} — ${corta(pc.tipo || 'participação não especificada', 60)} (${ROTULO_POLO[pc.polo] || 'outra participação'})`);
  } else {
    linhas.push('Pessoa consultada: não identificada (consulta feita pelo número do processo)');
  }

  const movs = Array.isArray(p.movimentacoes) ? p.movimentacoes.slice(0, LIMITE_MOVIMENTACOES) : [];
  if (movs.length) {
    linhas.push(`Movimentações (da mais recente para a mais antiga, ${movs.length} de ${p.movimentacoes.length}):`);
    let orcamentoPublicacoes = 9000;
    for (const m of movs) {
      // Publicações do Diário trazem o texto do ato (decisão, sentença, intimação): mandamos mais
      // contexto delas, preservando o início e o fim, onde costuma ficar a parte decisória.
      let desc = '';
      if (m.descricao) {
        const max = m.publicacao && orcamentoPublicacoes > 0 ? Math.min(2400, orcamentoPublicacoes) : 450;
        const t = String(m.descricao).replace(/\s+/g, ' ').trim();
        desc = t.length > max ? t.slice(0, Math.round(max / 3)) + ' […] ' + t.slice(-Math.round((max * 2) / 3)) : t;
        if (m.publicacao) orcamentoPublicacoes -= desc.length;
        desc = ` — ${desc}`;
      }
      linhas.push(`- ${corta(m.data, 25) || 's/ data'} | ${m.publicacao ? '[Texto publicado no Diário] ' : ''}${corta(m.titulo, 120)}${desc}${m.fonte ? ` [${corta(m.fonte, 60)}]` : ''}`);
    }
  } else {
    linhas.push('Movimentações: nenhuma disponível.');
  }

  return {
    sistema: SISTEMA,
    usuario: 'Explique o processo abaixo para uma pessoa leiga, seguindo as regras e o formato JSON.\n\n' + linhas.join('\n')
  };
}

const PROBABILIDADES = ['alta', 'media', 'baixa'];

export function sanitizarExplicacao(d) {
  const txt = (v, max = 1500) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const lista = (v, n) => (Array.isArray(v) ? v.slice(0, n) : []);
  const prob = (v) => {
    const t = String(v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    return PROBABILIDADES.includes(t) ? t : 'media';
  };
  d = d && typeof d === 'object' ? d : {};
  return {
    resumo: txt(d.resumo),
    fase: txt(d.fase, 120),
    situacaoAtual: txt(d.situacaoAtual),
    papelDoConsultado: txt(d.papelDoConsultado),
    ultimosAcontecimentos: lista(d.ultimosAcontecimentos, 6)
      .map((x) => (typeof x === 'string' ? { data: '', traducao: txt(x, 600) } : { data: txt(x && x.data, 25), traducao: txt(x && x.traducao, 600) }))
      .filter((x) => x.traducao),
    proximosPassos: lista(d.proximosPassos, 6)
      .map((x) => ({
        titulo: txt(x && x.titulo, 160),
        descricao: txt(x && x.descricao, 900),
        probabilidade: prob(x && x.probabilidade),
        prazoEstimado: txt(x && x.prazoEstimado, 200)
      }))
      .filter((x) => x.titulo || x.descricao),
    pontosDeAtencao: lista(d.pontosDeAtencao, 6).map((x) => txt(x, 600)).filter(Boolean),
    glossario: lista(d.glossario, 10)
      .map((x) => ({ termo: txt(x && x.termo, 80), significado: txt(x && x.significado, 400) }))
      .filter((x) => x.termo && x.significado),
    recomendacao: txt(d.recomendacao, 900)
  };
}
