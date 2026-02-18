import { Injectable, Logger } from '@nestjs/common';
import sendgridMail from '@sendgrid/mail';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

type EmailPayload = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly sendGridApiKey = process.env.SENDGRID_API_KEY?.trim() ?? '';
  private readonly sendGridFromEmail = process.env.SENDGRID_FROM_EMAIL?.trim() ?? '';
  private readonly smtpHost = process.env.SMTP_HOST?.trim() ?? '';
  private readonly smtpPort = Number(process.env.SMTP_PORT ?? '587');
  private readonly smtpSecure = (process.env.SMTP_SECURE ?? 'false').toLowerCase() === 'true';
  private readonly smtpUser = process.env.SMTP_USER?.trim() ?? '';
  private readonly smtpPass = process.env.SMTP_PASS?.trim() ?? '';
  private readonly smtpFromEmail = process.env.SMTP_FROM_EMAIL?.trim() ?? '';
  private readonly businessNotificationEmail = process.env.NOTIFICATIONS_BUSINESS_EMAIL?.trim() ?? '';
  private smtpTransporter: Transporter | null = null;

  constructor() {
    if (this.sendGridApiKey) {
      sendgridMail.setApiKey(this.sendGridApiKey);
    }
  }

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
    const clientSubject = `Reserva confirmada - ${input.tenantName}`;
    const clientText = [
      `Hola ${input.customerName},`,
      '',
      `Tu reserva fue confirmada en ${input.tenantName}.`,
      `Servicio: ${input.serviceName}`,
      `Profesional: ${input.staffName}`,
      `Inicio: ${input.startAt.toISOString()}`,
      `Fin: ${input.endAt.toISOString()}`,
      '',
      `Gracias por reservar en ${input.tenantName}.`
    ].join('\n');
    const clientHtml = `<p>Hola ${input.customerName},</p><p>Tu reserva fue confirmada en <strong>${input.tenantName}</strong>.</p><ul><li><strong>Servicio:</strong> ${input.serviceName}</li><li><strong>Profesional:</strong> ${input.staffName}</li><li><strong>Inicio:</strong> ${input.startAt.toISOString()}</li><li><strong>Fin:</strong> ${input.endAt.toISOString()}</li></ul><p>Gracias por reservar en ${input.tenantName}.</p>`;

    await this.sendWithFallback({
      to: input.customerEmail,
      subject: clientSubject,
      text: clientText,
      html: clientHtml
    });

    if (this.businessNotificationEmail) {
      const businessSubject = `Nueva reserva - ${input.tenantName}`;
      const businessText = [
        `Se registró una nueva reserva en ${input.tenantName}.`,
        '',
        `Cliente: ${input.customerName}`,
        `Email cliente: ${input.customerEmail}`,
        `Servicio: ${input.serviceName}`,
        `Profesional: ${input.staffName}`,
        `Inicio: ${input.startAt.toISOString()}`,
        `Fin: ${input.endAt.toISOString()}`
      ].join('\n');
      const businessHtml = `<p>Se registró una nueva reserva en <strong>${input.tenantName}</strong>.</p><ul><li><strong>Cliente:</strong> ${input.customerName} (${input.customerEmail})</li><li><strong>Servicio:</strong> ${input.serviceName}</li><li><strong>Profesional:</strong> ${input.staffName}</li><li><strong>Inicio:</strong> ${input.startAt.toISOString()}</li><li><strong>Fin:</strong> ${input.endAt.toISOString()}</li></ul>`;

      await this.sendWithFallback({
        to: this.businessNotificationEmail,
        subject: businessSubject,
        text: businessText,
        html: businessHtml
      });
    }
  }

  async sendWaitlistSlotAvailableEmail(input: {
    tenantSlug: string;
    customerName: string;
    customerEmail: string;
    serviceName: string;
    staffName: string;
    preferredStartAt: Date;
  }) {
    const subject = `Se liberó un cupo - ${input.tenantSlug}`;
    const text = [
      `Hola ${input.customerName},`,
      '',
      `Se liberó un cupo para tu lista de espera.`,
      `Servicio: ${input.serviceName}`,
      `Profesional: ${input.staffName}`,
      `Horario sugerido: ${input.preferredStartAt.toISOString()}`
    ].join('\n');
    const html = `<p>Hola ${input.customerName},</p><p>Se liberó un cupo para tu lista de espera.</p><ul><li><strong>Servicio:</strong> ${input.serviceName}</li><li><strong>Profesional:</strong> ${input.staffName}</li><li><strong>Horario sugerido:</strong> ${input.preferredStartAt.toISOString()}</li></ul>`;

    await this.sendWithFallback({
      to: input.customerEmail,
      subject,
      text,
      html
    });
  }

  private async sendWithFallback(payload: EmailPayload) {
    if (!payload.to.trim()) {
      this.logger.warn('[EMAIL][SKIP] destinatario vacío');
      return;
    }

    try {
      await this.sendWithSendGrid(payload);
      this.logger.log(`[EMAIL][SENDGRID] to=${payload.to} subject="${payload.subject}"`);
      return;
    } catch (sendGridError) {
      const message = sendGridError instanceof Error ? sendGridError.message : String(sendGridError);
      this.logger.warn(`[EMAIL][SENDGRID_FAIL] to=${payload.to} reason=${message}`);
    }

    try {
      await this.sendWithNodemailer(payload);
      this.logger.log(`[EMAIL][NODEMAILER] to=${payload.to} subject="${payload.subject}"`);
    } catch (nodemailerError) {
      const message = nodemailerError instanceof Error ? nodemailerError.message : String(nodemailerError);
      if (message.includes('no configurado')) {
        this.logger.warn(`[EMAIL][NODEMAILER_SKIP] to=${payload.to} reason=${message}`);
      } else {
        this.logger.error(`[EMAIL][NODEMAILER_FAIL] to=${payload.to} reason=${message}`);
      }
    }
  }

  private async sendWithSendGrid(payload: EmailPayload) {
    if (!this.sendGridApiKey || !this.sendGridFromEmail) {
      throw new Error('SendGrid no configurado (falta SENDGRID_API_KEY o SENDGRID_FROM_EMAIL).');
    }

    await sendgridMail.send({
      to: payload.to,
      from: this.sendGridFromEmail,
      subject: payload.subject,
      text: payload.text,
      html: payload.html
    });
  }

  private async sendWithNodemailer(payload: EmailPayload) {
    const transporter = this.getSmtpTransporter();
    const from = this.smtpFromEmail || this.smtpUser;
    if (!from) {
      throw new Error('Nodemailer no configurado (falta SMTP_FROM_EMAIL o SMTP_USER).');
    }

    await transporter.sendMail({
      to: payload.to,
      from,
      subject: payload.subject,
      text: payload.text,
      html: payload.html
    });
  }

  private getSmtpTransporter() {
    if (this.smtpTransporter) {
      return this.smtpTransporter;
    }

    if (!this.smtpHost || !Number.isFinite(this.smtpPort)) {
      throw new Error('Nodemailer no configurado (falta SMTP_HOST o SMTP_PORT inválido).');
    }

    this.smtpTransporter = nodemailer.createTransport({
      host: this.smtpHost,
      port: this.smtpPort,
      secure: this.smtpSecure,
      auth: this.smtpUser && this.smtpPass ? { user: this.smtpUser, pass: this.smtpPass } : undefined
    });

    return this.smtpTransporter;
  }
}
