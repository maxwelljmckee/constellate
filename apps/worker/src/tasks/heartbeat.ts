import type { Task } from 'graphile-worker';
import { logger } from '../logger.js';

export const heartbeat: Task = async (_payload, helpers) => {
  helpers.logger.info('heartbeat');
  logger.info({ jobId: helpers.job.id }, 'heartbeat tick');
};
