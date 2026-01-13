import * as cheerio from 'cheerio';
import { llm, completionWithRetry } from '../ai/client';
import { SessionKeys } from '@/types/ai';

export interface ScrapedData {
    summary: string;
    context: string;
}

export async function scoutCompany(domain: string): Promise<ScrapedData | null> {
    try {
        const url = domain.startsWith('http') ? domain : `https://${domain}`;
        console.log(`Scouting company at ${url}...`);

        // 1. Fetch HTML
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36'
            },
            signal: AbortSignal.timeout(10000) // 10s timeout
        });

        if (!response.ok) {
            console.warn(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
            return null;
        }

        const html = await response.text();

        // 2. Parse Text
        const $ = cheerio.load(html);

        // Remove script, style, and hidden elements to get clean text
        $('script, style, noscript, svg, path, meta, link').remove();

        // Get main content (simplify)
        const bodyText = $('body').text().replace(/\s+/g, ' ').trim();

        // Truncate to avoid huge context (approx 5000 chars)
        const context = bodyText.slice(0, 5000);

        // 3. Summarize with AI (optional here, but good for "Scout" result)
        // We'll generate a summary for the "Company Scout" report.
        const summary = await generateCompanySummary(context);

        return {
            summary,
            context
        };

    } catch (error) {
        console.error(`Error scouting ${domain}:`, error);
        return null;
    }
}

export async function generateCompanySummary(context: string, model: string = "llama-3.1-8b-instant", sessionKeys?: SessionKeys): Promise<string> {
    try {
        const response = await completionWithRetry({
            model: model,
            messages: [
                {
                    role: "system",
                    content: "You are a professional sales researcher. Summarize this company website content in 3-4 concise sentences, focusing on their value proposition, target market, and key products. Output PLAIN TEXT only."
                },
                {
                    role: "user",
                    content: context
                }
            ],
            temperature: 0.3,
            max_tokens: 300
        }, sessionKeys);
        return response.choices[0]?.message?.content || "No summary available.";
    } catch (e) {
        console.error("AI Summary failed", e);
        return "Summary generation failed.";
    }
}

export async function generatePersonalizedEmail(
    lead: { full_name: string; title: string; company_name: string },
    companyContext: string,
    model: string = "llama-3.3-70b-versatile",
    sessionKeys?: SessionKeys
): Promise<string> {
    const prompt = `
    You are a top-tier SDR using "Company Scout" intelligence.
    
    Write a personalized cold email to ${lead.full_name} (${lead.title}) at ${lead.company_name}.
    
    USE THIS COMPANY CONTEXT found by the scout:
    "${companyContext.slice(0, 1000)}..."
    
    GUIDELINES:
    - Keep it under 150 words.
    - Mention a specific detail from the context to show we did research.
    - Connect their likely pain points (based on title) to OUR solution (Throxy: AI Sales Agents).
    - Call to action: "Worth a chat?"
    - Tone: Professional, direct, slightly witty.
    
    Output JSON: { "subject": "...", "body": "..." }
  `;

    try {
        const response = await completionWithRetry({
            model: model,
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" }
        }, sessionKeys);

        return response.choices[0]?.message?.content || "{}";
    } catch (e) {
        console.error("Email generation failed", e);
        return JSON.stringify({ subject: "Error", body: "Could not generate email." });
    }
}
