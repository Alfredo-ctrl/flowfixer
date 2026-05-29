const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const storageKey = "flowfixer:cases";
const els = {
  form: $("#debugForm"),
  error: $("#errorInput"),
  stack: $("#stackInput"),
  context: $("#contextInput"),
  confidence: $("#confidenceOutput"),
  summary: $("#summaryCard"),
  signals: $("#signalList"),
  steps: $("#debugSteps"),
  commands: $("#commandList"),
  helpPrompt: $("#helpPrompt"),
  cases: $("#caseList"),
  toast: $("#toast"),
  sound: $("#soundToggle"),
  demo: $("#demoButton"),
  clear: $("#clearButton"),
  copy: $("#copyButton"),
  save: $("#saveButton"),
  export: $("#exportButton"),
  clearCases: $("#clearCasesButton"),
  canvas: $("#flowCanvas")
};

const patterns = [
  {
    key: "undefined-property",
    tests: [/cannot read (properties|property) of undefined/i, /undefined is not an object/i],
    stack: "javascript",
    title: "Valor undefined usado como objeto",
    cause: "La app intenta leer una propiedad antes de que el dato exista.",
    fix: "Valida el dato antes de usarlo, revisa respuestas async y agrega estados vacios.",
    commands: ["npm run dev", "npm test", "console.table(data)"]
  },
  {
    key: "not-function",
    tests: [/is not a function/i],
    stack: "javascript",
    title: "Funcion inexistente o tipo incorrecto",
    cause: "Una variable no contiene la funcion esperada o se importo algo distinto.",
    fix: "Imprime el valor, revisa exports/imports y confirma que el metodo existe.",
    commands: ["node --trace-warnings app.js", "npm ls", "console.log(typeof value, value)"]
  },
  {
    key: "module-not-found",
    tests: [/cannot find module/i, /module not found/i, /failed to resolve import/i],
    stack: "javascript",
    title: "Dependencia o ruta no encontrada",
    cause: "Falta instalar un paquete, el nombre esta mal escrito o la ruta relativa no apunta al archivo.",
    fix: "Revisa package.json, instala dependencias y confirma mayusculas/minusculas en rutas.",
    commands: ["npm install", "npm ls <package>", "dir /s <archivo>"]
  },
  {
    key: "syntax",
    tests: [/syntaxerror/i, /unexpected token/i, /unexpected end/i],
    stack: "javascript",
    title: "Error de sintaxis",
    cause: "Hay un caracter, llave, parentesis, coma o string sin cerrar.",
    fix: "Formatea el archivo, mira la linea exacta y revisa el bloque anterior al error.",
    commands: ["node --check src/app.js", "npm run lint", "npx prettier . --check"]
  },
  {
    key: "port",
    tests: [/eaddrinuse/i, /address already in use/i, /port .* already/i],
    stack: "javascript",
    title: "Puerto ocupado",
    cause: "Otro proceso ya esta usando el puerto del servidor.",
    fix: "Cierra el proceso anterior o usa otro puerto.",
    commands: ["netstat -ano | findstr :3000", "taskkill /PID <pid> /F", "npm run dev -- --port 5174"]
  },
  {
    key: "enoent",
    tests: [/enoent/i, /no such file or directory/i],
    stack: "javascript",
    title: "Archivo o carpeta inexistente",
    cause: "El programa busca una ruta que no existe desde el directorio actual.",
    fix: "Confirma el working directory, usa rutas absolutas cuando aplique y crea la carpeta faltante.",
    commands: ["pwd", "dir", "node -e \"console.log(process.cwd())\""]
  },
  {
    key: "cors",
    tests: [/cors/i, /access-control-allow-origin/i, /blocked by cors/i],
    stack: "web",
    title: "Bloqueo CORS",
    cause: "El navegador bloqueo una peticion a otro origen por configuracion del servidor.",
    fix: "Configura headers CORS en el backend o usa un proxy de desarrollo.",
    commands: ["curl -I <url>", "npm run dev", "verifica headers en Network"]
  },
  {
    key: "python-module",
    tests: [/modulenotfounderror/i, /no module named/i],
    stack: "python",
    title: "Modulo Python no instalado",
    cause: "El entorno Python activo no tiene instalado el paquete.",
    fix: "Activa el entorno correcto e instala el paquete en ese mismo Python.",
    commands: ["python -m pip install <paquete>", "python -m pip show <paquete>", "where python"]
  },
  {
    key: "python-indent",
    tests: [/indentationerror/i, /expected an indented block/i],
    stack: "python",
    title: "Indentacion invalida",
    cause: "Python no pudo interpretar el bloque por espacios o tabs mal colocados.",
    fix: "Unifica espacios, revisa el bloque anterior y evita mezclar tabs con espacios.",
    commands: ["python -m py_compile archivo.py", "python archivo.py"]
  },
  {
    key: "git-conflict",
    tests: [/merge conflict/i, /fix conflicts/i, /unmerged paths/i],
    stack: "git",
    title: "Conflicto de merge",
    cause: "Git no pudo combinar cambios en los mismos archivos automaticamente.",
    fix: "Abre los archivos marcados, elige cambios correctos, elimina marcadores y confirma.",
    commands: ["git status", "git diff", "git add .", "git commit"]
  },
  {
    key: "permission",
    tests: [/permission denied/i, /eacces/i, /access is denied/i],
    stack: "system",
    title: "Permiso denegado",
    cause: "El proceso no tiene acceso al archivo, carpeta o comando.",
    fix: "Revisa permisos, procesos usando el archivo y ubicacion del proyecto.",
    commands: ["whoami", "icacls <ruta>", "Get-Process | Where-Object { $_.Path -like '*nombre*' }"]
  },
  {
    key: "android-gradle",
    tests: [/gradle/i, /sdk location/i, /android manifest/i],
    stack: "android",
    title: "Configuracion Android o Gradle",
    cause: "El build necesita SDK, version de Gradle o manifest correcto.",
    fix: "Confirma SDK, limpia build y revisa versiones de plugins.",
    commands: ["gradlew clean", "gradlew assembleDebug", "echo %ANDROID_HOME%"]
  }
];

