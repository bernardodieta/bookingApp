import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { CustomerPortalService } from './customer-portal.service';

@Injectable()
export class CustomerPortalAuthGuard implements CanActivate {
  constructor(private readonly customerPortalService: CustomerPortalService) {}

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request & { customerUser?: unknown }>();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Falta token de cliente.');
    }

    const token = authHeader.slice(7).trim();
    request.customerUser = this.customerPortalService.verifyCustomerAccessToken(token);
    return true;
  }
}
