const cjkStart = 0x4e00;
const cjkEnd = 0x9fa5;

export const themes = [
  "凌晨三点的云服务器",
  "三只 AI 互相夸奖",
  "永不停止的 token 炉",
  "被 prompt 困住的猴子",
  "预算燃烧后的灰烬",
  "意义浓度检测失败",
  "模型在日志里做梦",
  "随机骰子统治诗坛",
  "代理端口旁的月亮",
  "一次没有必要的重试"
];

export function rollTheme() {
  return themes[Math.floor(Math.random() * themes.length)];
}

export function randomChineseChar() {
  const code = cjkStart + Math.floor(Math.random() * (cjkEnd - cjkStart + 1));
  return String.fromCharCode(code);
}

export function resolveConstraint(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? Array.from(trimmed)[0] : randomChineseChar();
}

export function estimateTokens(text: string) {
  const chinese = (text.match(/[\u4e00-\u9fa5]/g) ?? []).length;
  const ascii = (text.match(/[A-Za-z0-9_]+/g) ?? []).join("").length;
  const other = Math.max(0, Array.from(text).length - chinese - ascii);
  return Math.max(1, Math.ceil(chinese * 1.15 + ascii / 4 + other * 0.8));
}
