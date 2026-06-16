import { Component, Input } from '@angular/core';

export interface ChartInfoField {
  label: string;
  value: string;
}

@Component({
  selector: 'app-chart-info-panel',
  standalone: true,
  templateUrl: './chart-info-panel.component.html',
})
export class ChartInfoPanelComponent {
  @Input({ required: true }) title = '';
  @Input({ required: true }) about = '';
  @Input({ required: true }) interpretation = '';
  @Input({ required: true }) currentFields: ChartInfoField[] = [];
  @Input({ required: true }) dataSources: string[] = [];
  @Input({ required: true }) lastUpdated = '';
  @Input() learnMoreHref = '';
}
