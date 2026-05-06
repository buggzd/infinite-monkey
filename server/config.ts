export const serverConfig = {
  host: process.env.HOST ?? "127.0.0.1",
  port: Number(process.env.PORT ?? 8787),
  ccSwitchBaseUrl: process.env.CCSWITCH_BASE_URL ?? "http://127.0.0.1:65110/v1",
  defaultProtocol: process.env.AI_PROTOCOL ?? "anthropic",
  modelHint: process.env.AI_MODEL_HINT ?? "claude-3-5-sonnet-20241022",
  requestTimeoutMs: Number(process.env.AI_REQUEST_TIMEOUT_MS ?? 60000)
};
