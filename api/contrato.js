// api/contrato.js
// Vercel Edge Function usando OpenAI (gpt-4o-mini)
// Necessário: variável OPENAI_API_KEY nas Environment Variables (Production + Preview).

export const config = { runtime: "edge" };

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

export default async function handler(req) {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method Not Allowed" }, 405);
  }

  const OPENAI_KEY = process.env.OPENAI_API_KEY || "";
  if (!OPENAI_KEY) {
    return jsonResponse({ error: "Missing OPENAI_API_KEY in Vercel env" }, 500);
  }

  let data;
  try {
    data = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const { objetivo, porque, tempo, recursos, obstaculo } = data || {};

  const systemPrompt = `Você é um agente de desenvolvimento pessoal para brasileiros.
Aplique discretamente: 2–3 ações de maior impacto, blocos diários curtos (5–25 min),
check-ins semanais e retomada no mesmo dia se falhar.
Gere um "Contrato de 30 dias" claro, prático e encorajador (~180–220 palavras, pt-BR).
Estrutura:
- Compromisso (objetivo)
- Por que agora
- 2–3 ações de maior impacto
- Rotina diária (blocos curtos, consistência)
- Check-ins semanais (quando/como)
- Retomada (o que fazer ao falhar no dia)
Não cite nomes de métodos; seja simples, humano e direto.`;

  const userPrompt = `Objetivo (30 dias): ${objetivo || "-"}
Por que agora: ${porque || "-"}
Tempo diário disponível: ${tempo || "-"}
Recursos disponíveis: ${recursos || "-"}
Obstáculo provável: ${obstaculo || "-"}
Crie o contrato seguindo o formato pedido, em até ~220 palavras.`;

  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.MODEL_NAME || "gpt-4o-mini",
        temperature: 0.7,
        max_tokens: 600,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    const raw = await resp.text();
    let json;
    try { json = JSON.parse(raw); }
    catch { return jsonResponse({ error: "Invalid JSON from OpenAI", raw }, 502); }

    if (!resp.ok) {
      return jsonResponse({ error: "OpenAI error", status: resp.status, detail: json }, resp.status);
    }

    const full = json?.choices?.[0]?.message?.content?.trim() || "";
    const lines = full.split("\n").map(s => s.trim()).filter(Boolean);
    const preview = lines.slice(0, 3).join("\n");

    return jsonResponse({
      preview,
      full,
      plan: {
        daily_block: "5–25 minutos por dia, todos os dias",
        impact_actions: ["Ação 1", "Ação 2", "Ação 3"],
        checkins: "Revisão semanal (10–15 min) aos domingos",
        recovery: "Se falhar no dia, retome com 5 minutos no mesmo dia",
      },
    });
  } catch (e) {
    return jsonResponse({ error: "Unexpected error", detail: String(e) }, 500);
  }
}
