const STATS = [
  { key: "strength", label: "Strength", short: "STR" },
  { key: "reflexes", label: "Reflexes", short: "REF" },
  { key: "hacking", label: "Hacking", short: "HACK" },
  { key: "armor", label: "Armor", short: "ARM" },
];

const STAT_MAX = 120;
const CENTER = 280;
const BASE_RADIUS = 166;
const RING_GAP = 16;
const STORAGE_KEY = "ripperdoc-build";

const SLOT_MARKERS = {
  OPERATING_SYSTEM: [[280, 124]],
  FACE: [[280, 154]],
  NERVOUS_SYSTEM: [[280, 262]],
  ARMS: [[222, 282], [338, 282]],
  SKELETON: [[258, 400], [302, 400]],
  INTEGUMENTARY_SYSTEM: [[319, 244]],
};

const SILHOUETTE_LEFT = [
  [271, 166], [270, 180], [250, 184], [234, 190], [226, 202], [220, 240], [214, 280],
  [210, 318], [204, 340], [208, 352], [216, 350], [220, 336], [224, 316], [230, 280],
  [236, 246], [240, 222], [242, 262], [246, 296], [242, 318], [246, 370], [248, 410],
  [246, 436], [240, 446], [266, 446], [268, 412], [270, 372], [274, 334], [280, 326],
];

const CONDITIONS = {
  STABLE: {
    label: "Stable",
    note: "Mind and body are in sync. There is room for more chrome.",
    ecgSpeed: "3.2s",
  },
  UNSTABLE: {
    label: "Unstable",
    note: "Humanity is under the stable line. The patient hears static in quiet rooms. Go easy on the next install.",
    ecgSpeed: "1.9s",
  },
  CYBERPSYCHOSIS: {
    label: "Cyberpsychosis",
    note: "Humanity crossed the psychosis line. The patient no longer recognizes the people around them. Remove an implant to bring them back.",
    ecgSpeed: "1.1s",
  },
};

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const state = {
  name: "V",
  lifepath: "nomad",
  chain: [],
  validChain: [],
  lifepaths: [],
  implants: [],
  result: null,
  previous: null,
  ticket: 0,
  movedId: null,
  dragIndex: null,
};

const el = {
  body: document.body,
  name: document.getElementById("patientName"),
  lifepaths: document.getElementById("lifepaths"),
  catalog: document.getElementById("catalog"),
  chain: document.getElementById("chain"),
  dial: document.getElementById("dial"),
  rings: document.getElementById("rings"),
  figure: document.getElementById("figure"),
  silhouette: document.getElementById("silhouette"),
  markers: document.getElementById("markers"),
  description: document.getElementById("description"),
  legend: document.getElementById("slotLegend"),
  conditionText: document.getElementById("conditionText"),
  conditionNote: document.getElementById("conditionNote"),
  humanityValue: document.getElementById("humanityValue"),
  meter: document.getElementById("humanityMeter"),
  psychosisMark: document.getElementById("psychosisMark"),
  stableMark: document.getElementById("stableMark"),
  ecgPath: document.getElementById("ecgPath"),
  stats: document.getElementById("stats"),
  cost: document.getElementById("costValue"),
  costNote: document.getElementById("costNote"),
  code: document.querySelector("#code code"),
  codeOutput: document.getElementById("codeOutput"),
  copy: document.getElementById("copyCode"),
  toast: document.getElementById("toast"),
  theme: document.getElementById("themeToggle"),
};

const statRows = {};
let toastTimer = null;
let nameTimer = null;

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatNumber(value) {
  return Math.round(value).toLocaleString("en-US");
}

function patientName() {
  const trimmed = state.name.trim();
  return trimmed ? trimmed.slice(0, 24) : "V";
}

function findImplant(id) {
  return state.implants.find((implant) => implant.id === id);
}

function findLifepath(id) {
  return state.lifepaths.find((lifepath) => lifepath.id === id);
}

function readStorage() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

function writeStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      name: state.name,
      lifepath: state.lifepath,
      chain: state.validChain,
    }));
  } catch {
    return;
  }
}

function showToast(message) {
  el.toast.textContent = message;
  el.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.toast.hidden = true;
  }, 4500);
}

const numberAnimations = new WeakMap();