const stackCommands = {
  javascript: ["npm install", "npm run dev", "npm test", "node --check <archivo>"],
  react: ["npm run dev", "npm run build", "npm ls react", "revisa la consola del navegador"],
  python: ["python -m pip install -r requirements.txt", "python -m py_compile <archivo.py>", "python <archivo.py>"],
  git: ["git status", "git diff", "git log --oneline -5"],
  android: ["gradlew clean", "gradlew assembleDebug", "adb devices"],
  web: ["abre DevTools > Console", "revisa Network", "npx vite --host 127.0.0.1"],
  auto: ["reproduce el error", "lee la primera linea real", "aisla el archivo minimo"]
};

let currentMode = "quick";
let currentReport = "";
let lastAnalysis;
let soundEnabled = true;
let audioContext;

function detectStack(text, selected) {
  if (selected !== "auto") return selected;
  const lower = text.toLowerCase();

  if (/modulenotfounderror|traceback|indentationerror|python/.test(lower)) return "python";
  if (/react|vite|jsx|tsx|hydration/.test(lower)) return "react";
  if (/git|merge conflict|unmerged/.test(lower)) return "git";
  if (/gradle|android|manifest|sdk/.test(lower)) return "android";
  if (/css|cors|html|domexception/.test(lower)) return "web";
  if (/typeerror|syntaxerror|npm err|node|cannot find module|undefined/.test(lower)) return "javascript";

  return "auto";
}

function findSignals(text) {
  return patterns.filter((pattern) => pattern.tests.some((test) => test.test(text)));
}

function getFirstLine(text) {
  return text.split(/\r?\n/).map((line) => line.trim()).find(Boolean) || "Error sin titulo";
}

function getConfidence(text, signals, stack) {
  let score = 22;
  if (text.length > 40) score += 18;
  if (text.length > 180) score += 14;
  if (signals.length > 0) score += 28;
  if (signals.length > 1) score += 8;
  if (stack !== "auto") score += 10;
  return Math.min(98, score);
}

