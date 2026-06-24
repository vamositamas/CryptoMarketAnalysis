export interface CsvColumn<TRow> {
  header: string;
  value: (row: TRow) => string | number | null;
}

export interface PngExportInput {
  chartImageDataUrl: string;
  chartTitle: string;
  fileName: string;
  exportedAt?: Date;
  documentRef?: Document;
}

export interface CsvExportInput<TRow> {
  rows: TRow[];
  columns: CsvColumn<TRow>[];
  fileName: string;
  documentRef?: Document;
}

const PNG_WIDTH = 1920;
const PNG_HEIGHT = 1080;
const HEADER_HEIGHT = 112;
const WATERMARK = 'BitWLab.com';

export async function exportChartPng(input: PngExportInput): Promise<void> {
  const documentRef = input.documentRef ?? document;
  const canvas = documentRef.createElement('canvas');
  canvas.width = PNG_WIDTH;
  canvas.height = PNG_HEIGHT;
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Canvas export is not supported in this browser');
  }

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, PNG_WIDTH, PNG_HEIGHT);
  context.fillStyle = '#17202a';
  context.font = '700 40px Inter, Arial, sans-serif';
  context.fillText(input.chartTitle, 48, 58);
  context.font = '500 24px Inter, Arial, sans-serif';
  context.fillStyle = '#65736f';
  context.fillText(formatExportDate(input.exportedAt ?? new Date()), 48, 94);

  const image = await loadImage(input.chartImageDataUrl, documentRef);
  context.drawImage(image, 48, HEADER_HEIGHT, PNG_WIDTH - 96, PNG_HEIGHT - HEADER_HEIGHT - 72);
  context.font = '700 22px Inter, Arial, sans-serif';
  context.fillStyle = 'rgba(23, 32, 42, 0.7)';
  context.textAlign = 'right';
  context.fillText(WATERMARK, PNG_WIDTH - 48, PNG_HEIGHT - 28);

  triggerDownload(canvas.toDataURL('image/png'), input.fileName, documentRef);
}

export function exportChartCsv<TRow>(input: CsvExportInput<TRow>): void {
  const csv = [
    input.columns.map((column) => escapeCsv(column.header)).join(','),
    ...input.rows.map((row) =>
      input.columns
        .map((column) => {
          const value = column.value(row);
          return escapeCsv(value === null ? '' : String(value));
        })
        .join(','),
    ),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  try {
    triggerDownload(url, input.fileName, input.documentRef ?? document);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function getExportDateStamp(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function formatCsvNumber(value: number | null): string {
  return value === null ? '' : value.toFixed(2);
}

function loadImage(dataUrl: string, documentRef: Document): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = documentRef.createElement('img');
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Chart image could not be loaded'));
    image.src = dataUrl;
  });
}

function triggerDownload(url: string, fileName: string, documentRef: Document): void {
  const link = documentRef.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
}

function escapeCsv(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function formatExportDate(date: Date): string {
  return `Exported ${date.toISOString().slice(0, 10)}`;
}
