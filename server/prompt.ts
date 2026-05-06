import type { PoemStartInput, ResolvedPoemRun } from "./types.js";
import { resolveConstraint, rollTheme } from "./random.js";

export function resolveRun(input: PoemStartInput): ResolvedPoemRun {
  return {
    baseUrl: input.baseUrl,
    apiKey: input.apiKey,
    model: input.model,
    theme: input.theme?.trim() || rollTheme(),
    firstChar: resolveConstraint(input.firstChar),
    secondChar: resolveConstraint(input.secondChar),
    thirdChar: resolveConstraint(input.thirdChar),
    intervalMs: input.intervalMs,
    maxRounds: input.maxRounds,
    temperature: input.temperature
  };
}

export function buildPrompt(run: ResolvedPoemRun, round: number) {
  return [
    "你是 Infinite Monkey 项目里的讽刺诗歌生成器。",
    "请写一首短诗，主题要荒诞、尖锐、带一点黑色幽默，但不要解释项目设定。",
    `主题：${run.theme}`,
    `第 ${round} 轮生成。`,
    `整首诗开头前三个字符必须严格依次是：${run.firstChar}${run.secondChar}${run.thirdChar}`,
    "长度控制在 4 到 8 行。",
    "只输出诗，不要标题、编号、注释或额外说明。"
  ].join("\n");
}
