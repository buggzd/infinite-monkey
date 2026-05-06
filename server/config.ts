export const serverConfig = {
  host: process.env.HOST ?? "127.0.0.1",
  port: Number(process.env.PORT ?? 8787),
  ccSwitchBaseUrl: process.env.CCSWITCH_BASE_URL ?? "http://127.0.0.1:65110/v1",
  defaultModel: process.env.AI_MODEL ?? "auto",
  requestTimeoutMs: Number(process.env.AI_REQUEST_TIMEOUT_MS ?? 60000)
};
