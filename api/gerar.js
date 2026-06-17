export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo nao permitido' });
  }

  const { prompt, max_tokens } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt obrigatorio' });
  }

  const KEY = process.env.GROQ_API_KEY;
  if (!KEY) {
    return res.status(500).json({ error: 'Chave GROQ_API_KEY nao configurada' });
  }

  try {
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
    if (d.error) {
      return res.status(500).json({ error: d.error.message || 'Erro na API Groq' });
    }
    const text = (d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || '';
    return res.status(200).json({ text });

  } catch (err) {
    return res.status(500).json({ error: 'Erro interno: ' + err.message });
  }
}
