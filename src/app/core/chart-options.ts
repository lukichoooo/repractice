import type { EChartsOption } from 'echarts';
import type { CfRatingChange, MonthPoint } from './models';

const AXIS = '#8fa3bf';
const GRID_LINE = 'rgba(143, 163, 191, 0.12)';
const TOOLTIP = {
  backgroundColor: '#151d2b',
  borderColor: '#2a3750',
  borderWidth: 1,
  textStyle: { color: '#e7ecf5', fontSize: 12 },
  extraCssText: 'box-shadow: 0 12px 32px rgba(0,0,0,.45); border-radius: 10px;',
};

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
      axisLabel: {
        color: AXIS,
        fontSize: 10,
        interval: Math.max(0, Math.ceil(points.length / 12) - 1),
      },
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
      axisLabel: {
        color: AXIS,
        fontSize: 10,
        interval: Math.max(0, Math.floor(labels.length / 8)),
      },
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
