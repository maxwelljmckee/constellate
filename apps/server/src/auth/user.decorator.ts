import { type ExecutionContext, createParamDecorator } from '@nestjs/common';
import type { AuthedRequest } from './supabase-auth.guard.js';

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest<AuthedRequest>();
  return req.user;
});
