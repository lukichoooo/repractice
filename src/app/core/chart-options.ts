import type { EChartsOption } from 'echarts';
import type {
  CfRatingChange,
  MonthPoint,
  ProblemAnalysis,
  TagStats,
  VerdictSummary,
} from './models';
import { verdictLabel } from './format';

const AXIS = '#8fa3bf';
const GRID_LINE = 'rgba(143, 163, 191, 0.12)';
const TOOLTIP = {
  backgroundColor: '#151d2b',
  borderColor: '#2a3750',
  borderWidth: 1,
  textStyle: { color: '#e7ecf5', fontSize: 12 },
  extraCssText: 'box-shadow: 0 12px 32px rgba(0,0,0,.45); border-radius: 10px;',
};

const PALETTE = ['#5b8def', '#ff7a45', '#ffd166', '#3ddc97', '#b388ff', '#4ecdc4', '#ff5d6c'];

export function activityOptions(points: MonthPoint[]): EChartsOption {
  return {
    color: ['#5b8def', '#ff6b6b'],
    grid: { left: 44, right: 18, top: 28, bottom: 48 },
    tooltip: { ...TOOLTIP, trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: {
      top: 0,
      right: 0,
      textStyle: { color: AXIS, fontSize: 11 },
      itemWidth: 10,
      itemHeight: 10,
    },
    xAxis: {
      type: 'category',
      data: points.map((point) => point.label),
      axisLine: { lineStyle: { color: GRID_LINE } },
      axisTick: { show: false },
      axisLabel: { color: AXIS, fontSize: 10, interval: 5 },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: GRID_LINE } },
      axisLabel: { color: AXIS, fontSize: 10 },
    },
    series: [
      {
        name: 'Submissions',
        type: 'bar',
        data: points.map((point) => point.submissions),
        itemStyle: { borderRadius: [3, 3, 0, 0], opacity: 0.75 },
        barMaxWidth: 14,
      },
      {
        name: 'Failed',
        type: 'line',
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 2 },
        areaStyle: { opacity: 0.08 },
        data: points.map((point) => point.failures),
      },
    ],
  };
}

export function ratingOptions(history: CfRatingChange[]): EChartsOption {
  const labels = history.map((change) =>
    new Date(change.ratingUpdateTimeSeconds * 1000).toLocaleDateString('en-GB', {
      month: 'short',
      year: '2-digit',
    }),
  );
  return {
    grid: { left: 48, right: 22, top: 26, bottom: 36 },
    tooltip: {
      ...TOOLTIP,
      trigger: 'axis',
      formatter: (params: unknown) => {
        const list = params as { dataIndex: number }[];
        const index = list[0]?.dataIndex ?? 0;
        const change = history[index];
        if (!change) return '';
        return `<strong>${change.contestName}</strong><br/>${change.oldRating} → <strong>${change.newRating}</strong><br/>Rank #${change.rank}`;
      },
    },
    xAxis: {
      type: 'category',
      data: labels,
      boundaryGap: false,
      axisLine: { lineStyle: { color: GRID_LINE } },
      axisTick: { show: false },
      axisLabel: { color: AXIS, fontSize: 10, interval: Math.max(0, Math.floor(labels.length / 8)) },
    },
    yAxis: {
      type: 'value',
      scale: true,
      splitLine: { lineStyle: { color: GRID_LINE } },
      axisLabel: { color: AXIS, fontSize: 10 },
    },
    series: [
      {
        type: 'line',
        data: history.map((change) => change.newRating),
        smooth: true,
        symbol: 'circle',
        symbolSize: 4,
        lineStyle: { width: 2.5, color: '#5b8def' },
        itemStyle: { color: '#5b8def' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(91, 141, 239, 0.35)' },
              { offset: 1, color: 'rgba(91, 141, 239, 0.01)' },
            ],
          },
        },
      },
    ],
  };
}

