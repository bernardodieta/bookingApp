import { HttpException, HttpStatus, Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

type Bucket = {
  hits: number[];
};

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly buckets = new Map<string, Bucket>();
  private readonly ttlMs = Number(process.env.PUBLIC_RATE_LIMIT_WINDOW_MS ?? 60_000);
  private readonly limit = Number(process.env.PUBLIC_RATE_LIMIT_MAX ?? 60);

  use(req: Request, _res: Response, next: NextFunction) {
    const now = Date.now();
    const key = `${req.ip ?? 'unknown'}:${req.baseUrl || req.path}`;
    const bucket = this.buckets.get(key) ?? { hits: [] };

    bucket.hits = bucket.hits.filter((value) => now - value < this.ttlMs);
    if (bucket.hits.length >= this.limit) {
      throw new HttpException('Demasiadas solicitudes. Intenta de nuevo más tarde.', HttpStatus.TOO_MANY_REQUESTS);
    }

    bucket.hits.push(now);
    this.buckets.set(key, bucket);
    next();
  }
}
