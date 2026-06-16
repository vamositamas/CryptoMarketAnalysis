import { ChartAnnotationError, ChartAnnotationService } from './chart-annotation.service';

describe('ChartAnnotationService', () => {
  it('creates a note annotation when under the chart limit', async () => {
    const store = createStore();
    store.countForChart.mockResolvedValue(0);
    store.create.mockImplementation(async (input) => ({
      id: 'annotation-id',
      createdAt: '2026-06-10T00:00:00.000Z',
      ...input,
    }));

    await expect(
      new ChartAnnotationService(store).create('user-id', {
        chartId: 'bitcoin-rainbow',
        type: 'note',
        date: '2026-06-10',
        priceLevel: 70000,
        text: 'Resistance at $70k',
        color: '#FFEB3B',
      }),
    ).resolves.toMatchObject({
      id: 'annotation-id',
      type: 'note',
      text: 'Resistance at $70k',
    });
  });

  it('rejects the 51st annotation on a chart', async () => {
    const store = createStore();
    store.countForChart.mockResolvedValue(50);

    await expect(
      new ChartAnnotationService(store).create('user-id', {
        chartId: 'bitcoin-rainbow',
        type: 'note',
        date: '2026-06-10',
        priceLevel: 70000,
        text: 'Resistance at $70k',
        color: '#FFEB3B',
      }),
    ).rejects.toEqual(new ChartAnnotationError(400, 'Maximum 50 annotations per chart'));
  });

  it('deletes only owned annotations', async () => {
    const store = createStore();
    store.deleteOwned.mockResolvedValue(false);

    await expect(
      new ChartAnnotationService(store).delete('user-id', 'annotation-id'),
    ).rejects.toEqual(new ChartAnnotationError(404, 'Annotation not found'));
  });
});

function createStore() {
  return {
    listForChart: jest.fn(),
    countForChart: jest.fn(),
    create: jest.fn(),
    deleteOwned: jest.fn(),
  };
}
