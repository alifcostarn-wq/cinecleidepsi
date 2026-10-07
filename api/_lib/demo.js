// Dados 100% FICTÍCIOS usados no "Modo demonstração".
// Servem para conhecer o sistema (inclusive a explicação por IA) sem um provedor de dados configurado.
import { categoriaSituacao } from './util.js';

function numeroCNJ(sequencial, ano, segmento, tribunal, origem) {
  const dv = 98n - (BigInt(sequencial + ano + segmento + tribunal + origem) * 100n) % 97n;
  return `${sequencial}-${String(dv).padStart(2, '0')}.${ano}.${segmento}.${tribunal}.${origem}`;
}

const CONSULTADA = 'Maria Exemplo da Silva';

const PROCESSOS = [
  {
    numero: numeroCNJ('0001234', '2026', '8', '26', '9999'),
    tribunal: 'TJSP', tribunalNome: 'Tribunal de Justiça de São Paulo', segmento: 'Justiça Estadual',
    grau: 'Juizado Especial', classe: 'Procedimento do Juizado Especial Cível',
    assuntos: ['Indenização por Dano Moral', 'Inclusão Indevida em Cadastro de Inadimplentes'],
    area: 'Cível', orgaoJulgador: '1ª Vara do Juizado Especial Cível (fictícia)', local: 'São Paulo/SP',
    situacao: 'Em andamento', valorCausa: 'R$ 15.000,00',
    dataInicio: '2026-02-10', poloAtivo: CONSULTADA, poloPassivo: 'Operadora Telefônica Exemplo S.A.',
    partes: [
      { nome: CONSULTADA, tipo: 'Requerente', polo: 'ATIVO', tipoPessoa: 'FISICA', advogados: [{ nome: 'Advogado Fictício Um', oab: '000001/SP' }] },
      { nome: 'Operadora Telefônica Exemplo S.A.', tipo: 'Requerido', polo: 'PASSIVO', tipoPessoa: 'JURIDICA', advogados: [{ nome: 'Advogada Fictícia Dois', oab: '000002/SP' }] }
    ],
    papelConsultado: { nome: CONSULTADA, tipo: 'Requerente', polo: 'ATIVO' },
    movimentacoes: [
      { data: '2026-09-25', titulo: 'Publicação', descricao: 'Disponibilizado no DJE: Intimação das partes acerca da sentença. Prazo para recurso inominado: 10 dias.', fonte: 'DJSP' },
      { data: '2026-09-22', titulo: 'Julgado procedente em parte o pedido', descricao: 'Sentença: julgo PARCIALMENTE PROCEDENTE o pedido para condenar a requerida a retirar o nome da autora dos cadastros de inadimplentes e a pagar R$ 5.000,00 a título de danos morais, com correção monetária e juros. Sem custas e honorários nesta instância (art. 55 da Lei 9.099/95).', fonte: 'TJSP · Juizado Especial' },
      { data: '2026-07-01', titulo: 'Conclusos para sentença', descricao: '', fonte: 'TJSP · Juizado Especial' },
      { data: '2026-06-18', titulo: 'Juntada de contestação', descricao: 'Requerida alega regularidade da cobrança.', fonte: 'TJSP · Juizado Especial' },
      { data: '2026-05-20', titulo: 'Audiência de conciliação realizada', descricao: 'Partes presentes. Conciliação infrutífera.', fonte: 'TJSP · Juizado Especial' },
      { data: '2026-03-04', titulo: 'Juntada de aviso de recebimento', descricao: 'Citação positiva.', fonte: 'TJSP · Juizado Especial' },
      { data: '2026-02-12', titulo: 'Expedição de carta de citação', descricao: '', fonte: 'TJSP · Juizado Especial' },
      { data: '2026-02-10', titulo: 'Distribuído por sorteio', descricao: '', fonte: 'TJSP · Juizado Especial' }
    ]
  },
  {
    numero: numeroCNJ('0004321', '2024', '5', '02', '9999'),
    tribunal: 'TRT-2', tribunalNome: 'Tribunal Regional do Trabalho da 2ª Região', segmento: 'Justiça do Trabalho',
    grau: '1º grau', classe: 'Ação Trabalhista - Rito Ordinário',
    assuntos: ['Horas Extras', 'Verbas Rescisórias'],
    area: 'Trabalhista', orgaoJulgador: '5ª Vara do Trabalho (fictícia)', local: 'São Paulo/SP',
    situacao: 'Em andamento', valorCausa: 'R$ 48.500,00',
    dataInicio: '2024-04-15', poloAtivo: CONSULTADA, poloPassivo: 'Comércio Varejista Exemplo Ltda.',
    partes: [
      { nome: CONSULTADA, tipo: 'Reclamante', polo: 'ATIVO', tipoPessoa: 'FISICA', advogados: [{ nome: 'Advogado Fictício Três', oab: '000003/SP' }] },
      { nome: 'Comércio Varejista Exemplo Ltda.', tipo: 'Reclamado', polo: 'PASSIVO', tipoPessoa: 'JURIDICA', advogados: [] }
    ],
    papelConsultado: { nome: CONSULTADA, tipo: 'Reclamante', polo: 'ATIVO' },
    movimentacoes: [
      { data: '2026-09-30', titulo: 'Juntada de petição', descricao: 'Executada junta comprovante de depósito parcial de R$ 10.000,00 e requer parcelamento do saldo.', fonte: 'TRT-2 · 1º grau' },
      { data: '2026-08-21', titulo: 'Determinado o bloqueio de valores', descricao: 'Ordem de bloqueio via SISBAJUD no valor de R$ 32.410,55. Resultado: bloqueio parcial de R$ 1.230,00.', fonte: 'TRT-2 · 1º grau' },
      { data: '2026-07-10', titulo: 'Decorrido prazo', descricao: 'Decorrido o prazo da executada para pagamento voluntário.', fonte: 'TRT-2 · 1º grau' },
      { data: '2026-06-12', titulo: 'Homologada a liquidação', descricao: 'Homologo os cálculos no valor de R$ 32.410,55. Intime-se a executada para pagamento em 48 horas, sob pena de execução.', fonte: 'TRT-2 · 1º grau' },
      { data: '2026-02-03', titulo: 'Trânsito em julgado', descricao: '', fonte: 'TRT-2 · 2º grau' },
      { data: '2025-11-19', titulo: 'Negado provimento ao recurso', descricao: 'Acórdão: a Turma negou provimento ao recurso ordinário da reclamada, mantendo a sentença.', fonte: 'TRT-2 · 2º grau' },
      { data: '2025-05-08', titulo: 'Julgado procedente em parte o pedido', descricao: 'Sentença: condena a reclamada ao pagamento de horas extras e verbas rescisórias.', fonte: 'TRT-2 · 1º grau' },
      { data: '2024-09-02', titulo: 'Audiência de instrução realizada', descricao: '', fonte: 'TRT-2 · 1º grau' },
      { data: '2024-04-15', titulo: 'Distribuído por sorteio', descricao: '', fonte: 'TRT-2 · 1º grau' }
    ]
  },
  {
    numero: numeroCNJ('0007788', '2023', '4', '03', '9999'),
    tribunal: 'TRF-3', tribunalNome: 'Tribunal Regional Federal da 3ª Região', segmento: 'Justiça Federal',
    grau: '1º grau', classe: 'Execução Fiscal', assuntos: ['Anuidades (Conselho Profissional)'],
    area: 'Tributário', orgaoJulgador: 'Vara de Execuções Fiscais (fictícia)', local: 'Campinas/SP',
    situacao: 'Arquivado provisoriamente', valorCausa: 'R$ 3.210,00',
    dataInicio: '2023-08-01', poloAtivo: 'Conselho Regional Profissional Exemplo', poloPassivo: CONSULTADA,
    partes: [
      { nome: 'Conselho Regional Profissional Exemplo', tipo: 'Exequente', polo: 'ATIVO', tipoPessoa: 'JURIDICA', advogados: [{ nome: 'Procuradora Fictícia Quatro', oab: '000004/SP' }] },
      { nome: CONSULTADA, tipo: 'Executada', polo: 'PASSIVO', tipoPessoa: 'FISICA', advogados: [] }
    ],
    papelConsultado: { nome: CONSULTADA, tipo: 'Executada', polo: 'PASSIVO' },
    movimentacoes: [
      { data: '2025-03-20', titulo: 'Arquivado provisoriamente', descricao: 'Remessa ao arquivo sem baixa, nos termos do art. 40, § 2º, da Lei 6.830/80.', fonte: 'TRF-3 · 1º grau' },
      { data: '2024-03-15', titulo: 'Suspensão do processo', descricao: 'Não localizados bens penhoráveis. Suspendo o curso da execução por 1 ano (art. 40 da LEF).', fonte: 'TRF-3 · 1º grau' },
      { data: '2024-02-01', titulo: 'Juntada de resultado SISBAJUD', descricao: 'Ordem de bloqueio com resultado negativo.', fonte: 'TRF-3 · 1º grau' },
      { data: '2023-10-05', titulo: 'Decorrido prazo', descricao: 'Executada citada não pagou nem ofereceu bens à penhora.', fonte: 'TRF-3 · 1º grau' },
      { data: '2023-09-11', titulo: 'Juntada de aviso de recebimento', descricao: 'Citação positiva.', fonte: 'TRF-3 · 1º grau' },
      { data: '2023-08-01', titulo: 'Distribuído por dependência', descricao: '', fonte: 'TRF-3 · 1º grau' }
    ]
  },
  {
    numero: numeroCNJ('0005555', '2021', '8', '26', '9999'),
    tribunal: 'TJSP', tribunalNome: 'Tribunal de Justiça de São Paulo', segmento: 'Justiça Estadual',
    grau: '1º grau', classe: 'Alimentos - Lei Especial nº 5.478/68', assuntos: ['Fixação'],
    area: 'Família', orgaoJulgador: '2ª Vara da Família e Sucessões (fictícia)', local: 'São Paulo/SP',
    situacao: 'Arquivado', valorCausa: null, segredoJustica: true,
    dataInicio: '2021-06-07', poloAtivo: null, poloPassivo: null,
    partes: [],
    papelConsultado: { nome: CONSULTADA, tipo: 'Parte', polo: 'OUTROS' },
    movimentacoes: [
      { data: '2022-05-30', titulo: 'Arquivado definitivamente', descricao: '', fonte: 'TJSP · 1º grau' },
      { data: '2022-05-10', titulo: 'Trânsito em julgado', descricao: '', fonte: 'TJSP · 1º grau' },
      { data: '2022-03-28', titulo: 'Homologada a transação', descricao: 'Sentença homologatória de acordo (conteúdo sob segredo de justiça).', fonte: 'TJSP · 1º grau' },
      { data: '2021-06-07', titulo: 'Distribuído por sorteio', descricao: '', fonte: 'TJSP · 1º grau' }
    ]
  }
].map((p) => ({
  segredoJustica: false,
  sistema: 'Demonstração',
  fontes: [{ sigla: 'DEMO', descricao: 'Dados fictícios de demonstração', tipo: 'DEMO', url: null }],
  url: null,
  processosRelacionados: [],
  atualizadoEm: null,
  ...p,
  statusCategoria: categoriaSituacao(p.situacao),
  dataUltimaMovimentacao: p.movimentacoes[0].data,
  quantidadeMovimentacoes: p.movimentacoes.length,
  origem: 'Demonstração',
  demo: true
}));

export function demoConsulta() {
  return {
    tipoDocumento: 'CPF',
    documento: '000.000.000-00',
    envolvido: { nome: CONSULTADA, tipoPessoa: 'FISICA', quantidadeProcessos: PROCESSOS.length },
    processos: PROCESSOS,
    proximaPagina: null,
    fonte: 'Demonstração (dados fictícios)',
    demo: true
  };
}

export function demoProcesso(numero) {
  return PROCESSOS.find((p) => p.numero === numero) || null;
}
