import { type FormEvent, type WheelEvent, useEffect, useMemo, useRef, useState } from "react";
import { layoutWithLines, prepareWithSegments } from "@chenglou/pretext";
import * as THREE from "three";

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
  lifespan: number;
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
    
    const speed = layer === "far" ? 42 + Math.random() * 49 : layer === "mid" ? 101 + Math.random() * 91 : 182 + Math.random() * 156;
    // 计算到底部的时长
    const timeToBottom = (height + textLength * step) / speed;
    // 生命周期控制在落到底部之前的随机时间，部分也会落到底部
    const lifespan = timeToBottom * (0.35 + Math.random() * 0.8);

    columns.push({
      id: i,
      x: Math.random() * width,
      speed,
      offset: Math.random() * lifespan,
      fontSize,
      step,
      length: textLength,
      alpha: layer === "far" ? 0.12 + Math.random() * 0.1 : layer === "mid" ? 0.24 + Math.random() * 0.18 : 0.46 + Math.random() * 0.28,
      drift: 0,
      text,
      layer,
      lifespan
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
      // 当前经历的生命周期时间
      const age = (elapsedSeconds + column.offset) % column.lifespan;
      // 头部Y坐标从屏幕最顶端上方开始，平滑向下落
      const headY = age * column.speed - column.length * column.step;
      const driftX = 0; 
      
      // 快结束生命周期时全局淡出，防止突然消失
      const lifeFade = age > column.lifespan - 1.5 ? Math.max(0, (column.lifespan - age) / 1.5) : 1.0;
      
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
        const finalAlpha = baseAlpha * column.alpha * 2.5 * edgeFade * layerMultiplier * lifeFade;
        
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
const FisheyePoemRenderer = ({ headerText, displayPoem, running, tilt }: any) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const canvas2dRef = useRef<HTMLCanvasElement | null>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const textureRef = useRef<THREE.CanvasTexture | null>(null);
  const [cursorVisible, setCursorVisible] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => setCursorVisible(v => !v), 530);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!mountRef.current) return;
    
    const canvas2d = document.createElement('canvas');
    canvas2d.width = 1024;
    canvas2d.height = 827; // Aspect ratio of the container (268.8 / 332.8)
    canvas2dRef.current = canvas2d;
    
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 1;
    
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(1024, 827); 
    mountRef.current.appendChild(renderer.domElement);
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';

    const texture = new THREE.CanvasTexture(canvas2d);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    textureRef.current = texture;

    const vertexShader = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    // OpenCV Fisheye Distortion Shader
    const fragmentShader = `
      varying vec2 vUv;
      uniform sampler2D tDiffuse;
      uniform float k1;
      uniform float k2;
      uniform float k3;
      uniform float k4;
      uniform float deadZone;
      uniform float time;
      uniform float scanlineIntensity;
      uniform float rollIntensity;
      uniform float scanlineCount;
      
      void main() {
        // Normalize to -1..1
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        
        // 中央非畸变区域 (dead zone)，超出该半径才开始计算 theta 畸变
        float theta = max(0.0, r - deadZone); 
        float theta2 = theta * theta;
        float theta4 = theta2 * theta2;
        float theta6 = theta4 * theta2;
        float theta8 = theta4 * theta4;
        
        // Inverse scaling polynomial
        float scale = 1.0 + k1 * theta2 + k2 * theta4 + k3 * theta6 + k4 * theta8;
        
        vec2 p_source = p * scale;
        vec2 uv = p_source * 0.5 + 0.5;
        
        if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
          gl_FragColor = vec4(0.0);
        } else {
          vec4 color = texture2D(tDiffuse, uv);
          
          // CRT 扫描线 (基于未畸变的 uv，从而让扫描线跟随屏幕一起弯曲)
          // 高频细小扫描线
          float scanline = sin(uv.y * scanlineCount) * scanlineIntensity; 
          // 低频慢速滚动条带
          float roll = sin(uv.y * 6.0 - time * 3.0) * rollIntensity;
          
          color.rgb *= (1.0 - scanline - roll);
          
          gl_FragColor = color;
        }
      }
    `;

    const material = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: texture },
        k1: { value: tilt.k1 || 0 },
        k2: { value: tilt.k2 || 0 },
        k3: { value: tilt.k3 || 0 },
        k4: { value: tilt.k4 || 0 },
        deadZone: { value: tilt.deadZone || 0 },
        time: { value: 0 },
        scanlineIntensity: { value: tilt.scanline || 0 },
        rollIntensity: { value: tilt.roll || 0 },
        scanlineCount: { value: tilt.scanlineCount || 1200 }
      },
      vertexShader,
      fragmentShader,
      transparent: true
    });
    materialRef.current = material;

    const geometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    let animationFrameId: number;
    const renderScene = () => {
      material.uniforms.time.value += 0.016;
      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(renderScene);
    };
    renderScene();

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.dispose();
      texture.dispose();
      renderer.dispose();
    };
  }, []); // Run once on mount

  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.k1.value = tilt.k1;
      materialRef.current.uniforms.k2.value = tilt.k2;
      materialRef.current.uniforms.k3.value = tilt.k3;
      materialRef.current.uniforms.k4.value = tilt.k4;
      materialRef.current.uniforms.deadZone.value = tilt.deadZone;
      materialRef.current.uniforms.scanlineIntensity.value = tilt.scanline;
      materialRef.current.uniforms.rollIntensity.value = tilt.roll;
      materialRef.current.uniforms.scanlineCount.value = tilt.scanlineCount;
    }
  }, [tilt.k1, tilt.k2, tilt.k3, tilt.k4, tilt.deadZone, tilt.scanline, tilt.roll, tilt.scanlineCount]);

  useEffect(() => {
    const canvas = canvas2dRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'rgba(0, 255, 153, 0.8)';
    ctx.font = '36px "Courier New", Courier, monospace';
    ctx.textBaseline = 'top'; // 统一使用 top 作为基线，防止文字垂直偏移
    ctx.fillText("MONKEY.SYS v2.0.0", 20, 30);
    const rightTextWidth = ctx.measureText(headerText).width;
    ctx.fillText(headerText, canvas.width - rightTextWidth - 20, 30);

    ctx.beginPath();
    ctx.moveTo(20, 80);
    ctx.lineTo(canvas.width - 20, 80);
    ctx.strokeStyle = 'rgba(0, 255, 153, 0.3)';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.font = '48px "Courier New", Courier, monospace';
    ctx.fillStyle = 'rgba(0, 255, 153, 1)';
    
    const textToDraw = displayPoem || "Awaiting input...\n\n";
    const lines = textToDraw.split('\n');
    let y = 120; // 调整初始高度
    const x = 50;
    const lineHeight = 72;

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      // 若原文本中带有下划线作为光标占位，可在此忽略
      if (line === "_") line = "";
      if (line.endsWith("_")) line = line.slice(0, -1);
      
      ctx.fillText(line, x, y);
      
      // 在最后一行绘制闪烁的物理光标块
      if (i === lines.length - 1 && cursorVisible) {
        const textWidth = ctx.measureText(line).width;
        // 因为 baseline=top，y 代表字符顶部，所以光标从 y+5 开始画，高度约42
        ctx.fillRect(x + textWidth + 5, y + 5, 25, 42);
      }
      y += lineHeight;
    }

    if (textureRef.current) {
      textureRef.current.needsUpdate = true;
    }
  }, [headerText, displayPoem, cursorVisible]);

  return <div ref={mountRef} style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }} />;
};


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
  const [tilt, setTilt] = useState({ 
    perspective: 1400, translateX: 7, translateY: 9, scale: 1.14, 
    rotateX: 18, rotateY: 17, rotateZ: -3,
    // OpenCV Calib3d Fisheye Coefficients
    k1: -0.02, k2: 0.02, k3: 0.06, k4: -0.01, deadZone: 0.15,
    // Lens Post Processing
    lensRadius: 0, lensGlare: 0.06, lensGlareSize: 54, lensVignette: 0.55, lensShadow: 33,
    // CRT Scanlines
    scanline: 0.08, roll: 0.05, scanlineCount: 1200
  });
  const [showDebugger, setShowDebugger] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '`' || e.key === '~') {
        setShowDebugger(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
          <div style={{
            position: 'absolute',
            left: '49.6%', top: '34.8%', width: '20.8%', height: '25.2%',
            transform: `perspective(${tilt.perspective}px) translateX(${tilt.translateX}px) translateY(${tilt.translateY}px) scale(${tilt.scale}) rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY}deg) rotateZ(${tilt.rotateZ}deg)`,
            transformOrigin: "center center",
            transition: "transform 0.1s ease-out"
          }}>
            {showDebugger && (
              <div style={{
                position: 'absolute',
                left: 0, top: 0, width: '100%', height: '100%',
                border: '1px solid rgba(255, 0, 50, 0.8)',
                boxShadow: '0 0 10px rgba(255, 0, 50, 0.5) inset, 0 0 10px rgba(255, 0, 50, 0.5)',
                pointerEvents: 'none',
                zIndex: 10
              }}></div>
            )}
            
            {/* 屏幕玻璃透镜后处理层 */}
            <div style={{
              position: 'absolute',
              left: '-2%', top: '-2%', width: '104%', height: '104%',
              pointerEvents: 'none',
              zIndex: 20,
              borderRadius: `${tilt.lensRadius}%`,
              background: `radial-gradient(circle at 50% 50%, rgba(255,255,255,${tilt.lensGlare}) 0%, rgba(0,0,0,0) ${tilt.lensGlareSize}%, rgba(0,10,0,${tilt.lensVignette}) 95%)`,
              boxShadow: `inset 0 0 ${tilt.lensShadow}px rgba(0,0,0,0.9), inset 0 0 8px rgba(0,255,153,0.2)`
            }}></div>

            <FisheyePoemRenderer headerText={headerText} displayPoem={displayPoem} running={running} tilt={tilt} />
          </div>
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

      {showDebugger && (
      <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 9999, background: 'rgba(0,10,0,0.85)', padding: '15px', border: '1px solid #00ff66', color: '#00ff66', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', fontFamily: 'monospace', width: '320px', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 0 15px rgba(0,255,102,0.3)' }}>
        <strong style={{ borderBottom: '1px solid #00ff66', paddingBottom: '8px', marginBottom: '5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: '-15px', background: 'rgba(0,10,0,0.95)', paddingTop: '15px', zIndex: 2 }}>
          <span>CRT TEXT TILT DEBUGGER</span>
          <button type="button" style={{padding: '2px 8px', fontSize: '10px', minWidth: 'auto', margin: 0, height: 'auto', lineHeight: 1}} onClick={() => navigator.clipboard.writeText(JSON.stringify(tilt, null, 2)).then(() => alert('Copied!'))}>COPY</button>
        </strong>
        <style>
          {`
            details summary { cursor: pointer; user-select: none; padding: 5px 0; font-weight: bold; border-bottom: 1px dashed rgba(0,255,102,0.3); outline: none; }
            details summary:hover { color: #fff; }
            details > div { display: flex; flex-direction: column; gap: 8px; padding: 10px 0 10px 10px; margin-bottom: 5px; border-left: 2px solid rgba(0,255,102,0.2); background: rgba(0,255,102,0.02); }
          `}
        </style>

        <details open>
          <summary>📺 CRT WebGL Shader</summary>
          <div>
            <label style={{display:'flex', justifyContent:'space-between', alignItems: 'center', margin: 0}}>Scanline Intensity
              <input type="range" min="0" max="0.3" step="0.01" value={tilt.scanline} onChange={e => setTilt(t => ({...t, scanline: +e.target.value}))} style={{width: '100px', margin: 0}} /> <span style={{width: '30px', textAlign: 'right'}}>{tilt.scanline.toFixed(2)}</span>
            </label>
            <label style={{display:'flex', justifyContent:'space-between', alignItems: 'center', margin: 0}}>Scanline Density
              <input type="range" min="200" max="3000" step="50" value={tilt.scanlineCount} onChange={e => setTilt(t => ({...t, scanlineCount: +e.target.value}))} style={{width: '100px', margin: 0}} /> <span style={{width: '30px', textAlign: 'right'}}>{tilt.scanlineCount}</span>
            </label>
            <label style={{display:'flex', justifyContent:'space-between', alignItems: 'center', margin: 0}}>Roll Sync Pulse
              <input type="range" min="0" max="0.3" step="0.01" value={tilt.roll} onChange={e => setTilt(t => ({...t, roll: +e.target.value}))} style={{width: '100px', margin: 0}} /> <span style={{width: '30px', textAlign: 'right'}}>{tilt.roll.toFixed(2)}</span>
            </label>
          </div>
        </details>

        <details>
          <summary>👁️ OpenCV Fisheye Distortion</summary>
          <div>
            <label style={{display:'flex', justifyContent:'space-between', alignItems: 'center', margin: 0}}>K1 (Radial 2nd)
              <input type="range" min="-1" max="1" step="0.01" value={tilt.k1} onChange={e => setTilt(t => ({...t, k1: +e.target.value}))} style={{width: '100px', margin: 0}} /> <span style={{width: '30px', textAlign: 'right'}}>{tilt.k1.toFixed(2)}</span>
            </label>
            <label style={{display:'flex', justifyContent:'space-between', alignItems: 'center', margin: 0}}>K2 (Radial 4th)
              <input type="range" min="-1" max="1" step="0.01" value={tilt.k2} onChange={e => setTilt(t => ({...t, k2: +e.target.value}))} style={{width: '100px', margin: 0}} /> <span style={{width: '30px', textAlign: 'right'}}>{tilt.k2.toFixed(2)}</span>
            </label>
            <label style={{display:'flex', justifyContent:'space-between', alignItems: 'center', margin: 0}}>K3 (Radial 6th)
              <input type="range" min="-1" max="1" step="0.01" value={tilt.k3} onChange={e => setTilt(t => ({...t, k3: +e.target.value}))} style={{width: '100px', margin: 0}} /> <span style={{width: '30px', textAlign: 'right'}}>{tilt.k3.toFixed(2)}</span>
            </label>
            <label style={{display:'flex', justifyContent:'space-between', alignItems: 'center', margin: 0}}>K4 (Radial 8th)
              <input type="range" min="-1" max="1" step="0.01" value={tilt.k4} onChange={e => setTilt(t => ({...t, k4: +e.target.value}))} style={{width: '100px', margin: 0}} /> <span style={{width: '30px', textAlign: 'right'}}>{tilt.k4.toFixed(2)}</span>
            </label>
            <label style={{display:'flex', justifyContent:'space-between', alignItems: 'center', margin: 0}}>Center Dead Zone
              <input type="range" min="0" max="1" step="0.05" value={tilt.deadZone} onChange={e => setTilt(t => ({...t, deadZone: +e.target.value}))} style={{width: '100px', margin: 0}} /> <span style={{width: '30px', textAlign: 'right'}}>{tilt.deadZone.toFixed(2)}</span>
            </label>
          </div>
        </details>

        <details>
          <summary>💡 Glass Lens Post-Process</summary>
          <div>
            <label style={{display:'flex', justifyContent:'space-between', alignItems: 'center', margin: 0}}>Lens Glare
              <input type="range" min="0" max="0.5" step="0.01" value={tilt.lensGlare} onChange={e => setTilt(t => ({...t, lensGlare: +e.target.value}))} style={{width: '100px', margin: 0}} /> <span style={{width: '30px', textAlign: 'right'}}>{tilt.lensGlare.toFixed(2)}</span>
            </label>
            <label style={{display:'flex', justifyContent:'space-between', alignItems: 'center', margin: 0}}>Glare Radius
              <input type="range" min="0" max="80" step="1" value={tilt.lensGlareSize} onChange={e => setTilt(t => ({...t, lensGlareSize: +e.target.value}))} style={{width: '100px', margin: 0}} /> <span style={{width: '30px', textAlign: 'right'}}>{tilt.lensGlareSize}</span>
            </label>
            <label style={{display:'flex', justifyContent:'space-between', alignItems: 'center', margin: 0}}>Edge Vignette
              <input type="range" min="0" max="1" step="0.05" value={tilt.lensVignette} onChange={e => setTilt(t => ({...t, lensVignette: +e.target.value}))} style={{width: '100px', margin: 0}} /> <span style={{width: '30px', textAlign: 'right'}}>{tilt.lensVignette.toFixed(2)}</span>
            </label>
            <label style={{display:'flex', justifyContent:'space-between', alignItems: 'center', margin: 0}}>Inner Shadow
              <input type="range" min="0" max="100" step="1" value={tilt.lensShadow} onChange={e => setTilt(t => ({...t, lensShadow: +e.target.value}))} style={{width: '100px', margin: 0}} /> <span style={{width: '30px', textAlign: 'right'}}>{tilt.lensShadow}</span>
            </label>
            <label style={{display:'flex', justifyContent:'space-between', alignItems: 'center', margin: 0}}>Corner Radius
              <input type="range" min="0" max="50" step="1" value={tilt.lensRadius} onChange={e => setTilt(t => ({...t, lensRadius: +e.target.value}))} style={{width: '100px', margin: 0}} /> <span style={{width: '30px', textAlign: 'right'}}>{tilt.lensRadius}%</span>
            </label>
          </div>
        </details>

        <details>
          <summary>🖥️ CSS 3D Transform</summary>
          <div>
            <label style={{display:'flex', justifyContent:'space-between', alignItems: 'center', margin: 0}}>Perspective
              <input type="range" min="100" max="3000" step="50" value={tilt.perspective} onChange={e => setTilt(t => ({...t, perspective: +e.target.value}))} style={{width: '100px', margin: 0}} /> <span style={{width: '30px', textAlign: 'right'}}>{tilt.perspective}</span>
            </label>
            <label style={{display:'flex', justifyContent:'space-between', alignItems: 'center', margin: 0}}>Translate X
              <input type="range" min="-500" max="500" value={tilt.translateX} onChange={e => setTilt(t => ({...t, translateX: +e.target.value}))} style={{width: '100px', margin: 0}} /> <span style={{width: '30px', textAlign: 'right'}}>{tilt.translateX}</span>
            </label>
            <label style={{display:'flex', justifyContent:'space-between', alignItems: 'center', margin: 0}}>Translate Y
              <input type="range" min="-500" max="500" value={tilt.translateY} onChange={e => setTilt(t => ({...t, translateY: +e.target.value}))} style={{width: '100px', margin: 0}} /> <span style={{width: '30px', textAlign: 'right'}}>{tilt.translateY}</span>
            </label>
            <label style={{display:'flex', justifyContent:'space-between', alignItems: 'center', margin: 0}}>Scale
              <input type="range" min="0.5" max="2" step="0.01" value={tilt.scale} onChange={e => setTilt(t => ({...t, scale: +e.target.value}))} style={{width: '100px', margin: 0}} /> <span style={{width: '30px', textAlign: 'right'}}>{tilt.scale.toFixed(2)}</span>
            </label>
            <label style={{display:'flex', justifyContent:'space-between', alignItems: 'center', margin: 0}}>Rotate X
              <input type="range" min="-90" max="90" value={tilt.rotateX} onChange={e => setTilt(t => ({...t, rotateX: +e.target.value}))} style={{width: '100px', margin: 0}} /> <span style={{width: '30px', textAlign: 'right'}}>{tilt.rotateX}</span>
            </label>
            <label style={{display:'flex', justifyContent:'space-between', alignItems: 'center', margin: 0}}>Rotate Y
              <input type="range" min="-90" max="90" value={tilt.rotateY} onChange={e => setTilt(t => ({...t, rotateY: +e.target.value}))} style={{width: '100px', margin: 0}} /> <span style={{width: '30px', textAlign: 'right'}}>{tilt.rotateY}</span>
            </label>
            <label style={{display:'flex', justifyContent:'space-between', alignItems: 'center', margin: 0}}>Rotate Z
              <input type="range" min="-90" max="90" value={tilt.rotateZ} onChange={e => setTilt(t => ({...t, rotateZ: +e.target.value}))} style={{width: '100px', margin: 0}} /> <span style={{width: '30px', textAlign: 'right'}}>{tilt.rotateZ}</span>
            </label>
          </div>
        </details>

      </div>
      )}
    </div>
  );
}