export function verdictOptions(verdicts: VerdictSummary[]): EChartsOption {
  return {
    color: PALETTE,
    tooltip: {
      ...TOOLTIP,
      trigger: 'item',
      formatter: (params: unknown) => {
        const item = params as { name: string; value: number; percent: number };
        return `${item.name}<br/><strong>${item.value}</strong> failures (${item.percent}%)`;
      },
    },
    legend: {
      orient: 'vertical',
      right: 8,
      top: 'middle',
      textStyle: { color: AXIS, fontSize: 11 },
      itemWidth: 9,
      itemHeight: 9,
    },
    series: [
      {
        type: 'pie',
        radius: ['48%', '72%'],
        center: ['34%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: '#111827', borderWidth: 3 },
        label: { show: false },
        emphasis: { label: { show: false }, scaleSize: 6 },
        data: verdicts.slice(0, 8).map((verdict) => ({
          name: verdictLabel(verdict.verdict),
          value: verdict.count,
        })),
      },
    ],
  };
}

export function tagOptions(tags: TagStats[]): EChartsOption {
  const shown = [...tags].slice(0, 8).reverse();
  return {
    grid: { left: 110, right: 30, top: 12, bottom: 24 },
    tooltip: {
      ...TOOLTIP,
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: unknown) => {
        const list = params as { dataIndex: number }[];
        const tag = shown[list[0]?.dataIndex ?? 0];
        if (!tag) return '';
        return `<strong>${tag.tag}</strong><br/>${Math.round(tag.failureRate * 100)}% failure rate<br/>${tag.avgFailures.toFixed(1)} avg failures · ${tag.problems} problems`;
      },
    },
    xAxis: {
      type: 'value',
      max: 100,
      splitLine: { lineStyle: { color: GRID_LINE } },
      axisLabel: { color: AXIS, fontSize: 10, formatter: '{value}%' },
    },
    yAxis: {
      type: 'category',
      data: shown.map((tag) => tag.tag),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#c9d4e5', fontSize: 11 },
    },
    series: [
      {
        type: 'bar',
        data: shown.map((tag) => Number((tag.failureRate * 100).toFixed(1))),
        barWidth: 10,
        itemStyle: {
          borderRadius: [0, 5, 5, 0],
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 1,
            y2: 0,
            colorStops: [
              { offset: 0, color: '#ff7a45' },
              { offset: 1, color: '#ff5d6c' },
            ],
          },
        },
      },
    ],
  };
}

export function difficultyOptions(problems: ProblemAnalysis[]): EChartsOption {
  const rated = problems.filter((problem) => problem.rating != null);
  const solved = rated.filter((problem) => problem.acs > 0);
  const unsolved = rated.filter((problem) => problem.acs === 0);
  const maxRating = Math.max(2400, ...rated.map((problem) => problem.rating ?? 0));

  return {
    grid: { left: 48, right: 20, top: 32, bottom: 38 },
    tooltip: {
      ...TOOLTIP,
      trigger: 'item',
      formatter: (params: unknown) => {
        const item = params as { data: { name: string; value: [number, number] } };
        return `<strong>${item.data.name}</strong><br/>Rating ${item.data.value[0]} · ${item.data.value[1]} failures`;
      },
    },
    legend: {
      top: 0,
      right: 0,
      textStyle: { color: AXIS, fontSize: 11 },
      itemWidth: 9,
      itemHeight: 9,
    },
    xAxis: {
      type: 'value',
      name: 'problem rating',
      nameTextStyle: { color: AXIS, fontSize: 10 },
      min: 800,
      max: maxRating + 100,
      splitLine: { lineStyle: { color: GRID_LINE } },
      axisLabel: { color: AXIS, fontSize: 10 },
    },
    yAxis: {
      type: 'value',
      name: 'failures',
      nameTextStyle: { color: AXIS, fontSize: 10 },
      splitLine: { lineStyle: { color: GRID_LINE } },
      axisLabel: { color: AXIS, fontSize: 10 },
    },
    series: [
      {
        name: 'Solved',
        type: 'scatter',
        symbolSize: 7,
        itemStyle: { color: 'rgba(91, 141, 239, 0.6)' },
        data: solved.map((problem) => ({
          name: `${problem.contestId}${problem.index} · ${problem.name}`,
          value: [problem.rating, problem.failures],
        })),
      },
      {
        name: 'Never solved',
        type: 'scatter',
        symbolSize: 9,
        itemStyle: { color: 'rgba(192, 132, 252, 0.85)' },
        data: unsolved.map((problem) => ({
          name: `${problem.contestId}${problem.index} · ${problem.name}`,
          value: [problem.rating, problem.failures],
        })),
      },
    ],
  };
}