function analyze() {
  const raw = els.error.value.trim();
  const context = els.context.value.trim();
  const stack = detectStack(raw, els.stack.value);
  const signals = findSignals(raw);
  const confidence = getConfidence(raw, signals, stack);
  const primary = signals[0] || {
    title: stack === "auto" ? "Error no clasificado todavia" : `Error probable de ${stack}`,
    cause: "No hay una firma exacta, pero se puede depurar leyendo la primera linea y aislando el cambio reciente.",
    fix: "Busca la linea origen, reproduce el error en el caso minimo y verifica el ultimo cambio antes del fallo.",
    commands: stackCommands[stack] || stackCommands.auto
  };

  const steps = buildSteps({ raw, context, stack, signals, primary });
  const commands = [...new Set([...(primary.commands || []), ...(stackCommands[stack] || stackCommands.auto)])].slice(0, currentMode === "deep" ? 7 : 4);
  const prompt = buildHelpPrompt({ raw, context, stack, primary, steps, commands });
  currentReport = buildReport({ raw, context, stack, primary, signals, confidence, steps, commands, prompt });

  lastAnalysis = { raw, context, stack, primary, signals, confidence, steps, commands, prompt, date: new Date().toLocaleString() };
  renderAnalysis(lastAnalysis);
  playTone("ok");
}

function buildSteps({ raw, context, stack, signals, primary }) {
  const first = getFirstLine(raw);
  const base = [
    `Lee la primera pista: "${first.slice(0, 110)}". Normalmente ahi esta el tipo real del error.`,
    `Confirma el contexto: ${context || "anota que estabas intentando hacer justo antes del fallo"}.`,
    `Aisla el archivo o modulo que aparece mas arriba en el stack trace.`,
    primary.fix
  ];

  if (currentMode === "quick") {
    return [
      ...base,
      "Cambia una sola cosa, vuelve a correr y compara si el mensaje cambio.",
      "Cuando funcione, escribe en una linea que lo causo para no repetirlo."
    ];
  }

  return [
    ...base,
    `Clasificacion detectada: ${stack}. Si esta mal, cambia el stack manualmente y vuelve a analizar.`,
    signals.length > 1 ? "Hay multiples senales; arregla primero la que aparece mas temprano en la ejecucion." : "Si no hay mas senales, crea un caso minimo que reproduzca solo este error.",
    "Agrega una prueba o verificacion manual que falle antes y pase despues.",
    "Revisa efectos secundarios: imports, rutas, variables de entorno, version de runtime y datos vacios.",
    "Documenta solucion, comando de verificacion y archivo tocado."
  ];
}

function buildHelpPrompt({ raw, context, stack, primary, steps, commands }) {
  return [
    "Actua como un debugger senior y ayudame a resolver este error.",
    "",
    `Stack probable: ${stack}`,
    `Que intentaba hacer: ${context || "No especificado"}`,
    `Diagnostico inicial: ${primary.title}`,
    `Causa probable: ${primary.cause}`,
    "",
    "Error completo:",
    "```text",
    raw || "Pega aqui el error completo.",
    "```",
    "",
    "Quiero que respondas con:",
    "1. Causa mas probable.",
    "2. Pasos de debug ordenados.",
    "3. Comandos o checks concretos.",
    "4. Cambio minimo recomendado.",
    "5. Como verificar que quedo arreglado.",
    "",
    "Mi ruta actual:",
    ...steps.map((step, index) => `${index + 1}. ${step}`),
    "",
    "Comandos considerados:",
    ...commands.map((command) => `- ${command}`)
  ].join("\n");
}

function buildReport({ raw, context, stack, primary, signals, confidence, steps, commands, prompt }) {
  return [
    "# FlowFixer Debug Report",
    "",
    `Confidence: ${confidence}%`,
    `Stack: ${stack}`,
    `Context: ${context || "Not provided"}`,
    "",
    "## Summary",
    primary.title,
    "",
    "## Likely Cause",
    primary.cause,
    "",
    "## Suggested Fix",
    primary.fix,
    "",
    "## Signals",
    ...(signals.length ? signals.map((signal) => `- ${signal.title}: ${signal.cause}`) : ["- No exact signature found. Use the route to isolate the issue."]),
    "",
    "## Debug Path",
    ...steps.map((step, index) => `${index + 1}. ${step}`),
    "",
    "## Commands",
    ...commands.map((command) => `- \`${command}\``),
    "",
    "## Original Error",
    "```text",
    raw || "No error pasted.",
    "```",
    "",
    "## Help Prompt",
    "```text",
    prompt,
    "```"
  ].join("\n");
}

