import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const commonChineseChars =
  "的一是在不了有人和国中大为上个民我以要他时来用们生到作地于出就分对成会可主发年动同工也能下过子说产种面而方后多定行学法所道经十" +
  "三之进着等部度家电力里如水化高自二理起小物现实加量都两体制机当使点从业本去把性好应开它合还因由其些然前外天政四日那社义事平形" +
  "相全表间样与关各重新线内数正心反你明看原又么利比或但质气第向道命此变条只没结解问意建月公无系军很情者最立代想已通并提直题党程" +
  "展五果料象员革位入常文总次品式活设及管特件长求老头基资边流路级少图山统接知较将组见计别她手角期根论运农指几九区强放决西被干做" +
  "必战先回则任取据处队南给色光门即保治北造百规热领七海口东导器压志世金增争济阶油思术极交受联什么认六共权收证改清己美再采转更单" +
  "风切打白教速花带安场身车例真务具万每目至达走积示议声报斗完类八离华名确才科张信马节话米整空元况今集温传土许步群广石记需段研界" +
  "拉林律叫且究观越织装影算低持音众书布复容儿须际商非验连断深难近矿千周委素技备半办青省列习响约支般史感劳便团往酸历市克何除消构" +
  "府称太准精值号率族维划选标写存候毛亲快效斯院查江型眼王按格养易置派层片始却专状育厂京识适属圆包火住调满县局照参红细引听该铁价" +
  "严首底液官德随病苏失尔死讲配女黄推显谈罪神艺呢席含企望密批营项防举球英氧势告李台落木帮轮破亚师围注远字材排供河态封另施减树溶" +
  "怎止案言士均武固叶鱼波视仅费紧爱左章早朝害续轻服试食充兵源判护司足某练差致板田降黑犯负击范继兴似余坚曲输修故城夫够送笔船占右";

export type ThemePreset = {
  id: string;
  name: string;
  theme: string;
};

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

const themePresetPath = join(process.cwd(), "data", "theme-presets.json");

const defaultThemePresets: ThemePreset[] = themes.map((theme, index) => ({
  id: `default-${index + 1}`,
  name: theme,
  theme
}));

function normalizeThemePreset(input: unknown, index: number): ThemePreset | null {
  if (!input || typeof input !== "object") return null;
  const record = input as Record<string, unknown>;
  const name = typeof record.name === "string" ? record.name.trim() : "";
  const theme = typeof record.theme === "string" ? record.theme.trim() : "";
  const id = typeof record.id === "string" && record.id.trim() ? record.id.trim() : `preset-${index + 1}`;
  if (!name || !theme) return null;
  return { id, name, theme };
}

function ensureThemePresetFile() {
  if (existsSync(themePresetPath)) return;
  mkdirSync(dirname(themePresetPath), { recursive: true });
  writeFileSync(themePresetPath, `${JSON.stringify({ presets: defaultThemePresets }, null, 2)}\n`, "utf8");
}

export function getThemePresetPath() {
  ensureThemePresetFile();
  return themePresetPath;
}

export function listThemePresets() {
  ensureThemePresetFile();
  try {
    const parsed = JSON.parse(readFileSync(themePresetPath, "utf8")) as { presets?: unknown[] };
    const presets = (parsed.presets ?? []).map(normalizeThemePreset).filter((preset): preset is ThemePreset => Boolean(preset));
    return presets.length > 0 ? presets : defaultThemePresets;
  } catch {
    return defaultThemePresets;
  }
}

export function saveThemePresets(presets: ThemePreset[]) {
  ensureThemePresetFile();
  const normalized = presets
    .map(normalizeThemePreset)
    .filter((preset): preset is ThemePreset => Boolean(preset));
  const nextPresets = normalized.length > 0 ? normalized : defaultThemePresets;
  writeFileSync(themePresetPath, `${JSON.stringify({ presets: nextPresets }, null, 2)}\n`, "utf8");
  return nextPresets;
}

export function rollTheme() {
  const presets = listThemePresets();
  return presets[Math.floor(Math.random() * presets.length)]?.theme ?? themes[Math.floor(Math.random() * themes.length)];
}

export function randomChineseChar() {
  return commonChineseChars[Math.floor(Math.random() * commonChineseChars.length)];
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
