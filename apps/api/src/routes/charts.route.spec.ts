import type { Request, Response, Router } from 'express';
import { createChartsRouter } from './charts.route';

type Handler = (req: Request, res: Response, next: jest.Mock) => Promise<void> | void;

function createResponse() {
  const response = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };

  return response as Response & typeof response;
}

function getHandler(router: Router, path: string): Handler {
  const layer = router.stack.find((entry) => entry.route?.path === path);

  if (!layer?.route?.stack[0]) {
    throw new Error(`${path} route not found`);
  }

  return layer.route.stack[0].handle as Handler;
}

describe('createChartsRouter', () => {
  it('returns chart data for a public chart endpoint', async () => {
    const chartDataService = {
      getChartData: jest.fn().mockResolvedValue({
        chartId: 'bitcoin-rainbow',
        title: 'Bitcoin Rainbow Price Chart',
        timeframe: '1y',
        dataPoints: [],
        lastUpdated: null,
      }),
    };
    const response = createResponse();

    await getHandler(createChartsRouter({ chartDataService }), '/bitcoin-rainbow')(
      { query: { timeframe: '1y' } } as unknown as Request,
      response,
      jest.fn(),
    );

    expect(chartDataService.getChartData).toHaveBeenCalledWith('bitcoin-rainbow', '1y');
    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({ chartId: 'bitcoin-rainbow', timeframe: '1y' });
  });
});
