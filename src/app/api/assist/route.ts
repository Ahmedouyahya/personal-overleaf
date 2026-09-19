import { NextResponse } from 'next/server';

/**
 * BYOK AI proxy for LaTeX error explanations.
 * The key lives in the user's browser (Settings) and is forwarded to THEIR
 * configured OpenAI-compatible endpoint only. Never logged or stored here.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const baseUrl = typeof body?.baseUrl === 'string' ? body.baseUrl.trim().replace(/\/+$/, '') : '';
  const model = typeof body?.model === 'string' ? body.model.trim().slice(0, 100) : '';
  const apiKey = typeof body?.apiKey === 'string' ? body.apiKey.trim() : '';
  const issue = typeof body?.issue === 'string' ? body.issue.slice(0, 2000) : '';
  const context = typeof body?.context === 'string' ? body.context.slice(0, 4000) : '';

  if (!baseUrl || !model || !issue)
    return NextResponse.json({ error: 'baseUrl, model and issue are required' }, { status: 400 });
  let url: URL;
  try {
    url = new URL(baseUrl + '/chat/completions');
    if (url.protocol !== 'https:' && url.protocol !== 'http:')
      throw new Error('bad protocol');
  } catch {
    return NextResponse.json({ error: 'Invalid baseUrl (http/https only)' }, { status: 400 });
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60_000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 600,
        messages: [
          {
            role: 'system',
            content: 'You are a LaTeX expert inside an editor. Explain the compile error briefly, name the likely cause, and give the smallest concrete fix (short code snippet when useful). No preamble, under 200 words.',
          },
          { role: 'user', content: `Error:\n${issue}\n\nSource context:\n${context || '(none)'}` },
        ],
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '').then(t => t.slice(0, 300));
      return NextResponse.json({ error: `AI endpoint ${res.status}${text ? ': ' + text : ''}` }, { status: 502 });
    }
    const data = await res.json().catch(() => null);
    const suggestion: unknown = data?.choices?.[0]?.message?.content;
    if (typeof suggestion !== 'string' || !suggestion.trim())
      return NextResponse.json({ error: 'Empty AI response' }, { status: 502 });
    return NextResponse.json({ suggestion: suggestion.trim().slice(0, 4000) });
  } catch (e) {
    const msg = e instanceof Error && e.name === 'AbortError' ? 'AI request timed out' : 'AI request failed';
    return NextResponse.json({ error: msg }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
