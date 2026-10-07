# ChangeLog

## [2.1.0] — 2026-10-07

### Implementado
- **Detalhes do processo na consulta por número, de graça:** além do DataJud, o sistema passa a consultar o **Diário de Justiça Eletrônico Nacional (DJEN)** do CNJ. Com isso aparecem:
  - **as partes** (polo ativo e passivo) e o título "Autor × Réu" no cabeçalho;
  - **os advogados** intimados, com número da OAB;
  - **o texto integral** das intimações, despachos, decisões e sentenças publicadas, destacado na linha do tempo com a etiqueta "TEXTO DO DIÁRIO" e com link para o documento, quando o tribunal informa.
- As duas bases são consultadas **ao mesmo tempo**, sem deixar a busca mais lenta.
- Se o DataJud ainda não tiver o processo, mas o DJEN tiver publicações, o processo é exibido só com os dados do DJEN.

### Melhorado
- **Explicação por IA mais precisa:** a IA passa a receber o texto das publicações (início e fim de cada uma, onde costuma estar a decisão), e não só o nome das movimentações.
- Os assuntos do processo aparecem no cabeçalho, logo abaixo da classe.
- O DJEN costuma oscilar: quando ele responde com erro temporário (HTTP 502/503/504), o sistema tenta de novo automaticamente. Se mesmo assim falhar, a tela mostra os dados do DataJud com um aviso.
- **Funções do Vercel em São Paulo (`gru1`):** necessário para acessar o DJEN, que só aceita conexões do Brasil. Também deixa mais rápidas as consultas ao DataJud e ao Escavador.

### Corrigido
- Acentos codificados em HTML nos textos dos tribunais (como `&ccedil;` e `&atilde;`) agora aparecem corretamente.

## [2.0.1] — 2026-10-07

### Corrigido
- **A explicação por IA não funcionava em produção.** O modelo `llama-3.3-70b-versatile` foi desativado pelo Groq em 16/08/2026 (a IA do sistema antigo também já estava parada por isso). O padrão agora é o `openai/gpt-oss-120b`, substituto recomendado pelo próprio Groq.

### Melhorado
- **Troca automática de modelo:** se o Groq desativar o modelo em uso, o sistema tenta automaticamente o próximo da lista (`openai/gpt-oss-120b` → `qwen/qwen3.8-27b` → `openai/gpt-oss-20b`). Isso também vale quando `GROQ_MODEL` aponta para um modelo que não existe mais.
- Os modelos de raciocínio usam esforço baixo (`reasoning_effort: low`), o que deixa a resposta mais rápida.
- O limite de tamanho da resposta da IA subiu de 2.200 para 4.000 tokens, para a explicação não ser cortada no meio.

## [2.0.0] — 2026-10-07

O sistema de relatórios de psicologia foi substituído por um **sistema de consulta de processos judiciais**, no estilo do JUS.BR.

### Implementado
- **Busca por CPF ou CNPJ**: lista todos os processos em que a pessoa ou empresa aparece, via API do Escavador. Aceita também o novo CNPJ alfanumérico (em vigor desde julho de 2026).
- **Busca por número do processo** (padrão CNJ), gratuita, pela API pública do DataJud (CNJ), cobrindo cerca de 90 tribunais (TJs, TRFs, TRTs, TREs, STJ, TST, TSE, STM e TJMs).
- **Lista de resultados** com totais (em andamento, arquivados, como autor, como réu), filtros por texto, tribunal, situação e participação, e botão "Carregar mais".
- **Tela do processo** com tribunal, classe, assuntos, órgão julgador, valor da causa, partes e advogados (com OAB), destaque da pessoa consultada, processos relacionados, link para o site do tribunal e linha do tempo das movimentações, que pode ser pesquisada.
- **"Explicar com IA"**: a IA traduz a situação do processo para linguagem simples e mostra a fase atual, um resumo, o que significa a posição da pessoa consultada, os últimos acontecimentos, os **próximos passos prováveis** (com probabilidade e prazo típico), pontos de atenção, glossário e uma recomendação. Dá para copiar ou gerar de novo.
- **Modo demonstração** com processos fictícios, para conhecer o sistema sem configurar nenhuma chave.
- **Senha de acesso opcional** (`SENHA_ACESSO`) para que ninguém mais gaste seus créditos.
- Validação de CPF, CNPJ e do dígito verificador do número CNJ, tanto na tela quanto no servidor, com máscara automática no campo de busca.
- Indicadores no topo mostrando quais integrações estão ativas (CPF/CNPJ, base do CNJ, IA).
- `README.md` explicando como configurar no Vercel.

### Melhorado
- A IA aceita **Groq** (a mesma `GROQ_API_KEY` que já estava em uso) ou **Anthropic/Claude**, e o modelo pode ser trocado por variável de ambiente.
- Respostas da IA em formato estruturado e validadas no servidor antes de aparecerem na tela.
- Layout responsivo (celular e computador), modo escuro automático e versão para impressão.
- Proteção contra injeção de HTML: todo dado externo é tratado antes de ser exibido.
- Tempo máximo das funções do Vercel aumentado para 60 s (`vercel.json`), porque a base do CNJ pode demorar.

### Removido
- A interface de relatórios psicológicos (`index.html` antigo) e as rotas `api/gerar.js`, `api/gerar-pdf.js` e `api/relatoriopdf.js`. Elas continuam disponíveis no histórico do Git (commit `5ac5363`).
- Dependências `pdfkit` e `@anthropic-ai/sdk`, que não são mais usadas. O sistema novo não tem dependências externas.