function animateNumber(node, from, to, format = formatNumber) {
  const ticket = (numberAnimations.get(node) || 0) + 1;
  numberAnimations.set(node, ticket);
  if (reduceMotion.matches || from === to || document.hidden) {
    node.textContent = format(to);
    return;
  }
  const start = performance.now();
  const duration = 550;
  const step = (now) => {
    if (numberAnimations.get(node) !== ticket) {
      return;
    }
    const progress = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    node.textContent = format(from + (to - from) * eased);
    if (progress < 1) {
      requestAnimationFrame(step);
    }
  };
  requestAnimationFrame(step);
  setTimeout(() => {
    if (numberAnimations.get(node) === ticket) {
      node.textContent = format(to);
    }
  }, duration + 100);
}

function svgPoints(points) {
  return points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x} ${y}`).join(" ");
}

function drawSilhouette() {
  const right = SILHOUETTE_LEFT.slice(0, -1).reverse().map(([x, y]) => [560 - x, y]);
  el.silhouette.setAttribute("d", `${svgPoints([...SILHOUETTE_LEFT, ...right])} Z`);
}

function drawDial() {
  const inner = 268;
  let markup = "";
  for (let i = 0; i < 72; i += 1) {
    const angle = (i / 72) * Math.PI * 2;
    const major = i % 6 === 0;
    const outer = inner + (major ? 9 : 5);
    const x1 = CENTER + Math.cos(angle) * inner;
    const y1 = CENTER + Math.sin(angle) * inner;
    const x2 = CENTER + Math.cos(angle) * outer;
    const y2 = CENTER + Math.sin(angle) * outer;
    markup += `<line class="${major ? "is-major" : ""}" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`;
  }
  el.dial.innerHTML = markup;
}

function buildStatRows() {
  el.stats.innerHTML = "";
  STATS.forEach((stat) => {
    const row = document.createElement("div");
    row.className = "stat-row";
    row.innerHTML = `
      <dt class="stat-name">${stat.label}</dt>
      <dd class="stat-value"><span class="stat-delta"></span><span class="stat-number">0</span></dd>
      <dd class="stat-track" aria-hidden="true"><span class="stat-ghost"></span><span class="stat-fill"></span></dd>`;
    el.stats.append(row);
    statRows[stat.key] = {
      number: row.querySelector(".stat-number"),
      delta: row.querySelector(".stat-delta"),
      fill: row.querySelector(".stat-fill"),
      ghost: row.querySelector(".stat-ghost"),
      timer: null,
    };
  });
}

function buildMeter() {
  el.meter.innerHTML = "";
  for (let i = 0; i < 50; i += 1) {
    const cell = document.createElement("span");
    cell.className = "meter-cell";
    el.meter.append(cell);
  }
}

function renderLifepaths() {
  el.lifepaths.innerHTML = state.lifepaths.map((lifepath) => `
    <label class="lifepath">
      <input type="radio" name="lifepath" value="${lifepath.id}" ${lifepath.id === state.lifepath ? "checked" : ""}>
      <span class="lifepath-name">${escapeHtml(lifepath.name)}</span>
      <span class="lifepath-class">${escapeHtml(lifepath.className)}</span>
      <span class="lifepath-desc">${escapeHtml(lifepath.description)}</span>
    </label>`).join("");
}

function effectPills(effect) {
  return effect.split(",").map((part) => {
    const text = part.trim();
    let kind = "is-up";
    if (text.startsWith("x")) {
      kind = "is-multiplier";
    } else if (text.startsWith("-")) {
      kind = "is-down";
    }
    return `<li class="effect ${kind}">${escapeHtml(text.replace("-", "−").replace("x", "×"))}</li>`;
  }).join("");
}

function slotOwner(slot) {
  return state.validChain.map(findImplant).find((implant) => implant && implant.slot === slot);
}

function renderCatalog() {
  const active = document.activeElement;
  const focusId = active && active.dataset ? active.dataset.implant : null;
  const groups = new Map();
  state.implants.forEach((implant) => {
    if (!groups.has(implant.slot)) {
      groups.set(implant.slot, { label: implant.slotLabel, implants: [] });
    }
    groups.get(implant.slot).implants.push(implant);
  });

  el.catalog.innerHTML = [...groups.entries()].map(([slot, group]) => {
    const owner = slotOwner(slot);
    const items = group.implants.map((implant) => {
      const installed = owner && owner.id === implant.id;
      let action = `<button class="button implant-action" type="button" data-implant="${implant.id}">Install</button>`;
      if (installed) {
        action = `<button class="button is-secondary implant-action" type="button" data-implant="${implant.id}">Remove</button>`;
      } else if (owner) {
        action = `<button class="button is-secondary implant-action" type="button" data-implant="${implant.id}">Swap for ${escapeHtml(owner.name)}</button>`;
      }
      return `
        <li class="implant ${installed ? "is-installed" : ""}">
          <span class="implant-name">${escapeHtml(implant.name)}</span>
          <span class="implant-price">€$ ${formatNumber(implant.price)}</span>
          <span class="implant-desc">${escapeHtml(implant.description)}</span>
          <ul class="effects" aria-label="Effects">${effectPills(implant.effect)}</ul>
          ${action}
        </li>`;
    }).join("");
    return `
      <section class="slot-group" aria-label="${escapeHtml(group.label)}">
        <div class="slot-group-head">
          <h3 class="slot-group-name">${escapeHtml(group.label)}</h3>
          <span class="slot-group-state ${owner ? "is-taken" : ""}">${owner ? "Taken" : "Free"}</span>
        </div>
        <ul class="implant-list">${items}</ul>
      </section>`;
  }).join("");

  if (focusId) {
    const target = el.catalog.querySelector(`[data-implant="${focusId}"]`);
    if (target) {
      target.focus();
    }
  }
}

function layerDeltas(layer, previous) {
  const keys = [...STATS, { key: "humanity", short: "HUM" }];
  return keys
    .map((stat) => ({ short: stat.short, from: previous.stats[stat.key], to: layer.stats[stat.key] }))
    .filter((delta) => delta.from !== delta.to)
    .map((delta) => {
      const kind = delta.to > delta.from ? "is-up" : "is-down";
      return `<li class="${kind}">${delta.short} ${delta.from} to <b>${delta.to}</b></li>`;
    })
    .join("");
}

const ICONS = {
  up: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3 L13 9 H3 Z" fill="currentColor"/></svg>',
  down: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 13 L13 7 H3 Z" fill="currentColor"/></svg>',
  remove: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4 L12 12 M12 4 L4 12" stroke="currentColor" stroke-width="2"/></svg>',
};

function renderChain() {
  const active = document.activeElement;
  const focusKey = active && active.dataset && active.dataset.action ? `${active.dataset.action}:${active.dataset.id}` : null;
  const layers = state.result.layers;
  const base = layers[0];
  const lifepath = findLifepath(state.lifepath);

  let markup = `
    <li class="chain-row is-base">
      <span class="chain-depth">0</span>
      <div class="chain-main">
        <div class="chain-title">
          <span class="chain-name">${escapeHtml(base.name)}</span>
          <span class="chain-class">${escapeHtml(lifepath ? lifepath.className : base.className)}</span>
          <span class="chain-role">Component</span>
        </div>
        <ul class="chain-deltas"><li>The bare human every decorator wraps</li></ul>
      </div>
    </li>`;

  const implantLayers = layers.slice(1);
  implantLayers.forEach((layer, index) => {
    const isFirst = index === 0;
    const isLast = index === implantLayers.length - 1;
    markup += `
      <li class="chain-row ${state.movedId === layer.id ? "is-moved" : ""}" draggable="true" data-index="${index}">
        <span class="chain-depth">${index + 1}</span>
        <div class="chain-main">
          <div class="chain-title">
            <span class="chain-name">${escapeHtml(layer.name)}</span>
            <span class="chain-class">${escapeHtml(layer.className)}</span>
            <span class="chain-role">${isLast ? "Outermost decorator" : "Decorator"}</span>
          </div>
          <ul class="chain-deltas">${layerDeltas(layer, layers[index])}</ul>
        </div>
        <div class="chain-actions">
          <button class="mini-button" type="button" data-action="up" data-id="${layer.id}" aria-label="Move ${escapeHtml(layer.name)} inward" ${isFirst ? "disabled" : ""}>${ICONS.up}</button>
          <button class="mini-button" type="button" data-action="down" data-id="${layer.id}" aria-label="Move ${escapeHtml(layer.name)} outward" ${isLast ? "disabled" : ""}>${ICONS.down}</button>
          <button class="mini-button is-danger" type="button" data-action="remove" data-id="${layer.id}" aria-label="Remove ${escapeHtml(layer.name)}">${ICONS.remove}</button>
        </div>
      </li>`;
  });

  if (implantLayers.length === 0) {
    markup += `<li class="chain-empty">Install an implant from the catalog. It will wrap ${escapeHtml(state.result.layers[0].description)} and show up here as layer 1.</li>`;
  }

  el.chain.innerHTML = markup;
  state.movedId = null;

  if (focusKey) {
    const [action, id] = focusKey.split(":");
    let target = el.chain.querySelector(`[data-action="${action}"][data-id="${id}"]:not(:disabled)`);
    if (!target) {
      target = el.chain.querySelector(`[data-id="${id}"]:not(:disabled)`) || el.catalog;
    }
    target.focus();
  }
}

function ringPath(radius) {
  return `M ${CENTER - radius} ${CENTER} A ${radius} ${radius} 0 0 1 ${CENTER + radius} ${CENTER} A ${radius} ${radius} 0 0 1 ${CENTER - radius} ${CENTER}`;
}

function renderRings() {
  const layers = state.result.layers;
  const previousLayers = state.previous ? state.previous.layers : [];
  const lastIndex = layers.length - 1;
  let markup = "";

  layers.forEach((layer, index) => {
    const radius = BASE_RADIUS + index * RING_GAP;
    const circumference = (2 * Math.PI * radius).toFixed(1);
    const previous = previousLayers[index];
    const isNew = !previous || previous.id !== layer.id;
    const classes = ["ring"];
    if (index === 0) {
      classes.push("is-base");
    } else if (index === lastIndex) {
      classes.push("is-outer");
    }
    if (isNew) {
      classes.push("is-new");
    }
    const offset = 19 - index * 2.2;
    const labelClass = `ring-label ${index > 0 && index === lastIndex ? "is-outer" : ""} ${isNew ? "is-new" : ""}`;
    const label = index === 0 ? `${layer.className}("${patientName()}")` : layer.name;
    markup += `
      <path id="ring-path-${index}" d="${ringPath(radius)}" fill="none" stroke="none"/>
      <circle class="${classes.join(" ")}" cx="${CENTER}" cy="${CENTER}" r="${radius}" style="--circumference:${circumference}; stroke-dasharray:${circumference}"/>
      <text class="${labelClass}" dy="4" style="paint-order:stroke; stroke:var(--bone); stroke-width:6px; stroke-linejoin:round">
        <textPath href="#ring-path-${index}" startOffset="${offset}%" text-anchor="middle">${escapeHtml(label)}</textPath>
      </text>`;
  });

  el.rings.innerHTML = markup;
}

function renderMarkers() {
  const taken = new Set(state.validChain.map((id) => findImplant(id)).filter(Boolean).map((implant) => implant.slot));
  const labels = new Map(state.implants.map((implant) => [implant.slot, implant.slotLabel]));
  let markup = "";
  Object.entries(SLOT_MARKERS).forEach(([slot, points]) => {
    const active = taken.has(slot) ? "is-active" : "";
    points.forEach(([x, y]) => {
      markup += `
        <g>
          <title>${escapeHtml(labels.get(slot) || slot)}</title>
          <circle class="marker-pulse ${active}" cx="${x}" cy="${y}" r="6" style="transform-box:fill-box; transform-origin:center"/>
          <rect class="marker ${active}" x="-4.5" y="-4.5" width="9" height="9" transform="translate(${x} ${y}) rotate(45)"/>
        </g>`;
    });
  });
  el.markers.innerHTML = markup;
  el.figure.classList.toggle("has-camo", taken.has("INTEGUMENTARY_SYSTEM"));

  el.legend.innerHTML = [...labels.entries()].map(([slot, label]) => `
    <li class="${taken.has(slot) ? "is-taken" : ""}">
      <span class="slot-legend-swatch" aria-hidden="true"></span>${escapeHtml(label)}<span class="visually-hidden">${taken.has(slot) ? ", taken" : ", free"}</span>
    </li>`).join("");
}

function setBar(node, from, to, delay) {
  node.style.transition = "none";
  node.style.width = `${Math.min(100, (from / STAT_MAX) * 100)}%`;
  node.getBoundingClientRect();
  node.style.transition = "";
  if (delay === false) {
    node.style.transition = "none";
  }
  node.style.width = `${Math.min(100, (to / STAT_MAX) * 100)}%`;
}

function renderStats() {
  const stats = state.result.stats;
  const previous = state.previous ? state.previous.stats : stats;
  STATS.forEach((stat) => {
    const row = statRows[stat.key];
    const from = previous[stat.key];
    const to = stats[stat.key];
    animateNumber(row.number, from, to);
    row.fill.style.width = `${Math.min(100, (to / STAT_MAX) * 100)}%`;
    if (to < from) {
      row.ghost.classList.remove("is-gain");
      setBar(row.ghost, from, to);
    } else if (to > from) {
      row.ghost.classList.add("is-gain");
      setBar(row.ghost, to, to, false);
    } else {
      row.ghost.style.width = row.fill.style.width;
    }
    clearTimeout(row.timer);
    if (to !== from) {
      const diff = to - from;
      row.delta.textContent = diff > 0 ? `+${diff}` : `−${Math.abs(diff)}`;
      row.delta.className = `stat-delta is-visible ${diff > 0 ? "is-up" : "is-down"}`;
      row.timer = setTimeout(() => {
        row.delta.classList.remove("is-visible");
      }, 1800);
    }
  });
}

function ecgPeriod(condition) {
  const y = 34;
  if (condition === "CYBERPSYCHOSIS") {
    return [[0, y], [18, y - 6], [26, y + 10], [34, 4], [40, 56], [48, y], [70, y - 12], [78, y + 14], [96, y], [104, 2], [110, 58], [118, 20], [126, y], [150, y + 8], [166, y - 16], [172, y], [196, 6], [202, 54], [208, y - 4], [232, y + 6], [244, 10], [250, 50], [258, y], [280, y - 8], [300, y]];
  }
  if (condition === "UNSTABLE") {
    return [[0, y], [40, y], [52, y - 5], [62, y], [70, y + 5], [76, 10], [82, 50], [88, y], [110, y - 7], [124, y], [150, y], [190, y], [202, y - 5], [212, y], [220, y + 6], [226, 8], [232, 52], [238, y], [262, y - 8], [276, y], [300, y]];
  }
  return [[0, y], [100, y], [110, y - 5], [122, y], [134, y], [140, y + 5], [146, 6], [152, 52], [158, y], [180, y], [196, y - 8], [212, y], [300, y]];
}

function renderEcg(condition) {
  const period = ecgPeriod(condition);
  const points = [...period, ...period.slice(1).map(([x, y]) => [x + 300, y])];
  el.ecgPath.setAttribute("d", svgPoints(points));
  el.ecgPath.style.setProperty("--ecg-speed", CONDITIONS[condition].ecgSpeed);
}

function renderHumanity() {
  const result = state.result;
  const humanity = result.stats.humanity;
  const baseHumanity = result.layers[0].stats.humanity;
  const previous = state.previous ? state.previous.stats.humanity : humanity;
  animateNumber(el.humanityValue, previous, humanity);

  [...el.meter.children].forEach((cell, index) => {
    const low = index * 2;
    cell.classList.toggle("is-on", humanity > low);
    cell.classList.toggle("is-lost", humanity <= low && baseHumanity > low);
  });

  el.meter.querySelectorAll(".meter-threshold").forEach((node) => node.remove());
  [result.thresholds.psychosis, result.thresholds.stable].forEach((value) => {
    const line = document.createElement("span");
    line.className = "meter-threshold";
    line.style.left = `calc(${value}% - 1px)`;
    el.meter.append(line);
  });
  el.psychosisMark.style.left = `${result.thresholds.psychosis}%`;
  el.psychosisMark.style.transform = "translateX(-50%)";
  el.psychosisMark.textContent = `Psychosis line ${result.thresholds.psychosis}`;
  el.stableMark.style.left = `${result.thresholds.stable}%`;
  el.stableMark.style.transform = "translateX(-50%)";
  el.stableMark.textContent = `Stable line ${result.thresholds.stable}`;
}

function renderCondition() {
  const condition = state.result.condition;
  const previous = state.previous ? state.previous.condition : condition;
  el.body.dataset.condition = condition;
  el.conditionText.textContent = CONDITIONS[condition].label;
  el.conditionNote.textContent = CONDITIONS[condition].note;
  renderEcg(condition);
  if (condition === "CYBERPSYCHOSIS" && previous !== "CYBERPSYCHOSIS" && !reduceMotion.matches) {
    el.body.classList.remove("is-glitching");
    el.body.getBoundingClientRect();
    el.body.classList.add("is-glitching");
    setTimeout(() => el.body.classList.remove("is-glitching"), 750);
  }
}

function renderCost() {
  const cost = state.result.stats.cost;
  const previous = state.previous ? state.previous.stats.cost : cost;
  animateNumber(el.cost, previous, cost);
  const count = state.result.layers.length - 1;
  el.costNote.textContent = count === 0
    ? "No implants installed yet."
    : `${count} ${count === 1 ? "implant" : "implants"} installed. Each decorator adds its price to the cost of what it wraps.`;
}

function javaString(text) {
  return text.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function buildJava() {
  const layers = state.result.layers;
  const base = layers[0];
  const name = javaString(patientName());
  const lifepath = findLifepath(state.lifepath);
  const baseClass = lifepath ? lifepath.className : base.className;
  const decorators = layers.slice(1).reverse();

  const plain = [];
  const html = [];
  const t = (cls, text) => `<span class="tok-${cls}">${escapeHtml(text)}</span>`;

  if (decorators.length === 0) {
    plain.push(`Human patient = new ${baseClass}("${name}");`);
    html.push(`${t("type", "Human")} patient = ${t("key", "new")} ${t("type", baseClass)}${t("punct", "(")}${t("str", `"${name}"`)}${t("punct", ");")}`);
    return { plain: plain.join("\n"), html: html.join("\n") };
  }

  plain.push("Human patient =");
  html.push(`${t("type", "Human")} patient =`);
  decorators.forEach((layer, index) => {
    const indent = "  ".repeat(index + 1);
    plain.push(`${indent}new ${layer.className}(`);
    html.push(`${indent}${t("key", "new")} ${t("type", layer.className)}${t("punct", "(")}`);
  });
  const indent = "  ".repeat(decorators.length + 1);
  const closing = ")".repeat(decorators.length + 1) + ";";
  plain.push(`${indent}new ${baseClass}("${name}"${closing}`);
  html.push(`${indent}${t("key", "new")} ${t("type", baseClass)}${t("punct", "(")}${t("str", `"${name}"`)}${t("punct", closing)}`);
  return { plain: plain.join("\n"), html: html.join("\n") };
}

function renderCode() {
  const java = buildJava();
  el.code.innerHTML = java.html;
  el.code.dataset.plain = java.plain;
  el.codeOutput.textContent = `"${state.result.description}"`;
}

function renderAll() {
  el.description.textContent = state.result.description;
  renderCatalog();
  renderChain();
  renderRings();
  renderMarkers();
  renderStats();
  renderHumanity();
  renderCondition();
  renderCost();
  renderCode();
}

async function build() {
  const ticket = ++state.ticket;
  const params = new URLSearchParams({
    name: state.name,
    lifepath: state.lifepath,
    implants: state.chain.join(","),
  });
  try {
    const response = await fetch(`/api/build?${params}`);
    const data = await response.json();
    if (ticket !== state.ticket) {
      return;
    }
    if (!response.ok) {
      showToast(data.error || "The clinic rejected that build.");
      state.chain = [...state.validChain];
      return;
    }
    state.previous = state.result;
    state.result = data;
    state.validChain = [...state.chain];
    writeStorage();
    renderAll();
  } catch {
    if (ticket === state.ticket) {
      showToast("The clinic server is not answering. Start it with ./run.sh and reload this page.");
    }
  }
}

function toggleImplant(id) {
  const implant = findImplant(id);
  if (!implant) {
    return;
  }
  const chain = [...state.validChain];
  const existing = chain.indexOf(id);
  if (existing >= 0) {
    chain.splice(existing, 1);
  } else {
    const sameSlot = chain.findIndex((otherId) => findImplant(otherId).slot === implant.slot);
    if (sameSlot >= 0) {
      chain[sameSlot] = id;
    } else {
      chain.push(id);
    }
  }
  state.chain = chain;
  build();
}

function moveImplant(from, to) {
  if (from === to || to < 0 || to >= state.validChain.length) {
    return;
  }
  const chain = [...state.validChain];
  const [moved] = chain.splice(from, 1);
  chain.splice(to, 0, moved);
  state.chain = chain;
  state.movedId = moved;
  build();
}

function clearDropMarks() {
  el.chain.querySelectorAll(".drop-before, .drop-after, .is-dragging").forEach((row) => {
    row.classList.remove("drop-before", "drop-after", "is-dragging");
  });
}

function bindEvents() {
  el.lifepaths.addEventListener("change", (event) => {
    if (event.target.name === "lifepath") {
      state.lifepath = event.target.value;
      state.chain = [...state.validChain];
      build();
    }
  });

  el.name.addEventListener("input", () => {
    clearTimeout(nameTimer);
    nameTimer = setTimeout(() => {
      state.name = el.name.value;
      state.chain = [...state.validChain];
      build();
    }, 250);
  });

  el.catalog.addEventListener("click", (event) => {
    const button = event.target.closest("[data-implant]");
    if (button) {
      toggleImplant(button.dataset.implant);
    }
  });

  el.chain.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) {
      return;
    }
    const index = state.validChain.indexOf(button.dataset.id);
    if (button.dataset.action === "remove") {
      toggleImplant(button.dataset.id);
    } else if (button.dataset.action === "up") {
      moveImplant(index, index - 1);
    } else if (button.dataset.action === "down") {
      moveImplant(index, index + 1);
    }
  });

  el.chain.addEventListener("dragstart", (event) => {
    const row = event.target.closest(".chain-row[data-index]");
    if (!row) {
      return;
    }
    state.dragIndex = Number(row.dataset.index);
    row.classList.add("is-dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", row.dataset.index);
  });

  el.chain.addEventListener("dragover", (event) => {
    const row = event.target.closest(".chain-row[data-index]");
    if (!row || state.dragIndex === null) {
      return;
    }
    event.preventDefault();
    const rect = row.getBoundingClientRect();
    const after = event.clientY > rect.top + rect.height / 2;
    el.chain.querySelectorAll(".drop-before, .drop-after").forEach((node) => node.classList.remove("drop-before", "drop-after"));
    row.classList.add(after ? "drop-after" : "drop-before");
  });

  el.chain.addEventListener("drop", (event) => {
    const row = event.target.closest(".chain-row[data-index]");
    if (!row || state.dragIndex === null) {
      return;
    }
    event.preventDefault();
    const target = Number(row.dataset.index);
    const after = row.classList.contains("drop-after");
    let destination = after ? target + 1 : target;
    if (state.dragIndex < destination) {
      destination -= 1;
    }
    const from = state.dragIndex;
    clearDropMarks();
    state.dragIndex = null;
    moveImplant(from, destination);
  });

  el.chain.addEventListener("dragend", () => {
    clearDropMarks();
    state.dragIndex = null;
  });

  el.copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(el.code.dataset.plain || "");
      el.copy.textContent = "Copied";
      setTimeout(() => {
        el.copy.textContent = "Copy";
      }, 1500);
    } catch {
      showToast("Copy is blocked in this browser. Select the code and copy it by hand.");
    }
  });

  el.theme.addEventListener("click", () => {
    const current = document.documentElement.dataset.theme
      || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("ripperdoc-theme", next);
    } catch {
      return;
    }
  });
}

function restoreTheme() {
  try {
    const saved = localStorage.getItem("ripperdoc-theme");
    if (saved) {
      document.documentElement.dataset.theme = saved;
    }
  } catch {
    return;
  }
}

async function init() {
  restoreTheme();
  drawSilhouette();
  drawDial();
  buildStatRows();
  buildMeter();
  bindEvents();
  try {
    const [lifepaths, implants] = await Promise.all([
      fetch("/api/lifepaths").then((response) => response.json()),
      fetch("/api/implants").then((response) => response.json()),
    ]);
    state.lifepaths = lifepaths;
    state.implants = implants;
  } catch {
    showToast("The clinic server is not answering. Start it with ./run.sh and reload this page.");
    return;
  }
  const saved = readStorage();
  if (saved) {
    state.name = typeof saved.name === "string" ? saved.name : state.name;
    state.lifepath = findLifepath(saved.lifepath) ? saved.lifepath : state.lifepath;
    state.chain = Array.isArray(saved.chain) ? saved.chain.filter((id) => findImplant(id)) : [];
  }
  el.name.value = state.name;
  renderLifepaths();
  await build();
  if (!state.result && state.chain.length) {
    state.chain = [];
    state.validChain = [];
    await build();
  }
}

init();
