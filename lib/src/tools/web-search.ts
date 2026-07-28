import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const webSearchTool = tool(
  async ({ query }) => {
    const url = `${process.env.SEARCH_API_URL}?q=${encodeURIComponent(query)}&key=${process.env.SEARCH_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Search failed: ${res.status}`);
    return res.json();
  },
  {
    name: "web_search",
    description: "Search the web for current information",
    schema: z.object({ query: z.string() }),
  }
);
