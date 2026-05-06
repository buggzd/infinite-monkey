import { randomUUID } from "node:crypto";
import type { ServerResponse } from "node:http";
import { createCompletion } from "./ai.js";
import { serverConfig } from "./config.js";
import { buildPrompt, resolveRun } from "./prompt.js";
import type { PoemEvent, PoemStartInput, ResolvedPoemRun, RunStatus } from "./types.js";

type Client = ServerResponse;

type RunState = {
  id: string;
  config: ResolvedPoemRun;
  clients: Set<Client>;
  events: PoemEvent[];
  status: RunStatus;
  totalTokens: number;
  totalEstimatedCost: number;
  stopped: boolean;
};

const runs = new Map<string, RunState>();

function writeEvent(client: Client, event: PoemEvent) {
  client.write(`data: ${JSON.stringify(event)}\n\n`);
}

function broadcast(run: RunState, event: PoemEvent) {
  run.events.push(event);
  for (const client of run.clients) {
    writeEvent(client, event);
  }
}

function closeClients(run: RunState) {
  for (const client of run.clients) {
    client.end();
  }
  run.clients.clear();
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function calcCost(totalTokens: number) {
  return Number(((totalTokens / 1000) * 0.002).toFixed(6));
}

function calcAbsurdity(round: number, totalTokens: number) {
  return Math.min(100, Math.round(12 + round * 9 + Math.log10(totalTokens + 10) * 18));
}

async function runLoop(run: RunState) {
  run.status = "running";
  broadcast(run, { type: "started", runId: run.id, config: run.config });
  broadcast(run, { type: "status", runId: run.id, status: "running" });

  for (let round = 1; round <= run.config.maxRounds; round += 1) {
    if (run.stopped) break;

    try {
      const prompt = buildPrompt(run.config, round);
      const result = await createCompletion({
        baseUrl: run.config.baseUrl,
        apiKey: run.config.apiKey,
        model: run.config.model,
        messages: [
          { role: "system", content: "你只输出符合要求的诗歌文本。" },
          { role: "user", content: prompt }
        ],
        temperature: run.config.temperature,
        timeoutMs: serverConfig.requestTimeoutMs
      });

      run.totalTokens += result.totalTokens;
      run.totalEstimatedCost = calcCost(run.totalTokens);
      broadcast(run, {
        type: "round",
        runId: run.id,
        round,
        poem: result.text,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        totalTokens: run.totalTokens,
        totalEstimatedCost: run.totalEstimatedCost,
        absurdity: calcAbsurdity(round, run.totalTokens)
      });
    } catch (error) {
      run.status = "error";
      const message = error instanceof Error ? error.message : "unknown completion error";
      broadcast(run, { type: "error", runId: run.id, message });
      broadcast(run, { type: "status", runId: run.id, status: "error", message });
      closeClients(run);
      return;
    }

    if (round < run.config.maxRounds) {
      await wait(run.config.intervalMs);
    }
  }

  run.status = run.stopped ? "stopped" : "done";
  broadcast(run, { type: "status", runId: run.id, status: run.status });
  closeClients(run);
}

export function startRun(input: PoemStartInput) {
  const id = randomUUID();
  const run: RunState = {
    id,
    config: resolveRun(input),
    clients: new Set(),
    events: [],
    status: "starting",
    totalTokens: 0,
    totalEstimatedCost: 0,
    stopped: false
  };

  runs.set(id, run);
  void runLoop(run);
  return run;
}

export function attachClient(runId: string, client: Client) {
  const run = runs.get(runId);
  if (!run) return false;

  run.clients.add(client);
  for (const event of run.events) {
    writeEvent(client, event);
  }
  if (run.events.length === 0) {
    writeEvent(client, { type: "started", runId: run.id, config: run.config });
    writeEvent(client, { type: "status", runId: run.id, status: run.status });
  }
  if (run.status === "done" || run.status === "stopped" || run.status === "error") {
    client.end();
    return true;
  }
  client.on("close", () => {
    run.clients.delete(client);
  });
  return true;
}

export function stopRun(runId: string) {
  const run = runs.get(runId);
  if (!run) return false;
  run.stopped = true;
  run.status = "stopped";
  broadcast(run, { type: "status", runId: run.id, status: "stopped" });
  closeClients(run);
  return true;
}
