import { NextRequest } from "next/server";
import OpenAI from "openai";
import { searchMultiple } from "@/lib/exa-search";

let _client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPEN_ROUTER_KEY!,
    });
  }
  return _client;
}

const MODEL = "google/gemini-2.5-flash";

const SYSTEM_PROMPT = `You are an AI sentiment analyst specializing in the Claude/Anthropic vs OpenAI/ChatGPT landscape. You help users understand community sentiment, opinions, and trends about these AI companies and their products.

When answering questions:
- Be specific and reference actual data points and sources when available
- Compare and contrast Claude and OpenAI when relevant
- Stay scoped to AI topics (Claude, Anthropic, OpenAI, ChatGPT, GPT, coding assistants, AI agents, etc.)
- If the question is off-topic, politely redirect to AI sentiment topics
- Use a confident, editorial tone — like a Bloomberg tech analyst

If you use web search results, cite your sources with [Title](URL) format.`;

const searchTool: OpenAI.ChatCompletionTool = {
  type: "function",
  function: {
    name: "web_search",
    description:
      "Search the web for recent information about AI companies, models, and sentiment. Use for any question requiring current data.",
    parameters: {
      type: "object",
      properties: {
        searches: {
          type: "array",
          items: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Natural language search query about AI topics",
              },
              numResults: {
                type: "number",
                description: "Number of results (5-10)",
                default: 10,
              },
            },
            required: ["query"],
          },
          maxItems: 3,
        },
      },
      required: ["searches"],
    },
  },
};

export async function POST(req: NextRequest) {
  const { message, history = [] } = await req.json();

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      try {
        const recentHistory = history.slice(-20).map((msg: { role: string; content: string }) => ({
          role: msg.role,
          content: msg.content,
        }));

        const messages: OpenAI.ChatCompletionMessageParam[] = [
          { role: "system", content: SYSTEM_PROMPT },
          ...recentHistory,
          { role: "user", content: message },
        ];

        // First LLM call — may produce tool calls
        const firstStream = await getClient().chat.completions.create({
          model: MODEL,
          messages,
          tools: [searchTool],
          stream: true,
        });

        let toolCalls: { id: string; type: string; function: { name: string; arguments: string } }[] = [];
        let contentBuffer = "";

        for await (const chunk of firstStream) {
          const delta = chunk.choices[0]?.delta;

          if (delta?.content) {
            contentBuffer += delta.content;
            sendEvent("content", { content: delta.content });
          }

          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index;
              if (!toolCalls[idx]) {
                toolCalls[idx] = {
                  id: "",
                  type: "function",
                  function: { name: "", arguments: "" },
                };
              }
              if (tc.id) toolCalls[idx].id = tc.id;
              if (tc.function?.name)
                toolCalls[idx].function.name = tc.function.name;
              if (tc.function?.arguments)
                toolCalls[idx].function.arguments += tc.function.arguments;
            }
          }
        }

        // No tool calls — done
        if (toolCalls.length === 0) {
          sendEvent("done", { exaUsed: false });
          controller.close();
          return;
        }

        // Parse and execute searches
        const allSearches: { query: string; numResults: number }[] = [];
        const toolCallIds: string[] = [];

        for (const toolCall of toolCalls) {
          try {
            const args = JSON.parse(toolCall.function.arguments);
            let searches = args.searches;
            if (searches && !Array.isArray(searches)) searches = [searches];
            if (!searches && args.query)
              searches = [{ query: args.query, numResults: args.numResults }];

            if (Array.isArray(searches)) {
              allSearches.push(
                ...searches.filter(
                  (s: { query?: string }) =>
                    s && typeof s.query === "string" && s.query.trim()
                )
              );
            }
            toolCallIds.push(toolCall.id);
          } catch {
            toolCallIds.push(toolCall.id);
          }
        }

        if (allSearches.length === 0) {
          sendEvent("done", { exaUsed: false });
          controller.close();
          return;
        }

        sendEvent("search_start", {
          queries: allSearches.map((s) => s.query),
        });

        const searchResults = await searchMultiple(allSearches);
        const totalSources = searchResults.reduce(
          (acc, s) => acc + s.results.length,
          0
        );

        sendEvent("search_complete", {
          totalSources,
          searches: searchResults.map(({ query, results }) => ({
            query,
            sources: results.map((r) => ({
              title: r.title,
              url: r.url,
              date: r.publishedDate,
            })),
          })),
        });

        // Format results for LLM
        const resultsText = searchResults
          .map(({ query, results }) => {
            if (results.length === 0)
              return `[${query}]\nNo results found.`;
            const items = results
              .map((r) => {
                const date = r.publishedDate
                  ? ` | ${r.publishedDate.slice(0, 10)}`
                  : "";
                return `- ${r.title}${date}\n  ${r.url}\n  ${r.text?.slice(0, 1200) || ""}`;
              })
              .join("\n");
            return `[${query}]\n${items}`;
          })
          .join("\n\n");

        const toolMessages: OpenAI.ChatCompletionMessageParam[] = toolCallIds.map((id) => ({
          role: "tool" as const,
          tool_call_id: id,
          content: resultsText,
        }));

        const assistantMessage: OpenAI.ChatCompletionMessageParam = {
          role: "assistant",
          content: contentBuffer || null,
          tool_calls: toolCalls.map((tc) => ({
            id: tc.id,
            type: "function" as const,
            function: tc.function,
          })),
        };

        // Final LLM call with search results
        const finalStream = await getClient().chat.completions.create({
          model: MODEL,
          messages: [...messages, assistantMessage, ...toolMessages],
          stream: true,
        });

        for await (const chunk of finalStream) {
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            sendEvent("content", { content });
          }
        }

        sendEvent("done", { exaUsed: true, totalSources });
        controller.close();
      } catch (err) {
        sendEvent("error", {
          error: err instanceof Error ? err.message : "Unknown error",
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
