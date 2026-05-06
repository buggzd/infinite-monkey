export type PoemStartInput = {
  baseUrl: string;
  apiKey?: string;
  model: string;
  theme?: string;
  firstChar?: string;
  secondChar?: string;
  thirdChar?: string;
  intervalMs: number;
  maxRounds: number;
  temperature: number;
};

export type ResolvedPoemRun = Required<Pick<PoemStartInput, "baseUrl" | "model" | "intervalMs" | "maxRounds" | "temperature">> &
  Pick<PoemStartInput, "apiKey"> & {
    theme: string;
    firstChar: string;
    secondChar: string;
    thirdChar: string;
  };

export type PoemRound = {
  type: "round";
  runId: string;
  round: number;
  poem: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  totalEstimatedCost: number;
  absurdity: number;
};

export type RunStatus = "starting" | "running" | "stopped" | "done" | "error";

export type PoemEvent =
  | { type: "started"; runId: string; config: ResolvedPoemRun }
  | PoemRound
  | { type: "status"; runId: string; status: RunStatus; message?: string }
  | { type: "error"; runId: string; message: string };
