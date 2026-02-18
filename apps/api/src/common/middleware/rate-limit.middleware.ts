import { HttpException, HttpStatus, Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

type Bucket = {
  hits: number[];
};

type RateLimitPolicy = {
  key: string;
  ttlMs: number;
  limit: number;
};

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly buckets = new Map<string, Bucket>();
  private readonly ttlMs = this.parsePositiveInteger(process.env.PUBLIC_RATE_LIMIT_WINDOW_MS, 60_000);
  private readonly limit = this.parsePositiveInteger(process.env.PUBLIC_RATE_LIMIT_MAX, 60);
  private readonly googleLoginTtlMs = this.parsePositiveInteger(
    process.env.PUBLIC_GOOGLE_LOGIN_RATE_LIMIT_WINDOW_MS,
    60_000
  );
  private readonly googleLoginLimit = this.parsePositiveInteger(process.env.PUBLIC_GOOGLE_LOGIN_RATE_LIMIT_MAX, 10);

  use(req: Request, _res: Response, next: NextFunction) {
    const now = Date.now();
    const policy = this.resolvePolicy(req);
    const key = `${req.ip ?? 'unknown'}:${policy.key}`;
    const bucket = this.buckets.get(key) ?? { hits: [] };

    bucket.hits = bucket.hits.filter((value) => now - value < policy.ttlMs);
    if (bucket.hits.length >= policy.limit) {
      throw new HttpException('Demasiadas solicitudes. Intenta de nuevo más tarde.', HttpStatus.TOO_MANY_REQUESTS);
    }

    bucket.hits.push(now);
    this.buckets.set(key, bucket);
    next();
  }

  private resolvePolicy(req: Request): RateLimitPolicy {
    const method = req.method?.toUpperCase() ?? '';
    const normalizedPath = `${req.baseUrl || ''}${req.path || ''}`.toLowerCase();

    if (method === 'POST' && /\/public\/[^/]+\/customer-portal\/google$/.test(normalizedPath)) {
      return {
        key: 'public/customer-portal/google',
        ttlMs: this.googleLoginTtlMs,
        limit: this.googleLoginLimit
      };
    }

    return {
      key: req.baseUrl || req.path,
      ttlMs: this.ttlMs,
      limit: this.limit
    };
  }

  private parsePositiveInteger(rawValue: string | undefined, fallback: number) {
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }
    return Math.floor(parsed);
  }
}
