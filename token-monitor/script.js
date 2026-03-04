const DATA_URL = './data/token-usage.json';
const THEME_KEY = 'token-monitor-theme';

const state = {
  records: [],
  filtered: [],
  lineFiltered: [],
  theme: 'auto',
  quickRange: 'custom',
  unit: 'token',
  hoverIndex: -1,
  chartPoints: [],
  pageIndex: 0,
  pageSize: 8,
  generatedAt: ''
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
  chartTooltip: document.getElementById('chartTooltip'),
  autoTheme: document.getElementById('autoTheme'),
  darkTheme: document.getElementById('darkTheme'),
  quickRangeGroup: document.getElementById('quickRangeGroup'),
  unitGroup: document.getElementById('unitGroup'),
  weekRangeText: document.getElementById('weekRangeText'),
  weekInputTotal: document.getElementById('weekInputTotal'),
  weekOutputTotal: document.getElementById('weekOutputTotal'),
  weekSumTotal: document.getElementById('weekSumTotal'),
  weekRows: document.getElementById('weekRows'),
  weekPageRows: document.getElementById('weekPageRows'),
  prevPageBtn: document.getElementById('prevPageBtn'),
  nextPageBtn: document.getElementById('nextPageBtn'),
  pageText: document.getElementById('pageText'),
  refreshAt: document.getElementById('refreshAt'),
  nowClock: document.getElementById('nowClock')
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

function formatDateTime(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('zh-CN', { hour12: false });
}

function unitLabel() {
  return state.unit === 'k' ? 'K Token' : 'Token';
}

function toUnit(v) {
  return state.unit === 'k' ? v / 1000 : v;
}

function unitText(v) {
  const n = toUnit(v);
  return state.unit === 'k' ? n.toFixed(2) : `${formatNumber(n)}`;
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

function setDateOptions() {
  const days = Array.from(new Set(state.records.map((r) => r.timestamp.slice(0, 10))));
  const startValue = refs.startDate.value;
  const endValue = refs.endDate.value;

  const options = ['<option value="">全部</option>']
    .concat(days.map((d) => `<option value="${d}">${d}</option>`))
    .join('');

  refs.startDate.innerHTML = options;
  refs.endDate.innerHTML = options;

  const min = days[0] || '';
  const max = days[days.length - 1] || '';

  refs.startDate.value = days.includes(startValue) ? startValue : min;
  refs.endDate.value = days.includes(endValue) ? endValue : max;
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

function drawGrid(ctx, w, h, pad, innerH) {
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const y = pad + (innerH * i) / 4;
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(w - pad, y);
    ctx.stroke();
  }
}

function drawAxisLabels(ctx, dpr, w, h, pad, maxYValue, firstTs, lastTs) {
  const textColor = getComputedStyle(document.documentElement).getPropertyValue('--muted').trim() || '#94a3b8';
  ctx.fillStyle = textColor;
  ctx.font = `${11 * dpr}px sans-serif`;

  for (let i = 0; i <= 4; i += 1) {
    const val = toUnit((maxYValue * (4 - i)) / 4);
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

function smoothLine(ctx, points) {
  if (!points.length) return;
  if (points.length === 1) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    ctx.lineTo(points[0].x, points[0].y);
    ctx.stroke();
    return;
  }

  // Catmull-Rom to Bezier: smooth and guaranteed to pass every data point.
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
  }

  ctx.stroke();
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
  drawGrid(ctx, w, h, pad, innerH);

  if (state.hoverIndex < 0) refs.chartTooltip.hidden = true;
  state.chartPoints = [];

  if (!records.length) {
    refs.lineMeta.textContent = '当前范围暂无数据';
    return;
  }

  const maxRaw = Math.max(
    ...records.map((r) => Math.max(Number(r.input || 0), Number(r.output || 0))),
    1
  );

  drawAxisLabels(ctx, dpr, w, h, pad, maxRaw, records[0].timestamp, records[records.length - 1].timestamp);

  const pointsInput = [];
  const pointsOutput = [];

  records.forEach((r, i) => {
    const x = records.length === 1 ? pad + innerW / 2 : pad + (innerW * i) / (records.length - 1);
    const yIn = pad + innerH - (Number(r.input || 0) / maxRaw) * innerH;
    const yOut = pad + innerH - (Number(r.output || 0) / maxRaw) * innerH;
    pointsInput.push({ x, y: yIn, index: i });
    pointsOutput.push({ x, y: yOut, index: i });
    state.chartPoints.push({ x, index: i, record: r, yIn, yOut });
  });

  const inputColor = getComputedStyle(document.documentElement).getPropertyValue('--input-line').trim();
  const outputColor = getComputedStyle(document.documentElement).getPropertyValue('--output-line').trim();

  ctx.lineWidth = 2 * dpr;
  ctx.strokeStyle = inputColor;
  smoothLine(ctx, pointsInput);
  ctx.strokeStyle = outputColor;
  smoothLine(ctx, pointsOutput);

  pointsInput.forEach((p) => {
    ctx.beginPath();
    ctx.fillStyle = inputColor;
    ctx.arc(p.x, p.y, 2.5 * dpr, 0, Math.PI * 2);
    ctx.fill();
  });
  pointsOutput.forEach((p) => {
    ctx.beginPath();
    ctx.fillStyle = outputColor;
    ctx.arc(p.x, p.y, 2.5 * dpr, 0, Math.PI * 2);
    ctx.fill();
  });

  if (state.hoverIndex >= 0 && state.hoverIndex < state.chartPoints.length) {
    const hp = state.chartPoints[state.hoverIndex];

    ctx.beginPath();
    ctx.fillStyle = inputColor;
    ctx.arc(hp.x, hp.yIn, 5 * dpr, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = outputColor;
    ctx.arc(hp.x, hp.yOut, 5 * dpr, 0, Math.PI * 2);
    ctx.fill();
  }

  const totalInput = records.reduce((n, r) => n + Number(r.input || 0), 0);
  const totalOutput = records.reduce((n, r) => n + Number(r.output || 0), 0);
  refs.lineMeta.textContent = `范围 ${records[0].timestamp.slice(0, 16)} ~ ${records[records.length - 1].timestamp.slice(0, 16)} | 单位 ${unitLabel()} | 输入 ${unitText(totalInput)} | 输出 ${unitText(totalOutput)}`;
}

function filterRecords() {
  const start = refs.startDate.value;
  const end = refs.endDate.value;
  state.filtered = state.records.filter((r) => {
    const day = r.timestamp.slice(0, 10);
    if (start && day < start) return false;
    if (end && day > end) return false;
    return true;
  });
  state.lineFiltered = calcLineRecords();
}

function setActiveButtons() {
  refs.quickRangeGroup.querySelectorAll('.range-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.range === state.quickRange);
  });
  refs.unitGroup.querySelectorAll('.range-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.unit === state.unit);
  });
}

function renderWeekCard() {
  if (!state.records.length) {
    refs.weekRangeText.textContent = '暂无数据';
    refs.weekInputTotal.textContent = '0';
    refs.weekOutputTotal.textContent = '0';
    refs.weekSumTotal.textContent = '0';
    refs.weekRows.innerHTML = '';
    refs.weekPageRows.innerHTML = '';
    refs.pageText.textContent = '第 0/0 页';
    refs.prevPageBtn.disabled = true;
    refs.nextPageBtn.disabled = true;
    return;
  }

  const dayMap = new Map();
  state.records.forEach((r) => {
    const d = r.timestamp.slice(0, 10);
    if (!dayMap.has(d)) dayMap.set(d, { input: 0, output: 0 });
    const row = dayMap.get(d);
    row.input += Number(r.input || 0);
    row.output += Number(r.output || 0);
  });

  const allRows = Array.from(dayMap.entries())
    .map(([day, item]) => ({ day, input: item.input, output: item.output, total: item.input + item.output }))
    .sort((a, b) => a.day.localeCompare(b.day));

  const weekRows = allRows.slice(-7);
  const totalInput = weekRows.reduce((n, r) => n + r.input, 0);
  const totalOutput = weekRows.reduce((n, r) => n + r.output, 0);
  const totalSum = totalInput + totalOutput;
  const maxTotal = Math.max(...weekRows.map((r) => r.total), 1);
  const maxBar = 260;

  refs.weekRangeText.textContent = `${weekRows[0].day} ~ ${weekRows[weekRows.length - 1].day}`;
  refs.weekInputTotal.textContent = `${formatNumber(totalInput)} Token`;
  refs.weekOutputTotal.textContent = `${formatNumber(totalOutput)} Token`;
  refs.weekSumTotal.textContent = `${formatNumber(totalSum)} Token`;

  refs.weekRows.innerHTML = weekRows
    .map((r) => {
      const w = Math.max(2, Math.round((r.total / maxTotal) * maxBar));
      return `<div class="week-row"><span class="day">${r.day}</span><div class="week-line"><i style="width:${w}px"></i></div><span class="num">${formatNumber(r.total)} token</span></div>`;
    })
    .join('');

  const pageCount = Math.max(1, Math.ceil(allRows.length / state.pageSize));
  if (state.pageIndex >= pageCount) state.pageIndex = pageCount - 1;
  if (state.pageIndex < 0) state.pageIndex = 0;

  const start = state.pageIndex * state.pageSize;
  const pageRows = allRows.slice(start, start + state.pageSize);
  const pageMax = Math.max(...pageRows.map((r) => r.total), 1);

  refs.weekPageRows.innerHTML = pageRows
    .map((r) => {
      const w = Math.max(2, Math.round((r.total / pageMax) * 220));
      return `<div class="page-row"><span class="date">${r.day}</span><div class="bar"><i style="width:${w}px"></i></div><span class="val">${formatNumber(r.total)} token</span></div>`;
    })
    .join('');

  refs.pageText.textContent = `第 ${state.pageIndex + 1}/${pageCount} 页`;
  refs.prevPageBtn.disabled = state.pageIndex <= 0;
  refs.nextPageBtn.disabled = state.pageIndex >= pageCount - 1;
}

function render() {
  filterRecords();
  const daily = dailyMap(state.filtered);
  renderHeatmap(refs.inputHeatmap, daily, 'input');
  renderHeatmap(refs.outputHeatmap, daily, 'output');
  setActiveButtons();
  renderLineChart(state.lineFiltered);
  renderWeekCard();

  const totalInput = state.filtered.reduce((n, r) => n + Number(r.input || 0), 0);
  const totalOutput = state.filtered.reduce((n, r) => n + Number(r.output || 0), 0);
  refs.statusText.textContent = `记录 ${state.filtered.length} 条 | 输入 ${formatNumber(totalInput)} Token | 输出 ${formatNumber(totalOutput)} Token`;
}

function onChartHover(event) {
  if (!state.chartPoints.length) return;

  const rect = refs.lineChart.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const mx = (event.clientX - rect.left) * dpr;

  let nearest = -1;
  let best = Infinity;
  state.chartPoints.forEach((p, i) => {
    const dx = Math.abs(p.x - mx);
    if (dx < best) {
      best = dx;
      nearest = i;
    }
  });

  if (nearest === -1 || best > 18 * dpr) {
    state.hoverIndex = -1;
    refs.chartTooltip.hidden = true;
    renderLineChart(state.lineFiltered);
    return;
  }

  state.hoverIndex = nearest;
  const point = state.chartPoints[nearest];
  refs.chartTooltip.hidden = false;
  refs.chartTooltip.innerHTML = `<span class="tt-time">${point.record.timestamp.slice(0, 19).replace('T', ' ')}</span><span class="tt-val tt-in">输入 ${unitText(Number(point.record.input || 0))} ${unitLabel()}</span><span class="tt-val tt-out">输出 ${unitText(Number(point.record.output || 0))} ${unitLabel()}</span>`;

  refs.chartTooltip.style.left = `${event.clientX - rect.left}px`;
  refs.chartTooltip.style.top = `${event.clientY - rect.top - 12}px`;

  renderLineChart(state.lineFiltered);
}

function onChartLeave() {
  state.hoverIndex = -1;
  refs.chartTooltip.hidden = true;
  renderLineChart(state.lineFiltered);
}

async function loadData() {
  const response = await fetch(`${DATA_URL}?t=${Date.now()}`);
  const payload = await response.json();
  state.records = Array.isArray(payload.records) ? payload.records : [];
  state.generatedAt = payload.generatedAt || '';
  state.records.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  setDateOptions();
  refs.refreshAt.textContent = formatDateTime(state.generatedAt || new Date().toISOString());
  render();
}

function bindEvents() {
  refs.applyBtn.addEventListener('click', () => {
    state.quickRange = 'custom';
    state.hoverIndex = -1;
    render();
  });

  refs.resetBtn.addEventListener('click', () => {
    refs.startDate.value = '';
    refs.endDate.value = '';
    state.quickRange = 'custom';
    state.hoverIndex = -1;
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
    state.hoverIndex = -1;
    render();
  });

  refs.unitGroup.addEventListener('click', (e) => {
    const target = e.target.closest('.range-btn');
    if (!target) return;
    state.unit = target.dataset.unit;
    renderLineChart(state.lineFiltered);
    setActiveButtons();
  });

  refs.lineChart.addEventListener('mousemove', onChartHover);
  refs.lineChart.addEventListener('mouseleave', onChartLeave);

  refs.prevPageBtn.addEventListener('click', () => {
    state.pageIndex -= 1;
    renderWeekCard();
  });

  refs.nextPageBtn.addEventListener('click', () => {
    state.pageIndex += 1;
    renderWeekCard();
  });

  window.addEventListener('resize', () => renderLineChart(state.lineFiltered));
}

async function init() {
  state.theme = localStorage.getItem(THEME_KEY) || 'auto';
  applyTheme();
  bindEvents();
  await loadData();

  refs.nowClock.textContent = formatDateTime(new Date().toISOString());
  setInterval(() => {
    if (state.theme === 'auto') applyTheme();
    refs.nowClock.textContent = formatDateTime(new Date().toISOString());
  }, 60000);

  setInterval(loadData, 60000);
}

init();
