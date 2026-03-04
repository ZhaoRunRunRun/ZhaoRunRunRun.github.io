const DATA_URL = './data/token-usage.json';
const THEME_KEY = 'token-monitor-theme';

const state = {
  records: [],
  filtered: [],
  lineFiltered: [],
  start: '',
  end: '',
  theme: 'auto',
  quickRange: 'custom',
  unit: 'token'
};

const refs = {
  inputHeatmap: document.getElementById('inputHeatmap'),
  outputHeatmap: document.getElementById('outputHeatmap'),
  startDate: document.getElementById('startDate'),
  endDate: document.getElementById('endDate'),
  applyBtn: document.getElementById('applyBtn'),
  resetBtn: document.getElementById('resetBtn'),
  statusText: document.getElementById('statusText'),
  lineChart: document.getElementById('lineChart'),
  lineMeta: document.getElementById('lineMeta'),
  autoTheme: document.getElementById('autoTheme'),
  darkTheme: document.getElementById('darkTheme'),
  quickRangeGroup: document.getElementById('quickRangeGroup'),
  unitSelect: document.getElementById('unitSelect')
};

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function parseDate(v) {
  return new Date(`${v}T00:00:00`);
}

function formatNumber(v) {
  return Math.round(v).toLocaleString('zh-CN');
}

function unitLabel() {
  return state.unit === 'k' ? 'K Token' : 'Token';
}

function unitValue(v) {
  return state.unit === 'k' ? v / 1000 : v;
}

function applyTheme() {
  let dark = false;
  if (state.theme === 'auto') {
    const hour = new Date().getHours();
    dark = hour >= 18 || hour < 6;
  } else {
    dark = state.theme === 'dark';
  }
  document.documentElement.classList.toggle('dark', dark);
  refs.autoTheme.checked = state.theme === 'auto';
  refs.darkTheme.checked = dark;
}

function setTheme(mode) {
  state.theme = mode;
  localStorage.setItem(THEME_KEY, mode);
  applyTheme();
}

function dailyMap(records) {
  const map = new Map();
  records.forEach((item) => {
    const key = item.timestamp.slice(0, 10);
    const prev = map.get(key) || { input: 0, output: 0 };
    prev.input += Number(item.input || 0);
    prev.output += Number(item.output || 0);
    map.set(key, prev);
  });
  return map;
}

function level(value, max) {
  if (!value || max <= 0) return 0;
  const ratio = value / max;
  if (ratio < 0.25) return 1;
  if (ratio < 0.5) return 2;
  if (ratio < 0.75) return 3;
  return 4;
}

