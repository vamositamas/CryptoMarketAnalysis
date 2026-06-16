import { Router } from 'express';
import { getDatabasePool } from '../config/database.config';
import { ChartDataRepository } from '../repositories/chart-data.repository';
import { ChartDataRequestError, ChartDataService, type ChartId } from '../services/chart-data.service';

interface ChartsRouterOptions {
  chartDataService?: Pick<ChartDataService, 'getChartData'>;
}

const CHART_IDS: ChartId[] = ['bitcoin-rainbow', 'pi-cycle-top', 'stock-to-flow'];

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
