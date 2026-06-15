import {
  reportHistoricalDataInitializationCliFailure,
  runHistoricalDataInitializationCli,
} from './init-historical-data';

runHistoricalDataInitializationCli().catch(reportHistoricalDataInitializationCliFailure);
