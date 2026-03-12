import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const authorization = req.headers.authorization ?? '';
    const secret = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';

    const expected = process.env.SUPER_ADMIN_SECRET?.trim();
    if (!expected) {
      throw new UnauthorizedException('SUPER_ADMIN_SECRET no configurado en el servidor.');
    }
    if (!secret || secret !== expected) {
      throw new UnauthorizedException('Acceso de super-admin no autorizado.');
    }
    return true;
  }
}