function renderAnalysis(analysis) {
  els.confidence.value = `${analysis.confidence}%`;
  els.summary.innerHTML = `
    <h3>${escapeHtml(analysis.primary.title)}</h3>
    <p>${escapeHtml(analysis.primary.cause)} ${escapeHtml(analysis.primary.fix)}</p>
  `;

  const signals = analysis.signals.length ? analysis.signals : [analysis.primary];
  els.signals.innerHTML = signals.map((signal) => `
    <div class="signal">
      <strong>${escapeHtml(signal.title)}</strong>
      <span>${escapeHtml(signal.cause)}</span>
    </div>
  `).join("");

  els.steps.innerHTML = analysis.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("");
  els.commands.innerHTML = analysis.commands.map((command) => `
    <div class="command-chip">
      <code>${escapeHtml(command)}</code>
      <button type="button" data-copy-command="${escapeHtml(command)}">copy</button>
    </div>
  `).join("");
  els.helpPrompt.textContent = analysis.prompt;
}

function fillDemo() {
  els.error.value = [
    "TypeError: Cannot read properties of undefined (reading 'map')",
    "    at ProjectList (src/components/ProjectList.jsx:18:21)",
    "    at renderWithHooks (react-dom.development.js:16305:18)",
    "    at updateFunctionComponent (react-dom.development.js:19588:20)",
    "",
    "The error appears after loading projects from localStorage."
  ].join("\n");
  els.stack.value = "react";
  els.context.value = "Estoy renderizando una lista de proyectos guardados y a veces no existe el arreglo.";
  analyze();
}

function copyText(text, message = "Copiado") {
  navigator.clipboard.writeText(text).then(() => {
    showToast(message);
    playTone("tap");
  });
}

function saveCase() {
  if (!lastAnalysis) {
    showToast("Analiza primero");
    playTone("warn");
    return;
  }

  const cases = getCases();
  const title = lastAnalysis.primary.title;
  cases.unshift({
    title,
    stack: lastAnalysis.stack,
    confidence: lastAnalysis.confidence,
    report: currentReport,
    analysis: lastAnalysis,
    date: new Date().toLocaleString()
  });
  setCases(cases.slice(0, 8));
  renderCases();
  showToast("Caso guardado");
  playTone("ok");
}

function exportReport() {
  if (!currentReport) {
    showToast("Analiza primero");
    playTone("warn");
    return;
  }

  const blob = new Blob([currentReport], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `flowfixer-report-${Date.now()}.md`;
  link.click();
  URL.revokeObjectURL(url);
  showToast("Reporte exportado");
  playTone("ok");
}

function getCases() {
  try {
    return JSON.parse(localStorage.getItem(storageKey)) || [];
  } catch {
    return [];
  }
}

function setCases(cases) {
  localStorage.setItem(storageKey, JSON.stringify(cases));
}

function renderCases() {
  const cases = getCases();

  if (cases.length === 0) {
    els.cases.innerHTML = `<p class="case-meta">No hay casos guardados todavia.</p>`;
    return;
  }

  els.cases.innerHTML = cases.map((item, index) => `
    <div class="case-item">
      <div>
        <p class="case-title">${escapeHtml(item.title)}</p>
        <p class="case-meta">${escapeHtml(item.stack)} - ${item.confidence}% - ${escapeHtml(item.date)}</p>
      </div>
      <button type="button" data-open-case="${index}">abrir</button>
    </div>
  `).join("");
}

function loadCase(index) {
  const item = getCases()[index];
  if (!item) return;

  lastAnalysis = item.analysis;
  currentReport = item.report;
  els.error.value = item.analysis.raw;
  els.context.value = item.analysis.context || "";
  els.stack.value = item.analysis.stack === "system" ? "auto" : item.analysis.stack;
  renderAnalysis(item.analysis);
  showToast("Caso abierto");
}

function clearAll() {
  els.form.reset();
  els.confidence.value = "0%";
  els.summary.innerHTML = "<p>Pega un error y FlowFixer te arma el mapa de debug.</p>";
  els.signals.innerHTML = "";
  els.steps.innerHTML = "";
  els.commands.innerHTML = "";
  els.helpPrompt.textContent = "Aqui aparecera un prompt limpio para pedir ayuda a una IA o a un teammate.";
  currentReport = "";
  lastAnalysis = undefined;
  showToast("Limpio");
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => els.toast.classList.remove("show"), 1400);
}