function buildDays(start, end) {
  const days = [];
  const cur = new Date(start);
  while (cur <= end) {
    days.push(isoDate(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function renderHeatmap(container, dailyValues, type) {
  container.innerHTML = '';
  const keys = Array.from(dailyValues.keys()).sort();
  if (!keys.length) return;
  const first = parseDate(keys[0]);
  const last = parseDate(keys[keys.length - 1]);

  const start = new Date(first);
  start.setDate(start.getDate() - start.getDay());
  const end = new Date(last);
  end.setDate(end.getDate() + (6 - end.getDay()));

  const days = buildDays(start, end);
  const max = Math.max(...keys.map((k) => dailyValues.get(k)[type] || 0), 0);

  days.forEach((day) => {
    const item = dailyValues.get(day);
    const value = item ? item[type] : 0;
    const lv = level(value, max);
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.style.background = `var(--green-${lv})`;
    cell.title = `${day} ${type === 'input' ? '输入' : '输出'}: ${Math.round(value)}`;
    container.appendChild(cell);
  });
}

function calcLineRecords() {
  if (state.quickRange === 'custom') return state.filtered;
  if (state.quickRange === 'all') return state.records;
  if (!state.records.length) return [];

  const nowTs = new Date(state.records[state.records.length - 1].timestamp).getTime();
  const windows = {
    '1h': 3600 * 1000,
    '24h': 24 * 3600 * 1000,
    '7d': 7 * 24 * 3600 * 1000,
    '30d': 30 * 24 * 3600 * 1000
  };
  const span = windows[state.quickRange] || windows['24h'];
  const cutoff = nowTs - span;
  return state.records.filter((r) => new Date(r.timestamp).getTime() >= cutoff);
}

function drawAxisLabels(ctx, dpr, w, h, pad, maxYValue, firstTs, lastTs) {
  const textColor = getComputedStyle(document.documentElement).getPropertyValue('--muted').trim() || '#94a3b8';
  ctx.fillStyle = textColor;
  ctx.font = `${11 * dpr}px sans-serif`;

  for (let i = 0; i <= 4; i += 1) {
    const val = unitValue((maxYValue * (4 - i)) / 4);
    const y = pad + ((h - pad * 2) * i) / 4 + 4 * dpr;
    ctx.fillText(`${val.toFixed(state.unit === 'k' ? 1 : 0)} ${unitLabel()}`, 8 * dpr, y);
  }

  if (firstTs && lastTs) {
    const left = firstTs.slice(5, 16).replace('T', ' ');
    const right = lastTs.slice(5, 16).replace('T', ' ');
    ctx.fillText(left, pad, h - 10 * dpr);
    const textWidth = ctx.measureText(right).width;
    ctx.fillText(right, w - pad - textWidth, h - 10 * dpr);
  }
}

function renderLineChart(records) {
  const canvas = refs.lineChart;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = canvas.clientWidth;
  const cssHeight = Math.round(cssWidth * 0.32);
  canvas.width = Math.max(600, Math.round(cssWidth * dpr));
  canvas.height = Math.max(300, Math.round(cssHeight * dpr));

  const w = canvas.width;
  const h = canvas.height;
  const pad = 62 * dpr;
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;

  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
  ctx.lineWidth = 1;

  for (let i = 0; i <= 4; i += 1) {
    const y = pad + (innerH * i) / 4;
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(w - pad, y);
    ctx.stroke();
  }

  if (!records.length) {
    refs.lineMeta.textContent = '当前范围暂无数据';
    return;
  }

  const maxRaw = Math.max(
    ...records.map((r) => Math.max(Number(r.input || 0), Number(r.output || 0))),
    1
  );

  drawAxisLabels(ctx, dpr, w, h, pad, maxRaw, records[0].timestamp, records[records.length - 1].timestamp);

  if (records.length < 2) {
    refs.lineMeta.textContent = `范围 ${records[0].timestamp.slice(0, 16)} | 单位 ${unitLabel()} | 仅 1 条记录`;
    return;
  }

  function drawLine(color, key) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2 * dpr;
    ctx.beginPath();
    records.forEach((r, i) => {
      const x = pad + (innerW * i) / (records.length - 1);
      const y = pad + innerH - (Number(r[key] || 0) / maxRaw) * innerH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  drawLine(getComputedStyle(document.documentElement).getPropertyValue('--input-line').trim(), 'input');
  drawLine(getComputedStyle(document.documentElement).getPropertyValue('--output-line').trim(), 'output');

  const totalInput = records.reduce((n, r) => n + Number(r.input || 0), 0);
  const totalOutput = records.reduce((n, r) => n + Number(r.output || 0), 0);
  refs.lineMeta.textContent = `范围 ${records[0].timestamp.slice(0, 16)} ~ ${records[records.length - 1].timestamp.slice(0, 16)} | 单位 ${unitLabel()} | 输入 ${state.unit === 'k' ? (totalInput / 1000).toFixed(1) : formatNumber(totalInput)} | 输出 ${state.unit === 'k' ? (totalOutput / 1000).toFixed(1) : formatNumber(totalOutput)}`;
}

function filterRecords() {
  const start = refs.startDate.value;
  const end = refs.endDate.value;
  state.start = start;
  state.end = end;
  state.filtered = state.records.filter((r) => {
    const day = r.timestamp.slice(0, 10);
    if (start && day < start) return false;
    if (end && day > end) return false;
    return true;
  });
  state.lineFiltered = calcLineRecords();
}

function setActiveRangeBtn() {
  refs.quickRangeGroup.querySelectorAll('.range-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.range === state.quickRange);
  });
}

function render() {
  filterRecords();
  const daily = dailyMap(state.filtered);
  renderHeatmap(refs.inputHeatmap, daily, 'input');
  renderHeatmap(refs.outputHeatmap, daily, 'output');
  setActiveRangeBtn();
  renderLineChart(state.lineFiltered);

  const totalInput = state.filtered.reduce((n, r) => n + Number(r.input || 0), 0);
  const totalOutput = state.filtered.reduce((n, r) => n + Number(r.output || 0), 0);
  refs.statusText.textContent = `记录 ${state.filtered.length} 条 | 输入 ${formatNumber(totalInput)} Token | 输出 ${formatNumber(totalOutput)} Token`;
}

async function loadData() {
  const response = await fetch(`${DATA_URL}?t=${Date.now()}`);
  const payload = await response.json();
  state.records = Array.isArray(payload.records) ? payload.records : [];
  state.records.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  if (state.records.length) {
    const min = state.records[0].timestamp.slice(0, 10);
    const max = state.records[state.records.length - 1].timestamp.slice(0, 10);
    refs.startDate.min = min;
    refs.startDate.max = max;
    refs.endDate.min = min;
    refs.endDate.max = max;
    if (!refs.startDate.value) refs.startDate.value = min;
    if (!refs.endDate.value) refs.endDate.value = max;
  }

  render();
}

function bindEvents() {
  refs.applyBtn.addEventListener('click', () => {
    state.quickRange = 'custom';
    render();
  });

  refs.resetBtn.addEventListener('click', () => {
    refs.startDate.value = '';
    refs.endDate.value = '';
    state.quickRange = 'custom';
    render();
  });

  refs.autoTheme.addEventListener('change', (e) => {
    if (e.target.checked) {
      setTheme('auto');
      return;
    }
    setTheme(refs.darkTheme.checked ? 'dark' : 'light');
  });

  refs.darkTheme.addEventListener('change', (e) => {
    if (refs.autoTheme.checked) refs.autoTheme.checked = false;
    setTheme(e.target.checked ? 'dark' : 'light');
  });

  refs.quickRangeGroup.addEventListener('click', (e) => {
    const target = e.target.closest('.range-btn');
    if (!target) return;
    state.quickRange = target.dataset.range;
    render();
  });

  refs.unitSelect.addEventListener('change', (e) => {
    state.unit = e.target.value;
    renderLineChart(state.lineFiltered);
  });

  window.addEventListener('resize', () => renderLineChart(state.lineFiltered));
}

async function init() {
  state.theme = localStorage.getItem(THEME_KEY) || 'auto';
  applyTheme();
  bindEvents();
  await loadData();
  setInterval(() => {
    if (state.theme === 'auto') applyTheme();
  }, 60000);
  setInterval(loadData, 60000);
}

init();
