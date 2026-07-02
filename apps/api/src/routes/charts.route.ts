import { Router } from 'express';
import { getDatabasePool } from '../config/database.config';
import { ChartDataRepository } from '../repositories/chart-data.repository';
import { ChartDataRequestError, ChartDataService, type ChartId } from '../services/chart-data.service';

interface ChartsRouterOptions {
  chartDataService?: Pick<ChartDataService, 'getChartData'>;
}

const CHART_IDS: ChartId[] = ['bitcoin-rainbow', 'pi-cycle-top', 'stock-to-flow', 'mvrv-z-score', 'puell-multiple', 'vdd-multiple', 'realized-price', 'stock-to-income', '2yr-ma-multiplier', 'price-forecast-tools', 'mayer-multiple', '200-week-ma-heatmap', 'fear-greed-index', 'hash-ribbons', 'difficulty-ribbon', 'nvt-ratio', 'thermocap-multiple', 'excess-liquidity', 'spx-liquidity', 'midterm-cycles', 'global-m2-bitcoin', 'dxy-bitcoin', 'exchange-reserve', 'funding-rate-oi', 'exchange-netflow'];

export function createChartsRouter(options: ChartsRouterOptions = {}): Router {
  const router = Router();
  let chartDataService = options.chartDataService;

  for (const chartId of CHART_IDS) {
    router.get(`/${chartId}`, async (req, res, next) => {
      try {
        res.status(200).json(await getChartDataService().getChartData(chartId, req.query.timeframe));
      } catch (error) {
        if (error instanceof ChartDataRequestError) {
          res.status(error.statusCode).json({ error: error.message });
          return;
        }

        next(error);
      }
    });
  }

  return router;

  function getChartDataService(): Pick<ChartDataService, 'getChartData'> {
    chartDataService ??= createDefaultChartDataService();
    return chartDataService;
  }
}

function createDefaultChartDataService(): ChartDataService {
  const database = getDatabasePool();

  if (!database) {
    throw new Error('SUPABASE_DATABASE_URL is required for chart data endpoints');
  }

  return new ChartDataService(new ChartDataRepository(database));
}
