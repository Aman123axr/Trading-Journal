import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: Number(process.env.PORT ?? 8787),
  deltaApiKey: process.env.DELTA_API_KEY ?? "",
  deltaApiSecret: process.env.DELTA_API_SECRET ?? "",
  deltaBaseUrl: process.env.DELTA_BASE_URL ?? "https://api.india.delta.exchange",
  deltaWsUrl: process.env.DELTA_WS_URL ?? "wss://socket.india.delta.exchange",
  openAiApiKey: process.env.OPENAI_API_KEY ?? "",
  openAiModel: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
  isServerless: process.env.VERCEL === "1" || process.env.SERVERLESS === "1",
};
