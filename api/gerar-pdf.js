import Anthropic from "@anthropic-ai/sdk";
import PDFDocument from "pdfkit";

const ROXO_ESCURO = "#3D2B5A";
const ROXO_MED = "#6C4F8C";
const ROXO_CLARO = "#9B7DBF";
const ROSA = "#D4A0B0";
const CINZA_LEVE = "#F8F6FC";
const CINZA_MED = "#5A5271";
const VERDE_BG = "#E8F8F1";
const VERDE_BORDA = "#A9DFBF";
const VERDE_TEX = "#1A7A4A";
const PARCIAL_TEX = "#B07D30";
const PARCIAL_BG = "#FEF7EC";
const VERMELHO_TEX = "#C0392B";
const VERMELHO_BG = "#FDEDEC";
const BORDA = "#E4DCF5";

function hex(h) {
  const r = parseInt(h.slice(1, 3), 16) / 255;
  const g = parseInt(h.slice(3, 5), 16) / 255;
  const b = parseInt(h.slice(5, 7), 16) / 255;
  return [r, g, b];
}

async function gerarTextos(dados) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const nome = dados.nome || "o(a) paciente";
  const diag = dados.diagnostico || "não informado";
  const fl = dados.faixa === "a" ? "1 a 9 anos" : "10 a 15 anos";
  const fins = (dados.fins || []).join(", ") || "compartilhamento interprofissional";
  const inssOn = !!dados.inss;
  const cl = dados.cl || [];
  const clStr = cl.length
    ? cl.map(d => `[${d.dominio}]\n` + d.itens.map(i => `- ${i.label}: ${i.estado}${i.obs ? ` (${i.obs})` : ""}`).join("\n")).join("\n\n")
    : "(nenhum item avaliado)";

  const prompts = {
    demanda: `Você é neuropsicóloga. Escreva o parágrafo "Descrição da demanda" de um relatório interprofissional:
Paciente: ${nome} | Diagnóstico: ${diag} | Início: ${dados.anoInicio || "não informado"} | Investigação: ${dados.investigacao || "não informado"} | Finalidade: ${fins}
Contexto: ${dados.contextoClinico || "não informado"}
${inssOn ? `Mencione que o relatório subsidia solicitação de ${dados.inss.b} no INSS, CID: ${dados.inss.cid}.` : ""}
Linguagem técnica formal, 3ª pessoa, português brasileiro. Máx. 5 frases. Sem títulos.`,

    procedimento: `Você é neuropsicóloga. Escreva o parágrafo "Procedimento":
Modalidade: ${dados.modalidade || "não informado"} | Frequência: ${dados.frequencia || "não informado"} | Duração: ${dados.duracao || "não informado"} | Áreas: ${dados.areas || "não informado"}
Instrumentos: ${dados.instrumentos || "não informado"}
Linguagem técnica formal, 3ª pessoa, português. Máx. 5 frases. Sem títulos.`,

    analise: `Você é uma equipe interprofissional experiente (psicóloga e psicopedagoga) elaborando a ANÁLISE CLÍNICA INTERPRETATIVA de ${nome} (faixa etária: ${fl}), diagnóstico: ${diag}.

IMPORTANTE: NÃO reescreva os dados. ANALISE clinicamente — interprete a significância dos achados, correlacione os dados, identifique padrões, relacione o histórico com o quadro atual. Produza raciocínio clínico genuíno.
NÃO sugira diagnósticos ou hipóteses diagnósticas.

DADOS:
Gestacional/perinatal: ${dados.gestacao || "não informado"}
Desenvolvimento neuropsicomotor: ${dados.desenvolvimento || "não informado"}
Comportamento atual (família): ${dados.comportamento || "não informado"}

CHECKLIST CLÍNICO (Preservado / Parcialmente preservado / Comprometido / Não avaliado):
${clStr}

Observações psicológicas: ${dados.psicologico || "não informado"}
Observações psicopedagógicas: ${dados.psicopedagogico || "não informado"}
${inssOn ? `\nInclua análise do impacto funcional nas AVDs para fins do INSS (CID: ${dados.inss.cid}).` : ""}

ESTRUTURE EM:
1. Parágrafo introdutório: correlacione dados gestacionais e desenvolvimento com o quadro atual.
2. "Em acompanhamento Psicológico:" — análise interpretativa profunda dos domínios. Discuta o que os achados significam funcionalmente, como se relacionam entre si. NÃO liste itens — integre em análise fluida.
3. "Em acompanhamento Psicopedagógico:" — análise do perfil cognitivo e impacto na aprendizagem.
${inssOn ? "4. Impacto funcional: análise objetiva das limitações nas AVDs." : ""}

Linguagem técnica e interpretativa. Parágrafos corridos sem listas. 3ª pessoa. Português formal.`,

    conclusao: `Neuropsicóloga. CONCLUSÃO do relatório de ${nome}, diagnóstico: ${diag}.
Produza síntese conclusiva que INTEGRE a análise, articule a evolução e fundamente as recomendações. NÃO sugira novos diagnósticos.
Síntese: ${dados.sintese || "não informado"}
Recomendações: ${dados.recomendacoes || "não informado"}
Finalidade: ${fins}
${inssOn ? `Inclua parágrafo técnico para o INSS: ${dados.inss.b}, CID ${dados.inss.cid}.` : ""}
Linguagem técnica, 3ª pessoa, português formal. Parágrafos corridos. Máx. 12 frases.`,
  };

  const [demanda, procedimento, analise, conclusao] = await Promise.all([
    client.messages.create({ model: "claude-sonnet-4-6", max_tokens: 1200, messages: [{ role: "user", content: prompts.demanda }] }),
    client.messages.create({ model: "claude-sonnet-4-6", max_tokens: 1000, messages: [{ role: "user", content: prompts.procedimento }] }),
    client.messages.create({ model: "claude-sonnet-4-6", max_tokens: 2500, messages: [{ role: "user", content: prompts.analise }] }),
    client.messages.create({ model: "claude-sonnet-4-6", max_tokens: 1500, messages: [{ role: "user", content: prompts.conclusao }] }),
  ]);

  return {
    demanda: demanda.content[0].text,
    procedimento: procedimento.content[0].text,
    analise: analise.content[0].text,
    conclusao: conclusao.content[0].text,
  };
}

