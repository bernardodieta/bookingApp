import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  async sendBookingCreatedEmails(input: {
    tenantName: string;
    tenantSlug: string;
    customerName: string;
    customerEmail: string;
    serviceName: string;
    staffName: string;
    startAt: Date;
    endAt: Date;
  }) {
    this.logger.log(
      `[EMAIL-STUB][CLIENT] to=${input.customerEmail} subject="Reserva confirmada" tenant=${input.tenantSlug} service=${input.serviceName} staff=${input.staffName} start=${input.startAt.toISOString()}`
    );

    this.logger.log(
      `[EMAIL-STUB][BUSINESS] tenant=${input.tenantSlug} subject="Nueva reserva" customer=${input.customerName} email=${input.customerEmail} service=${input.serviceName} start=${input.startAt.toISOString()}`
    );
  }

  async sendWaitlistSlotAvailableEmail(input: {
    tenantSlug: string;
    customerName: string;
    customerEmail: string;
    serviceName: string;
    staffName: string;
    preferredStartAt: Date;
  }) {
    this.logger.log(
      `[EMAIL-STUB][WAITLIST] tenant=${input.tenantSlug} to=${input.customerEmail} customer=${input.customerName} service=${input.serviceName} staff=${input.staffName} slot=${input.preferredStartAt.toISOString()}`
    );
  }
}
