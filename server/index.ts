import cors from "@fastify/cors";
import Fastify from "fastify";
import { z } from "zod";
import { serverConfig } from "./config.js";
import { attachClient, startRun, stopRun } from "./engine.js";
import { rollTheme } from "./random.js";

const app = Fastify({ logger: true });

const startSchema = z.object({
  baseUrl: z.string().url().default(serverConfig.ccSwitchBaseUrl),
  apiKey: z.string().optional(),
  model: z.string().min(1).default(serverConfig.defaultModel),
  theme: z.string().optional(),
  firstChar: z.string().optional(),
  secondChar: z.string().optional(),
  thirdChar: z.string().optional(),
  intervalMs: z.number().int().min(250).max(30000).default(1200),
  maxRounds: z.number().int().min(1).max(200).default(12),
  temperature: z.number().min(0).max(2).default(0.9)
});

await app.register(cors, {
  origin: true
});

app.get("/api/health", async () => ({
  ok: true,
  ccSwitchBaseUrl: serverConfig.ccSwitchBaseUrl,
  defaultModel: serverConfig.defaultModel
}));

app.get("/api/theme/roll", async () => ({
  theme: rollTheme()
}));

app.post("/api/poem/start", async (request, reply) => {
  const parsed = startSchema.safeParse(request.body ?? {});
  if (!parsed.success) {
    return reply.status(400).send({ error: parsed.error.flatten() });
  }

  const run = startRun(parsed.data);
  return { runId: run.id, config: run.config };
});

app.post("/api/poem/:runId/stop", async (request, reply) => {
  const params = z.object({ runId: z.string() }).parse(request.params);
  const stopped = stopRun(params.runId);
  if (!stopped) return reply.status(404).send({ error: "run not found" });
  return { ok: true };
});

app.get("/api/poem/:runId/events", async (request, reply) => {
  const params = z.object({ runId: z.string() }).parse(request.params);
  reply.raw.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
    "x-accel-buffering": "no"
  });
  reply.raw.write(": connected\n\n");

  const attached = attachClient(params.runId, reply.raw);
  if (!attached) {
    reply.raw.write(`data: ${JSON.stringify({ type: "error", runId: params.runId, message: "run not found" })}\n\n`);
    reply.raw.end();
  }

  return reply;
});

await app.listen({
  host: serverConfig.host,
  port: serverConfig.port
});
