import "server-only";
import OpenAI from "openai";

/** Server-only OpenAI client. The key never reaches the browser. */
export function openai() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
}
