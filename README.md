# Consulta Processual

Sistema web para consultar processos judiciais por **CPF**, **CNPJ** ou **número do processo (padrão CNJ)**, ver dados e movimentações, e pedir para uma **IA explicar a situação do processo em linguagem simples**, com os próximos passos prováveis.

## Como funciona

| O que você digita | De onde vêm os dados | Custo |
|---|---|---|
| CPF ou CNPJ (inclusive o novo CNPJ alfanumérico) | [API do Escavador](https://api.escavador.com/v2/docs) — reúne processos de todos os tribunais e identifica as partes pelo documento | Pago (créditos por consulta) |
| Número do processo | Escavador (se configurado) ou, de graça, duas bases do CNJ consultadas juntas: [DataJud](https://datajud-wiki.cnj.jus.br/api-publica/) (dados do processo e lista de movimentações) e [DJEN — Diário de Justiça Eletrônico Nacional](https://comunica.pje.jus.br/) (partes, advogados e texto integral das publicações) | Gratuito |
| Nome da parte ou número da OAB | [DJEN — Diário de Justiça Eletrônico Nacional](https://comunica.pje.jus.br/): encontra os processos que tiveram publicações em nome da pessoa, empresa ou advogado(a) no período escolhido | Gratuito |
| Botão "Explicar com IA" | Groq (GPT-OSS 120B) ou Anthropic (Claude) | Conforme o provedor de IA |

> **Por que um provedor pago para CPF/CNPJ?** Os tribunais e o portal JUS.BR só mostram processos por CPF/CNPJ para quem faz login com a conta gov.br da própria pessoa, e a base pública do CNJ (DataJud) não traz os nomes nem os documentos das partes (LGPD). Por isso a busca por documento depende de um agregador como o Escavador.

## Configuração no Vercel

Em **Project → Settings → Environment Variables**, cadastre:

| Variável | Obrigatória? | Para quê |
|---|---|---|
| `GROQ_API_KEY` | Sim (ou `ANTHROPIC_API_KEY`) | Gera as explicações por IA. É a mesma chave que o sistema anterior já usava. |
| `ESCAVADOR_API_KEY` | Para buscar por CPF/CNPJ | Token da API do Escavador (crie em escavador.com → API → Tokens). Sem ele, a busca por número continua funcionando. |
| `SENHA_ACESSO` | Recomendada | Protege o sistema com uma senha. Sem ela, qualquer pessoa com o link pode consultar e gastar seus créditos. |
| `ANTHROPIC_API_KEY` | Opcional | Usa o Claude em vez do Groq. |
| `IA_PROVEDOR` | Opcional | `groq` ou `anthropic` — escolhe qual usar quando as duas chaves existem (padrão: Groq). |
| `GROQ_MODEL` / `ANTHROPIC_MODEL` | Opcional | Troca o modelo (padrões: `openai/gpt-oss-120b` e `claude-opus-5-5`). Se o modelo do Groq for desativado, o sistema tenta automaticamente `qwen/qwen3.8-27b` e depois `openai/gpt-oss-20b`. |
| `DATAJUD_API_KEY` | Opcional | Só se o CNJ trocar a chave pública. A chave vigente fica em [datajud-wiki.cnj.jus.br/api-publica/acesso](https://datajud-wiki.cnj.jus.br/api-publica/acesso). |

Depois de salvar as variáveis, faça um novo deploy (Deployments → Redeploy).

Sem nenhuma chave, o botão **"Ver demonstração com dados fictícios"** mostra o sistema funcionando com processos inventados.

## Estrutura

```
index.html              Interface (busca, lista de processos, detalhe, painel da IA)
api/status.js           GET  — quais integrações estão ativas
api/consulta.js         GET  ?documento=CPF_OU_CNPJ — processos do documento
api/processo.js         GET  ?numero=NUMERO_CNJ — dados e movimentações
api/diario.js           GET  ?nome=NOME ou ?oab=NUMERO&uf=UF [&periodo=30|180|365|730|todos] — processos com publicações no DJEN
api/explicar.js         POST { processo } — explicação por IA
api/_lib/util.js        Validação de CPF/CNPJ/número CNJ, mapa de tribunais, erros
api/_lib/escavador.js   Conector da API v2 do Escavador
api/_lib/datajud.js     Conector da API pública do DataJud (CNJ)
api/_lib/djen.js        Conector do Diário de Justiça Eletrônico Nacional (DJEN/CNJ)
api/_lib/ia.js          Chamada ao Groq ou à Anthropic
api/_lib/explicacao.js  Instruções enviadas à IA e validação da resposta
api/_lib/demo.js        Dados fictícios do modo demonstração
```

## Limitações

- A explicação da IA é informativa, pode conter imprecisões e não substitui um advogado ou a Defensoria Pública.
- Processos em segredo de justiça aparecem com dados limitados.
- O DataJud recebe os dados dos tribunais com atraso e pode levar até ~30 segundos para responder.
- O DJEN só aceita conexões vindas do Brasil. Por isso as funções rodam no datacenter de São Paulo do Vercel (`"regions": ["gru1"]` no `vercel.json`) — não remova essa linha.
- No DJEN, as "partes" são as pessoas intimadas nas publicações; quem nunca foi intimado não aparece.
- A busca por nome não usa CPF: pessoas e empresas com o mesmo nome (homônimos) podem aparecer juntas, e processos sem nenhuma publicação no período escolhido não aparecem.
- Consultar processos de terceiros envolve dados pessoais: use o sistema com finalidade legítima, conforme a LGPD.
