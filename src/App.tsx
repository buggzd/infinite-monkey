import { type FormEvent, type WheelEvent, useEffect, useMemo, useRef, useState } from "react";
import { layoutWithLines, prepareWithSegments } from "@chenglou/pretext";

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

type StoredPoem = {
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
  protocol: "anthropic" | "openai";
  createdAt: string;
};

type LibraryStats = {
  poemCount: number;
  totalTokens: number;
  completionTokens: number;
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
    idle: "OFFLINE",
    starting: "INIT...",
    running: "SYNCING",
    stopped: "PAUSED",
    done: "COMPLETE",
    error: "ERR_FAULT"
  };
  return map[status] ?? status;
}

function friendlyError(message: string) {
  if (message.includes("全部渠道不可提供当前模型")) {
    return `${message}\n\nNo available channels in global route. Check cc-switch.`;
  }
  if (message.includes("404")) {
    return `${message}\n\nEndpoint path mismatch (404).`;
  }
  return message;
}

type RainPoem = Pick<StoredPoem, "theme" | "poem">;
type RainVariant = "backdrop" | "scene";
type RainColumn = {
  id: number;
  x: number;
  speed: number;
  offset: number;
  fontSize: number;
  step: number;
  length: number;
  alpha: number;
  drift: number;
  text: string;
  layer: "far" | "mid" | "near";
};

const fallbackRainPoems: RainPoem[] = [
  {
    theme: "BOOT_SEQUENCE",
    poem: "INFINITE MONKEY // TOKEN RAIN // 詩 // LOOP // 404 // 無限 // STATIC"
  },
  {
    theme: "MONKEY_SYS",
    poem: "月光里\nalgorithm\nchaos\npoetry\n0 1 0 1\n夢"
  }
];

const rainGlyphs = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz无限猴子诗静夜算法荒诞数据库月光夢詩雨電脳未来過去言葉記憶あいうえおカキクケコアイウエオ";

function randomFrom(value: string) {
  const glyphs = Array.from(value);
  return glyphs[Math.floor(Math.random() * glyphs.length)] ?? "0";
}

function makeRainText(poem: RainPoem, length: number) {
  const seed = `${poem.theme}${poem.poem}`.replace(/\s/g, "");
  return Array.from({ length }, (_, index) => {
    if (seed && Math.random() > 0.42) return randomFrom(seed);
    if (index % 11 === 0) return randomFrom("無限詩夢AI");
    return randomFrom(rainGlyphs);
  }).join("");
}

function buildRainSources(poems: StoredPoem[]) {
  const source = poems.length > 0 ? poems.slice(0, 14) : fallbackRainPoems;
  const font = '14px "Courier New", Courier, monospace';

  return source.map((poem) => {
    const rawText = `${poem.theme || "STATIC"}\n${poem.poem || fallbackRainPoems[0].poem}`;
    const prepared = prepareWithSegments(rawText, font, { whiteSpace: "pre-wrap", wordBreak: "keep-all" });
    const { lines } = layoutWithLines(prepared, 280, 18);
    const measuredText = lines.map((line) => line.text).join("");
    return measuredText || makeRainText(poem, 120);
  });
}

function createRainColumns(width: number, height: number, sources: string[], variant: RainVariant) {
  const count = variant === "backdrop" ? 112 : 76;
  const columns: RainColumn[] = [];

  for (let i = 0; i < count; i += 1) {
    const depth = Math.random();
    const layer: RainColumn["layer"] = depth < 0.5 ? "far" : depth < 0.84 ? "mid" : "near";
    const fontSize = layer === "far" ? 10 + Math.random() * 3 : layer === "mid" ? 13 + Math.random() * 4 : 18 + Math.random() * 6;
    const step = fontSize * (layer === "near" ? 1.18 : 1.1);
    const seed = sources[Math.floor(Math.random() * sources.length)] || rainGlyphs;
    const textLength = layer === "near" ? 42 : layer === "mid" ? 36 : 30;
    const text = makeRainText({ theme: "RAIN", poem: seed }, textLength + 24);
    const travel = height + textLength * step + 260;

    columns.push({
      id: i,
      x: Math.random() * width,
      speed: layer === "far" ? 42 + Math.random() * 49 : layer === "mid" ? 101 + Math.random() * 91 : 182 + Math.random() * 156,
      offset: Math.random() * travel,
      fontSize,
      step,
      length: textLength,
      alpha: layer === "far" ? 0.12 + Math.random() * 0.1 : layer === "mid" ? 0.24 + Math.random() * 0.18 : 0.46 + Math.random() * 0.28,
      drift: (Math.random() - 0.5) * (layer === "near" ? 46 : 22),
      text,
      layer
    });
  }

  return columns;
}

