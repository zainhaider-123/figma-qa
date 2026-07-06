"use server";

export async function fetchData(
  data: any,
  apiUrl: 'content' | 'screenshot' | 'smart-scrape' | 'function'
) {
  const apiKey = process.env.BROWSERLESS_API_KEY;
  const response = await fetch(
    `https://production-sfo.browserless.io/${apiUrl}?token=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }
  );

  if (apiUrl === 'screenshot') {
    return new Uint8Array(await response.arrayBuffer());
  }
  return response.json();
}