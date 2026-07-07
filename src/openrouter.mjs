import "./env.mjs";

export function hasOpenRouterEnv() {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

export async function chatWithOpenRouter(messages, options = {}) {
  if (!hasOpenRouterEnv()) {
    throw new Error("OPENROUTER_API_KEY is required for model answers.");
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "http://localhost:3000",
      "X-Title": process.env.OPENROUTER_APP_NAME ?? "RAG Public Document Assignment"
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL ?? "openai/gpt-4.1-mini",
      messages,
      temperature: options.temperature ?? 0.2,
      max_tokens: options.maxTokens ?? 900
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`OpenRouter request failed: ${response.status} ${JSON.stringify(payload)}`);
  }

  return payload.choices?.[0]?.message?.content?.trim() ?? "";
}

export async function rewriteQuestionForSearch(question) {
  if (!hasOpenRouterEnv()) {
    return question;
  }

  const content = await chatWithOpenRouter([
    {
      role: "system",
      content: "너는 한국어 공공기관 문서 검색어를 만드는 도우미다. 답변하지 말고 검색에 적합한 독립 질의 1문장만 작성한다."
    },
    {
      role: "user",
      content: `사용자 질문: ${question}\n검색 질의:`
    }
  ], { temperature: 0, maxTokens: 120 });

  return content.replace(/^["']|["']$/g, "").trim() || question;
}
