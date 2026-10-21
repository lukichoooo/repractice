import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  afterNextRender,
  effect,
  input,
  signal,
  viewChild,
} from '@angular/core';
import type { ECharts, EChartsOption } from 'echarts';

@Component({
  selector: 'app-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div
    #host
    class="chart"
    role="img"
    [attr.aria-label]="ariaLabel()"
    [style.height]="height()"
  ></div>`,
  styles: `
    :host {
      display: block;
      width: 100%;
    }

    .chart {
      width: 100%;
      min-height: 180px;
    }
  `,
})
export class ChartComponent implements OnDestroy {
  readonly options = input<EChartsOption | null>(null);
  readonly height = input('280px');
  readonly ariaLabel = input('Chart');

  private readonly host = viewChild.required<ElementRef<HTMLDivElement>>('host');
  private readonly ready = signal(false);
  private chart?: ECharts;
  private resizeObserver?: ResizeObserver;

  constructor() {
    effect(() => {
      const options = this.options();
      if (!this.ready() || !options) return;
      this.chart?.setOption(options, true);
    });

    afterNextRender(() => {
      void this.init();
    });
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.chart?.dispose();
  }

  private async init(): Promise<void> {
    const echarts = await import('echarts');
    const element = this.host().nativeElement;
    this.chart = echarts.init(element, undefined, { renderer: 'canvas' });
    this.resizeObserver = new ResizeObserver(() => this.chart?.resize());
    this.resizeObserver.observe(element);
    this.ready.set(true);
    const options = this.options();
    if (options) this.chart.setOption(options, true);
  }
}