function playTone(type = "tap") {
  if (!soundEnabled) return;

  audioContext ||= new AudioContext();
  const now = audioContext.currentTime;
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const frequencies = { tap: 320, ok: 610, warn: 140 };

  osc.type = "triangle";
  osc.frequency.value = frequencies[type] || frequencies.tap;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.045, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
  osc.connect(gain);
  gain.connect(audioContext.destination);
  osc.start(now);
  osc.stop(now + 0.14);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  })[char]);
}

function initReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) entry.target.classList.add("visible");
    });
  }, { threshold: 0.12 });

  $$(".reveal").forEach((node) => observer.observe(node));
}

function initCanvas() {
  const ctx = els.canvas.getContext("2d");
  const nodes = Array.from({ length: 44 }, (_, index) => ({
    x: Math.random(),
    y: Math.random(),
    vx: 0.0003 + (index % 5) * 0.00012,
    vy: 0.0002 + (index % 4) * 0.00008,
    color: index % 4
  }));
  const colors = ["rgba(183,255,84,0.46)", "rgba(92,225,230,0.42)", "rgba(255,111,177,0.34)", "rgba(255,200,87,0.36)"];

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    els.canvas.width = window.innerWidth * ratio;
    els.canvas.height = window.innerHeight * ratio;
    els.canvas.style.width = `${window.innerWidth}px`;
    els.canvas.style.height = `${window.innerHeight}px`;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function draw() {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    nodes.forEach((node, index) => {
      node.x = (node.x + node.vx) % 1;
      node.y = (node.y + node.vy) % 1;
      const x = node.x * window.innerWidth;
      const y = node.y * window.innerHeight;

      ctx.beginPath();
      ctx.arc(x, y, 2 + (index % 3), 0, Math.PI * 2);
      ctx.fillStyle = colors[node.color];
      ctx.fill();

      for (let offset = 1; offset <= 2; offset += 1) {
        const other = nodes[(index + offset * 7) % nodes.length];
        const ox = other.x * window.innerWidth;
        const oy = other.y * window.innerHeight;
        const distance = Math.hypot(x - ox, y - oy);
        if (distance < 220) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(ox, oy);
          ctx.strokeStyle = `rgba(247,243,232,${0.11 - distance / 2600})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    });
    requestAnimationFrame(draw);
  }

  resize();
  draw();
  window.addEventListener("resize", resize);
}

els.form.addEventListener("submit", (event) => {
  event.preventDefault();
  analyze();
});

$$(".mode").forEach((button) => {
  button.addEventListener("click", () => {
    currentMode = button.dataset.mode;
    $$(".mode").forEach((mode) => mode.classList.toggle("active", mode === button));
    if (els.error.value.trim()) analyze();
  });
});

els.demo.addEventListener("click", fillDemo);
els.clear.addEventListener("click", clearAll);
els.copy.addEventListener("click", () => currentReport ? copyText(currentReport, "Reporte copiado") : showToast("Analiza primero"));
els.save.addEventListener("click", saveCase);
els.export.addEventListener("click", exportReport);
els.sound.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  els.sound.textContent = soundEnabled ? "sound" : "mute";
  if (soundEnabled) playTone("ok");
});
els.clearCases.addEventListener("click", () => {
  setCases([]);
  renderCases();
  showToast("Historial limpio");
});
els.commands.addEventListener("click", (event) => {
  const button = event.target.closest("[data-copy-command]");
  if (button) copyText(button.dataset.copyCommand, "Comando copiado");
});
els.cases.addEventListener("click", (event) => {
  const button = event.target.closest("[data-open-case]");
  if (button) loadCase(Number(button.dataset.openCase));
});

initReveal();
initCanvas();
renderCases();
