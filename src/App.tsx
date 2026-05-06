import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type RunConfig = {
  baseUrl: string;
  protocol: "anthropic" | "openai";
  modelHint: string;
  theme: string;
  firstChar: string;
  secondChar: string;
  thirdChar: string;
  intervalMs: number;
  maxRounds: number;
  temperature: number;
};

type PoemRound = {
  type: "round";
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

type PoemEvent =
  | { type: "started"; runId: string; config: RunConfig }
  | PoemRound
  | { type: "status"; runId: string; status: "starting" | "running" | "stopped" | "done" | "error"; message?: string }
  | { type: "error"; runId: string; message: string };

type Settings = {
  baseUrl: string;
  apiKey: string;
  protocol: "anthropic" | "openai";
  theme: string;
  firstChar: string;
  secondChar: string;
  thirdChar: string;
  intervalMs: number;
  maxRounds: number;
  temperature: number;
};

const defaultSettings: Settings = {
  baseUrl: "http://127.0.0.1:65110/v1",
  apiKey: "",
  protocol: "anthropic",
  theme: "",
  firstChar: "",
  secondChar: "",
  thirdChar: "",
  intervalMs: 1200,
  maxRounds: 12,
  temperature: 0.9
};

function asSingleGlyph(value: string) {
  return Array.from(value.trim())[0] ?? "";
}

function statusText(status: string) {
  const map: Record<string, string> = {
    idle: "待机",
    starting: "点火",
    running: "燃烧",
    stopped: "停止",
    done: "完成",
    error: "故障"
  };
  return map[status] ?? status;
}

function friendlyError(message: string) {
  if (message.includes("全部渠道不可提供当前模型")) {
    return `${message}\n\ncc-switch 收到了请求，但当前全局路由没有可用渠道。检查 cc-switch 的全局路由、账号额度或协议选择。`;
  }
  if (message.includes("404")) {
    return `${message}\n\n代理地址可达，但接口路径不匹配。Anthropic 协议会请求 /v1/messages，OpenAI 协议会请求 /v1/chat/completions。`;
  }
  return message;
}

export function App() {
  const [settings, setSettings] = useState(defaultSettings);
  const [rounds, setRounds] = useState<PoemRound[]>([]);
  const [status, setStatus] = useState("idle");
  const [runId, setRunId] = useState("");
  const [activeConfig, setActiveConfig] = useState<RunConfig | null>(null);
  const [error, setError] = useState("");
  const eventSourceRef = useRef<EventSource | null>(null);

  const latestRound = rounds.at(-1);
  const metrics = useMemo(() => {
    const totalTokens = latestRound?.totalTokens ?? 0;
    const totalEstimatedCost = latestRound?.totalEstimatedCost ?? 0;
    const absurdity = latestRound?.absurdity ?? 0;
    return { totalTokens, totalEstimatedCost, absurdity };
  }, [latestRound]);

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  async function rollTheme() {
    const response = await fetch("/api/theme/roll");
    const data = (await response.json()) as { theme: string };
    setSettings((current) => ({ ...current, theme: data.theme }));
  }

  async function start(event: FormEvent) {
    event.preventDefault();
    setError("");
    setRounds([]);
    setStatus("starting");
    eventSourceRef.current?.close();

    const response = await fetch("/api/poem/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...settings,
        apiKey: settings.apiKey.trim() || undefined,
        modelHint: settings.protocol === "anthropic" ? "claude-3-5-sonnet-20241022" : "gpt-4o-mini",
        firstChar: asSingleGlyph(settings.firstChar) || undefined,
        secondChar: asSingleGlyph(settings.secondChar) || undefined,
        thirdChar: asSingleGlyph(settings.thirdChar) || undefined
      })
    });

    if (!response.ok) {
      setStatus("error");
      setError(await response.text());
      return;
    }

    const data = (await response.json()) as { runId: string; config: RunConfig };
    setRunId(data.runId);
    setActiveConfig(data.config);

    const stream = new EventSource(`/api/poem/${data.runId}/events`);
    eventSourceRef.current = stream;
    stream.onmessage = (message) => {
      const payload = JSON.parse(message.data) as PoemEvent;
      if (payload.type === "started") {
        setActiveConfig(payload.config);
      }
      if (payload.type === "status") {
        setStatus(payload.status);
        if (payload.message) setError(friendlyError(payload.message));
      }
      if (payload.type === "round") {
        setRounds((current) => [...current, payload]);
      }
      if (payload.type === "error") {
        setStatus("error");
        setError(friendlyError(payload.message));
      }
    };
    stream.onerror = () => {
      stream.close();
      eventSourceRef.current = null;
    };
  }

  async function stop() {
    if (!runId) return;
    await fetch(`/api/poem/${runId}/stop`, { method: "POST" });
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    setStatus("stopped");
  }

  const running = status === "starting" || status === "running";
  const constraintPreview = activeConfig
    ? `${activeConfig.firstChar}${activeConfig.secondChar}${activeConfig.thirdChar}`
    : `${settings.firstChar || "?"}${settings.secondChar || "?"}${settings.thirdChar || "?"}`;

  return (
    <main className="shell">
      <section className="visual-panel" aria-label="Infinite Monkey">
        <object data="/assets/monkey-typing.svg" type="image/svg+xml" aria-label="A cyber monkey typing on a glowing keyboard" />
      </section>

      <section className="workbench" aria-label="Poem console">
        <header className="topbar">
          <div>
            <p className="eyebrow">Infinite Monkey</p>
            <h1>无限猴子诗社</h1>
          </div>
          <div className={`status status-${status}`}>{statusText(status)}</div>
        </header>

        <div className="dashboard">
          <form className="panel controls" onSubmit={start}>
            <label>
              cc-switch
              <input
                value={settings.baseUrl}
                onChange={(event) => setSettings((current) => ({ ...current, baseUrl: event.target.value }))}
              />
            </label>

            <div className="field-row">
              <label>
                协议
                <select
                  value={settings.protocol}
                  onChange={(event) =>
                    setSettings((current) => ({ ...current, protocol: event.target.value as "anthropic" | "openai" }))
                  }
                >
                  <option value="anthropic">Anthropic Messages</option>
                  <option value="openai">OpenAI Chat</option>
                </select>
              </label>
              <label>
                温度
                <input
                  type="number"
                  min="0"
                  max="2"
                  step="0.1"
                  value={settings.temperature}
                  onChange={(event) => setSettings((current) => ({ ...current, temperature: Number(event.target.value) }))}
                />
              </label>
            </div>

            <div className="route-note">
              模型由 cc-switch 全局路由决定；本应用只选择请求协议。
            </div>

            <label>
              API Key
              <input
                type="password"
                value={settings.apiKey}
                onChange={(event) => setSettings((current) => ({ ...current, apiKey: event.target.value }))}
                placeholder="可留空"
              />
            </label>

            <label>
              主题
              <div className="theme-row">
                <input
                  value={settings.theme}
                  onChange={(event) => setSettings((current) => ({ ...current, theme: event.target.value }))}
                  placeholder="留空则掷骰"
                />
                <button type="button" className="icon-button" onClick={rollTheme} title="掷骰">
                  ⚂
                </button>
              </div>
            </label>

            <div className="field-row chars">
              <label>
                第 1 字
                <input
                  maxLength={4}
                  value={settings.firstChar}
                  onChange={(event) => setSettings((current) => ({ ...current, firstChar: asSingleGlyph(event.target.value) }))}
                />
              </label>
              <label>
                第 2 字
                <input
                  maxLength={4}
                  value={settings.secondChar}
                  onChange={(event) => setSettings((current) => ({ ...current, secondChar: asSingleGlyph(event.target.value) }))}
                />
              </label>
              <label>
                第 3 字
                <input
                  maxLength={4}
                  value={settings.thirdChar}
                  onChange={(event) => setSettings((current) => ({ ...current, thirdChar: asSingleGlyph(event.target.value) }))}
                />
              </label>
            </div>

            <div className="field-row">
              <label>
                轮数
                <input
                  type="number"
                  min="1"
                  max="200"
                  value={settings.maxRounds}
                  onChange={(event) => setSettings((current) => ({ ...current, maxRounds: Number(event.target.value) }))}
                />
              </label>
              <label>
                间隔 ms
                <input
                  type="number"
                  min="250"
                  max="30000"
                  step="250"
                  value={settings.intervalMs}
                  onChange={(event) => setSettings((current) => ({ ...current, intervalMs: Number(event.target.value) }))}
                />
              </label>
            </div>

            <div className="actions">
              <button type="submit" disabled={running}>
                启动
              </button>
              <button type="button" className="secondary" onClick={stop} disabled={!running}>
                停止
              </button>
            </div>
          </form>

          <section className="panel meters" aria-label="Metrics">
            <div className="meter">
              <span>约束</span>
              <strong>{constraintPreview}</strong>
            </div>
            <div className="meter">
              <span>Tokens</span>
              <strong>{metrics.totalTokens.toLocaleString()}</strong>
            </div>
            <div className="meter">
              <span>估算 $</span>
              <strong>{metrics.totalEstimatedCost.toFixed(6)}</strong>
            </div>
            <div className="meter">
              <span>荒诞</span>
              <strong>{metrics.absurdity}%</strong>
            </div>
          </section>

          <section className="panel stream" aria-label="Poem stream">
            {error ? <div className="error">{error}</div> : null}
            {rounds.length === 0 && !error ? <div className="empty">等待第一首诗落地。</div> : null}
            {rounds
              .slice()
              .reverse()
              .map((round) => (
                <article className="poem" key={`${round.runId}-${round.round}`}>
                  <header>
                    <span>#{round.round}</span>
                    <span>{round.routedModel ? `cc-switch: ${round.routedModel}` : `${round.completionTokens} completion tokens`}</span>
                  </header>
                  <pre>{round.poem}</pre>
                </article>
              ))}
          </section>
        </div>
      </section>
    </main>
  );
}
