import { loadApiEnv } from '../apps/api/src/config/env.config';
import { createApp } from '../apps/api/src/app';

loadApiEnv();

export default createApp();