function MatrixRain({ poems, variant }: { poems: StoredPoem[]; variant: RainVariant }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sources = useMemo(() => buildRainSources(poems), [poems]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return undefined;

    let width = 0;
    let height = 0;
    let frame = 0;
    let lastPaint = 0;
    let columns: RainColumn[] = [];
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);

    const resize = () => {
      width = Math.max(1, canvas.clientWidth);
      height = Math.max(1, canvas.clientHeight);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.textAlign = "center";
      context.textBaseline = "middle";
      columns = createRainColumns(width, height, sources, variant);
    };

    const drawColumn = (column: RainColumn, elapsedSeconds: number) => {
      const travel = height + column.length * column.step + 260;
      const headY = ((elapsedSeconds * column.speed + column.offset) % travel) - column.length * column.step - 120;
      const driftX = 0; // 移除左右飘动
      
      const highlightCycle = column.length + 15;
      const highlightSpeed = column.layer === "near" ? 8 : column.layer === "mid" ? 5 : 3;
      // 以文字为最小变色单位，使用 Math.floor 使高亮逐字跳跃
      const H = Math.floor((elapsedSeconds * highlightSpeed + column.id * 2.3) % highlightCycle);
      const highlightY = headY - H * column.step;

      if (column.layer !== "far") {
        const glowHeight = column.layer === "near" ? 120 : 80;
        const gradient = context.createLinearGradient(
          column.x + driftX, highlightY - glowHeight * 0.8, 
          column.x + driftX, highlightY + glowHeight * 0.6
        );
        gradient.addColorStop(0, "rgba(0,255,94,0)");
        gradient.addColorStop(0.5, `rgba(0,255,94,${column.alpha * 0.15})`);
        gradient.addColorStop(0.8, `rgba(199,255,221,${column.alpha * 0.4})`);
        gradient.addColorStop(1, "rgba(220,255,235,0)");
        context.fillStyle = gradient;
        context.fillRect(
          column.x + driftX - column.fontSize * 0.8, 
          highlightY - glowHeight * 0.8, 
          column.fontSize * 1.6, 
          glowHeight * 1.4
        );
      }

      context.font = `${column.layer === "near" ? 700 : 500} ${column.fontSize}px "Courier New", Courier, monospace`;

      for (let index = 0; index < column.length; index += 1) {
        const y = headY - index * column.step;
        if (y < -40 || y > height + 40) continue;

        const distance = index - H;
        let baseAlpha = 0;
        let isHighlight = false;

        if (distance === 0) {
            // 高亮位置
            baseAlpha = 1.0;
            isHighlight = true;
        } else if (distance > 0) {
            // 高亮上方的尾部：整体调亮绿
            const tailFade = 1 - (distance / Math.max(1, column.length - H));
            baseAlpha = 0.65 * Math.pow(tailFade, 1.1);
        } else {
            // 高亮下方的头部：迅速变暗然后消失
            const falloff = -distance;
            if (falloff <= 3) {
                baseAlpha = 0.8 * Math.pow(1 - falloff / 4, 2);
            } else {
                baseAlpha = 0;
            }
        }

        const edgeFade = y < 80 ? Math.max(0, y / 80) : y > height - 80 ? Math.max(0, (height - y) / 80) : 1;
        // 增加雨的层次感
        const layerMultiplier = column.layer === "near" ? 1.3 : column.layer === "mid" ? 0.9 : 0.5;
        const finalAlpha = baseAlpha * column.alpha * 2.5 * edgeFade * layerMultiplier;
        
        if (finalAlpha <= 0.01) continue;

        const char = column.text[(index + column.id) % column.text.length] || randomFrom(rainGlyphs);
        
        context.globalAlpha = Math.min(1, finalAlpha);
        
        if (isHighlight) {
            // 头部发光强度高
            context.fillStyle = column.layer === "near" ? "#ffffff" : column.layer === "mid" ? "#eafff3" : "#c7ffdd";
        } else {
            // 层次感颜色区分，尾部未高亮部分调亮绿色
            context.fillStyle = column.layer === "near" ? "#1aff75" : column.layer === "mid" ? "#00e65c" : "#009933";
        }
        
        context.fillText(char, column.x + driftX, y);
      }
      context.globalAlpha = 1;
    };

    const render = (timestamp: number) => {
      frame = requestAnimationFrame(render);
      if (timestamp - lastPaint < 33) return;
      lastPaint = timestamp;

      context.clearRect(0, 0, width, height);
      const elapsedSeconds = timestamp / 1000;
      for (const column of columns) drawColumn(column, elapsedSeconds);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    frame = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [sources, variant]);

  return <canvas ref={canvasRef} className={`matrix-rain matrix-rain-${variant}`} aria-hidden="true" />;
}

