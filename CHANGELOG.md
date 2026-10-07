# ChangeLog

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
