export type AiProtocol = "anthropic" | "openai";

export type PoemStartInput = {
  baseUrl: string;
  apiKey?: string;
  protocol: AiProtocol;
  modelHint: string;
  theme?: string;
  firstChar?: string;
  secondChar?: string;
  thirdChar?: string;
  intervalMs: number;
  maxRounds: number;
  temperature: number;
};

export type ResolvedPoemRun = Required<
  Pick<PoemStartInput, "baseUrl" | "protocol" | "modelHint" | "intervalMs" | "maxRounds" | "temperature">
> &
  Pick<PoemStartInput, "apiKey"> & {
    theme: string;
    firstChar: string;
    secondChar: string;
    thirdChar: string;
  };

export type PoemRound = {
  type: "round";
  id?: number;
  runId: string;
  round: number;
  poem: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  totalEstimatedCost: number;
  absurdity: number;
  routedModel?: string;
};

export type PoemRecord = {
  id: number;
  runId: string;
  round: number;
  theme: string;
  firstChar: string;
  secondChar: string;
  thirdChar: string;
  poem: string;
  routedModel?: string | null;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  protocol: AiProtocol;
  createdAt: string;
};

export type RunStatus = "starting" | "running" | "stopped" | "done" | "error";

export type PoemEvent =
  | { type: "started"; runId: string; config: ResolvedPoemRun }
  | PoemRound
  | { type: "status"; runId: string; status: RunStatus; message?: string }
  | { type: "error"; runId: string; message: string };