export function App() {
  const [settings, setSettings] = useState(defaultSettings);
  const [rounds, setRounds] = useState<PoemRound[]>([]);
  const [libraryPoems, setLibraryPoems] = useState<StoredPoem[]>([]);
  const [libraryStats, setLibraryStats] = useState<LibraryStats>({ poemCount: 0, totalTokens: 0, completionTokens: 0 });
  const [status, setStatus] = useState("idle");
  const [runId, setRunId] = useState("");
  const [activeConfig, setActiveConfig] = useState<RunConfig | null>(null);
  const [error, setError] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [view, setView] = useState<"studio" | "library">("studio");
  const [libraryIndex, setLibraryIndex] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);

  const latestRound = rounds.at(-1);
  const metrics = useMemo(() => {
    const totalTokens = latestRound?.totalTokens ?? 0;
    const callCount = rounds.length;
    return { totalTokens, callCount };
  }, [latestRound]);

  useEffect(() => {
    void loadLibrary();

    const updateScale = () => {
      const designWidth = 1600;
      const designHeight = designWidth * 2 / 3;
      const scale = Math.min(window.innerWidth / designWidth, window.innerHeight / designHeight);
      document.documentElement.style.setProperty("--stage-scale", scale.toString());
    };
    window.addEventListener('resize', updateScale);
    updateScale();

    return () => {
      eventSourceRef.current?.close();
      window.removeEventListener('resize', updateScale);
    };
  }, []);

  async function rollTheme() {
    const response = await fetch("/api/theme/roll");
    const data = (await response.json()) as { theme: string };
    setSettings((current) => ({ ...current, theme: data.theme }));
  }

  async function loadLibrary() {
    const [libraryResponse, statsResponse] = await Promise.all([fetch("/api/library?limit=120"), fetch("/api/library/stats")]);
    const libraryData = (await libraryResponse.json()) as { poems: StoredPoem[]; total: number };
    const statsData = (await statsResponse.json()) as LibraryStats;
    setLibraryPoems(libraryData.poems);
    setLibraryStats(statsData);
    setLibraryIndex((current) => Math.min(current, Math.max(0, libraryData.poems.length - 1)));
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
        void loadLibrary();
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
  const displayPoem = view === "studio" ? latestRound?.poem : libraryPoems[libraryIndex]?.poem;
  const headerText = view === "studio"
    ? (latestRound ? `ROUND ${latestRound.round} // ${latestRound.routedModel || "UNKNOWN"}` : "SYSTEM.READY")
    : (libraryPoems[libraryIndex] ? `ARCHIVE // ID:${libraryPoems[libraryIndex].id} // [${libraryPoems[libraryIndex].theme}]` : "EMPTY");
  const libraryWindowStart = Math.min(libraryIndex, Math.max(0, libraryPoems.length - 2));
  const visibleLibraryPoems = libraryPoems.slice(libraryWindowStart, libraryWindowStart + 2);

  function handleLibraryWheel(event: WheelEvent<HTMLDivElement>) {
    if (libraryPoems.length <= 1) return;
    event.preventDefault();
    const direction = event.deltaY > 0 ? 1 : -1;
    setLibraryIndex((current) => Math.max(0, Math.min(libraryPoems.length - 1, current + direction)));
  }

  return (
    <div className="app-scene">
      <MatrixRain poems={libraryPoems} variant="backdrop" />
      <div className="art-stage" aria-hidden="true">
        <video className="scene-video" src="/assets/src/0-monkeytypingbg.mp4" autoPlay muted loop playsInline />
        <MatrixRain poems={libraryPoems} variant="scene" />
        <div className="screen-poem">
          <div className="screen-poem-header">
            <span>MONKEY.SYS v2.0.0</span>
            <span>{headerText}</span>
          </div>
          <pre>{displayPoem ? displayPoem : "Awaiting input...\n\n_"}</pre>
          {running && <span className="cursor"></span>}
        </div>
        <img className="screen-mask" src="/assets/src/2-mask-screen-notext.png" alt="" />
      </div>

      <div className="site-frame" aria-hidden="true">
        <div className="brand-mark">∞</div>
        <nav>
          <span className="active">HOME</span>
          <span>POEMS</span>
          <span>ARCHIVE</span>
          <span>ABOUT</span>
          <span>TERMINAL</span>
        </nav>
        <span className="connect">CONNECT</span>
      </div>

      <main className="shell">
        <section className="left-rail">
          <div>
            <h1 className="glitch-text" data-text="INFINITE MONKEY">INFINITE MONKEY</h1>
            <p className="eyebrow">poetry from the static</p>
          </div>

          <div className="cyber-panel">
            <h2 className="panel-title">ALGORITHM. CHAOS. POETRY.</h2>
            <p className="panel-desc">
              An infinite monkey, an infinite time,<br/>
              and the fragile beauty it might<br/>
              accidentally create.
            </p>

            <form onSubmit={start}>
              <div className="actions">
                <button type="submit" disabled={running}>
                  &gt; START_SEQUENCE_
                </button>
                <button type="button" onClick={stop} disabled={!running}>
                  [ HALT ]
                </button>
                <button type="button" onClick={() => setSettingsOpen(!settingsOpen)}>
                  SYS_CFG
                </button>
              </div>

              {settingsOpen && (
                <div className="settings-drawer blur-in">
                  <div className="field-row">
                    <label>
                      PROTOCOL
                      <select
                        value={settings.protocol}
                        onChange={(event) => setSettings((c) => ({ ...c, protocol: event.target.value as "anthropic" | "openai" }))}
                      >
                        <option value="anthropic">ANTHROPIC</option>
                        <option value="openai">OPENAI</option>
                      </select>
                    </label>
                    <label>
                      TEMPERATURE
                      <input
                        type="number" min="0" max="2" step="0.1"
                        value={settings.temperature}
                        onChange={(event) => setSettings((c) => ({ ...c, temperature: Number(event.target.value) }))}
                      />
                    </label>
                  </div>

                  <label>
                    API_KEY
                    <input
                      type="password"
                      value={settings.apiKey}
                      onChange={(event) => setSettings((c) => ({ ...c, apiKey: event.target.value }))}
                      placeholder="leave empty for default"
                    />
                  </label>

                  <label>
                    THEME_OVERRIDE
                    <div className="theme-row">
                      <input
                        value={settings.theme}
                        onChange={(event) => setSettings((c) => ({ ...c, theme: event.target.value }))}
                        placeholder="auto_generate"
                      />
                      <button type="button" onClick={rollTheme} title="Roll Random">
                        RND
                      </button>
                    </div>
                  </label>

                  <div className="field-row chars">
                    <label>
                      CHAR_0
                      <input maxLength={4} value={settings.firstChar} onChange={(e) => setSettings((c) => ({ ...c, firstChar: asSingleGlyph(e.target.value) }))} />
                    </label>
                    <label>
                      CHAR_1
                      <input maxLength={4} value={settings.secondChar} onChange={(e) => setSettings((c) => ({ ...c, secondChar: asSingleGlyph(e.target.value) }))} />
                    </label>
                    <label>
                      CHAR_2
                      <input maxLength={4} value={settings.thirdChar} onChange={(e) => setSettings((c) => ({ ...c, thirdChar: asSingleGlyph(e.target.value) }))} />
                    </label>
                  </div>
                </div>
              )}
            </form>

            <div className="sys-status">
              <div className="status-indicator">
                <div className="dot" style={{ animationDuration: running ? '0.2s' : '1s' }}></div>
                <span>SYS STATUS<br/><span style={{color: "var(--matrix-green)"}}>{statusText(status)}</span></span>
              </div>
            </div>
          </div>

          <div className="cyber-panel">
            <div className="view-tabs">
              <button className={view === "studio" ? "active" : ""} onClick={() => setView("studio")}>STUDIO</button>
              <button className={view === "library" ? "active" : ""} onClick={() => setView("library")}>ARCHIVE</button>
            </div>

            {view === "studio" ? (
              <div className="meters blur-in">
                <div className="meter">
                  <span>ROUNDS</span>
                  <strong>{metrics.callCount}</strong>
                </div>
                <div className="meter">
                  <span>TOKENS</span>
                  <strong>{metrics.totalTokens}</strong>
                </div>
              </div>
            ) : (
              <div className="library-list blur-in" onWheel={handleLibraryWheel}>
                {visibleLibraryPoems.map((poem, offset) => {
                  const index = libraryWindowStart + offset;
                  return (
                  <div
                    key={poem.id}
                    className={`library-item ${index === libraryIndex ? "active" : ""}`}
                    onClick={() => setLibraryIndex(index)}
                  >
                    <span>{poem.firstChar}{poem.secondChar}{poem.thirdChar}</span>
                    <div>
                      <strong>{poem.theme || "STATIC_ANOMALY"}</strong>
                      <em>TOKENS: {poem.totalTokens}</em>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}

            {error && <div className="error" style={{ marginTop: "10px" }}>{error}</div>}
          </div>
        </section>
      </main>

      <div className="sys-footer">
        ∞ // MONKEY.SYS v2.0.0
      </div>
    </div>
  );
}