function gerarPDF(dados, textos) {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ size: "A4", margin: 0 });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    const W = doc.page.width;
    const H = doc.page.height;
    const ML = 51; // 18mm
    const MR = 51;
    const CW = W - ML - MR;

    // ── Funções auxiliares ──
    function cabecalho() {
      doc.save();
      doc.rect(0, 0, W, 142).fill(ROXO_ESCURO);
      // Círculo decorativo
      doc.circle(W - 57, 28, 113).fill("#55336A");
      // Logo
      doc.roundedRect(ML, 38, 45, 45, 8).fill(ROSA);
      doc.fontSize(22).font("Helvetica-Bold").fillColor("white").text("C", ML, 50, { width: 45, align: "center" });
      // Nome clínica
      doc.fontSize(16).font("Helvetica-Bold").fillColor("white").text("Cinecleide — Psicóloga", ML + 54, 46);
      doc.fontSize(9).font("Helvetica").fillColor("#CCBBEE").text("Reabilitação Infantil  ·  Transtornos do Neurodesenvolvimento  ·  Patu/RN", ML + 54, 68);
      // Badge
      doc.roundedRect(ML + 54, 82, 230, 19, 9).fill("#55336A");
      doc.fontSize(8).font("Helvetica-Bold").fillColor("#DDD0FF").text("RELATÓRIO INTERPROFISSIONAL PSICOLÓGICO", ML + 54, 88, { width: 230, align: "center" });
      doc.restore();
    }

    function rodape() {
      doc.save();
      doc.rect(0, H - 74, W, 74).fill(CINZA_LEVE);
      doc.moveTo(0, H - 74).lineTo(W, H - 74).stroke(BORDA);
      doc.fontSize(8).font("Helvetica").fillColor(CINZA_MED);
      doc.text("Emitido em " + new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }), ML, H - 60);
      doc.text("Patu/RN — Documento clínico confidencial", ML, H - 48);
      // Assinatura
      const ax = W - MR - 142;
      doc.moveTo(ax, H - 54).lineTo(ax + 142, H - 54).stroke(ROXO_ESCURO);
      doc.fontSize(10).font("Helvetica-Oblique").fillColor("#1A1625").text(dados.prof || "Dra. Cinecleide — Psicóloga", ax, H - 46, { width: 142, align: "center" });
      doc.fontSize(8).font("Helvetica").fillColor(CINZA_MED).text("CRP 17/4961", ax, H - 34, { width: 142, align: "center" });
      doc.restore();
    }

    let y = 160; // início após cabeçalho

    function checkPage(needed = 60) {
      if (y + needed > H - 90) {
        rodape();
        doc.addPage({ size: "A4", margin: 0 });
        cabecalho();
        y = 160;
      }
    }

    function secTitulo(titulo) {
      checkPage(30);
      y += 10;
      doc.fontSize(8).font("Helvetica-Bold").fillColor(ROXO_MED).text(titulo, ML, y);
      y += 14;
      doc.moveTo(ML, y).lineTo(W - MR, y).lineWidth(0.4).stroke(ROXO_CLARO);
      y += 8;
    }

    function label(txt, x, yPos, w = 130) {
      doc.fontSize(7.5).font("Helvetica-Bold").fillColor(CINZA_MED).text(txt, x, yPos, { width: w });
    }

    function valor(txt, x, yPos, w = 130) {
      doc.fontSize(10.5).font("Times-Roman").fillColor("#1A1625").text(txt || "—", x, yPos, { width: w });
    }

    function paragrafo(txt, yStart, width = CW) {
      checkPage(40);
      doc.fontSize(10.5).font("Times-Roman").fillColor("#1A1625");
      const h = doc.heightOfString(txt, { width, align: "justify" });
      if (y + h > H - 90) {
        rodape();
        doc.addPage({ size: "A4", margin: 0 });
        cabecalho();
        y = 160;
      }
      doc.text(txt, ML, y, { width, align: "justify" });
      y += h + 6;
    }

    function bloco(titulo, paras) {
      const totalH = paras.reduce((acc, p) => acc + doc.heightOfString(p, { width: CW - 20 }) + 6, 0) + 40;
      checkPage(Math.min(totalH, 120));
      const startY = y;
      // Fundo
      let ph = 0;
      paras.forEach(p => { ph += doc.heightOfString(p, { width: CW - 20 }) + 6; });
      const boxH = ph + 30;
      doc.rect(ML, y, CW, boxH).fill(CINZA_LEVE);
      doc.rect(ML, y, 3, boxH).fill(ROXO_CLARO);
      y += 10;
      doc.fontSize(8.5).font("Helvetica-Bold").fillColor(ROXO_ESCURO).text(titulo, ML + 12, y, { width: CW - 20 });
      y += 14;
      paras.forEach(p => {
        if (y + doc.heightOfString(p, { width: CW - 20 }) > H - 90) {
          rodape();
          doc.addPage({ size: "A4", margin: 0 });
          cabecalho();
          y = 160;
          doc.rect(ML, y - 10, CW, 3).fill(ROXO_CLARO);
        }
        doc.fontSize(10.5).font("Times-Roman").fillColor("#1A1625").text(p, ML + 12, y, { width: CW - 20, align: "justify" });
        y += doc.heightOfString(p, { width: CW - 20 }) + 6;
      });
      y += 8;
    }

    function itemCL(lbl, estado, obs) {
      const cores = {
        "Preservado": { cor: VERDE_TEX, abrev: "Preservado" },
        "Parcialmente preservado": { cor: PARCIAL_TEX, abrev: "Parcial" },
        "Comprometido": { cor: VERMELHO_TEX, abrev: "Comprometido" },
        "Não avaliado": { cor: CINZA_MED, abrev: "N/A" },
      };
      const { cor, abrev } = cores[estado] || { cor: CINZA_MED, abrev: estado };
      checkPage(obs ? 36 : 22);
      doc.fontSize(8.5).font("Helvetica").fillColor("#1A1625").text(lbl, ML + 12, y, { width: CW - 80, continued: false });
      const lblH = doc.heightOfString(lbl, { width: CW - 80 });
      doc.fontSize(8.5).font("Helvetica-Bold").fillColor(cor).text(abrev, W - MR - 55, y, { width: 55, align: "right" });
      y += lblH;
      if (obs) {
        doc.fontSize(8).font("Helvetica-Oblique").fillColor(CINZA_MED).text(obs, ML + 16, y, { width: CW - 30 });
        y += doc.heightOfString(obs, { width: CW - 30 }) + 2;
      }
      y += 3;
    }

    function domCL(titulo) {
      checkPage(30);
      y += 6;
      doc.fontSize(8).font("Helvetica-Bold").fillColor(ROXO_MED).text(titulo.toUpperCase(), ML + 12, y, { width: CW - 20 });
      y += 14;
    }

    // ══ INÍCIO DO PDF ══
    cabecalho();

    // IDENTIFICAÇÃO
    secTitulo("IDENTIFICAÇÃO DO PACIENTE");
    const cols = CW / 3;
    const row1y = y;
    label("NOME COMPLETO", ML, y, cols - 10);
    label("DATA DE NASCIMENTO", ML + cols, y, cols - 10);
    label("IDADE", ML + cols * 2, y, cols - 10);
    y += 12;
    doc.fontSize(11).font("Helvetica-Bold").fillColor("#1A1625").text(dados.nome || "—", ML, y, { width: cols - 10 });
    valor(dados.dnasc ? new Date(dados.dnasc + "T12:00:00").toLocaleDateString("pt-BR") : "—", ML + cols, y, cols - 10);
    valor(dados.idade || "—", ML + cols * 2, y, cols - 10);
    y += 18;
    label("SEXO", ML, y, cols - 10);
    label("SOLICITANTE", ML + cols, y, cols - 10);
    label("DIAGNÓSTICO (CID/DSM)", ML + cols * 2, y, cols - 10);
    y += 12;
    valor(dados.sexo || "—", ML, y, cols - 10);
    valor(dados.solicitante || "—", ML + cols, y, cols - 10);
    valor(dados.diagnostico || "—", ML + cols * 2, y, cols - 10);
    y += 18;
    label("FINALIDADE DO RELATÓRIO", ML, y, CW);
    y += 12;
    valor((dados.fins || []).join("  ·  ") || "—", ML, y, CW);
    y += 20;

    // PROCEDIMENTO
    secTitulo("PROCEDIMENTO");
    label("INÍCIO", ML, y, cols - 10);
    label("FREQUÊNCIA", ML + cols, y, cols - 10);
    label("MODALIDADE", ML + cols * 2, y, cols - 10);
    y += 12;
    valor(dados.anoInicio || "—", ML, y, cols - 10);
    valor(dados.frequencia || "—", ML + cols, y, cols - 10);
    valor(dados.modalidade || "—", ML + cols * 2, y, cols - 10);
    y += 18;
    label("DURAÇÃO", ML, y, cols - 10);
    label("ÁREAS ENVOLVIDAS", ML + cols, y, cols - 10);
    label("INSTRUMENTOS", ML + cols * 2, y, cols - 10);
    y += 12;
    valor(dados.duracao || "—", ML, y, cols - 10);
    valor(dados.areas || "—", ML + cols, y, cols - 10);
    valor(dados.instrumentos || "—", ML + cols * 2, y, cols - 10);
    y += 18;
    if (textos.procedimento) paragrafo(textos.procedimento);

    // ANÁLISE CLÍNICA
    secTitulo("ANÁLISE CLÍNICA");

    if (dados.gestacao || dados.desenvolvimento) {
      bloco("INFORMAÇÕES MATERNAS E DESENVOLVIMENTO", [
        dados.gestacao ? "Histórico gestacional/perinatal: " + dados.gestacao : null,
        dados.desenvolvimento ? "Desenvolvimento neuropsicomotor: " + dados.desenvolvimento : null,
      ].filter(Boolean));
    }

    if (dados.comportamento) {
      bloco("COMPORTAMENTO E FUNCIONAMENTO ATUAL", [dados.comportamento]);
    }

    // CHECKLIST
    if ((dados.cl || []).length > 0) {
      checkPage(50);
      doc.rect(ML, y, CW, 22).fill(VERDE_BG);
      doc.rect(ML, y, CW, 22).stroke(VERDE_BORDA);
      doc.fontSize(8).font("Helvetica-Bold").fillColor(VERDE_TEX)
        .text(`CHECKLIST CLÍNICO — FAIXA ETÁRIA: ${dados.faixa === "a" ? "1 A 9 ANOS" : "10 A 15 ANOS"}`, ML + 12, y + 7, { width: CW - 24 });
      y += 24;

      doc.rect(ML, y, CW, 2000).fill(VERDE_BG); // fundo provisório

      const startBoxY = y;
      dados.cl.forEach(dom => {
        domCL(dom.dominio);
        dom.itens.forEach(it => itemCL(it.label, it.estado, it.obs));
      });
      // reajustar fundo verde ao tamanho real
      doc.rect(ML, startBoxY, CW, y - startBoxY).fill(VERDE_BG);
      doc.rect(ML, startBoxY, CW, y - startBoxY).lineWidth(0.5).stroke(VERDE_BORDA);
      // redesenhar itens por cima do fundo (pois o fill cobre o texto)
      const savedY = y;
      y = startBoxY;
      dados.cl.forEach(dom => {
        domCL(dom.dominio);
        dom.itens.forEach(it => itemCL(it.label, it.estado, it.obs));
      });
      y += 10;
    }

    // SÍNTESE IA
    if (textos.analise) {
      const paragrafos = textos.analise.split(/\n\n+/).filter(Boolean);
      bloco("SÍNTESE DO ACOMPANHAMENTO INTERPROFISSIONAL", paragrafos);
    }

    if (dados.psicologico) {
      bloco("OBSERVAÇÕES — ACOMPANHAMENTO PSICOLÓGICO", [dados.psicologico]);
    }

    if (dados.psicopedagogico) {
      bloco("OBSERVAÇÕES — ACOMPANHAMENTO PSICOPEDAGÓGICO", [dados.psicopedagogico]);
    }

    // CONCLUSÃO
    secTitulo("CONCLUSÃO E RECOMENDAÇÕES");
    if (textos.conclusao) paragrafo(textos.conclusao);

    rodape();
    doc.end();
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido" });

  const dados = req.body;
  if (!dados || !dados.nome) return res.status(400).json({ error: "Dados do paciente obrigatórios" });

  try {
    const textos = await gerarTextos(dados);
    const pdfBuffer = await gerarPDF(dados, textos);

    const nomeArquivo = `relatorio_${(dados.nome || "paciente").replace(/\s+/g, "_").toLowerCase()}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${nomeArquivo}"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao gerar PDF: " + err.message });
  }
}
