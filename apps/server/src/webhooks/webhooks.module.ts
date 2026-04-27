import { Module } from '@nestjs/common';
import { SeedModule } from '../seed/seed.module.js';
import { WebhooksController } from './webhooks.controller.js';

@Module({
  imports: [SeedModule],
  controllers: [WebhooksController],
})
export class WebhooksModule {}
