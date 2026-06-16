import { exportChartCsv, formatCsvNumber, getExportDateStamp } from './chart-export.util';

describe('chart export utilities', () => {
  it('formats export date stamps as ISO dates', () => {
    expect(getExportDateStamp(new Date('2026-06-10T12:30:00.000Z'))).toBe('2026-06-10');
  });

  it('formats nullable CSV numbers', () => {
    expect(formatCsvNumber(67234.5)).toBe('67234.50');
    expect(formatCsvNumber(null)).toBe('');
  });

  it('exports CSV with escaped values and requested filename', () => {
    const clickedLinks: HTMLAnchorElement[] = [];
    const documentRef = {
      createElement: jest.fn((tag: string) => {
        const link = document.createElement(tag) as HTMLAnchorElement;
        link.click = jest.fn(() => clickedLinks.push(link));
        return link;
      }),
    } as unknown as Document;
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: jest.fn(),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: jest.fn(),
    });
    const createObjectUrl = jest.spyOn(URL, 'createObjectURL').mockReturnValue('blob:csv');
    const revokeObjectUrl = jest.spyOn(URL, 'revokeObjectURL').mockImplementation();

    exportChartCsv({
      rows: [{ date: '2026-06-10', price: 67234.5, label: 'A, B' }],
      columns: [
        { header: 'Date', value: (row) => row.date },
        { header: 'Price USD', value: (row) => row.price.toFixed(2) },
        { header: 'Label', value: (row) => row.label },
      ],
      fileName: 'pi-cycle-top_2026-06-10.csv',
      documentRef,
    });

    expect(createObjectUrl).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'text/csv;charset=utf-8' }),
    );
    expect(clickedLinks[0].download).toBe('pi-cycle-top_2026-06-10.csv');
    expect(clickedLinks[0].href).toBe('blob:csv');
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:csv');
  });
});
