import { Body, Controller, Get, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BookingsService } from '../bookings/bookings.service';
import { CreateBookingDto } from '../bookings/dto/create-booking.dto';
import { PublicSlotsQueryDto } from './dto/public-slots-query.dto';
import { JoinWaitlistDto } from '../bookings/dto/join-waitlist.dto';

@Controller('public/:slug')
export class PublicBookingsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bookingsService: BookingsService
  ) {}

  @Get()
  async tenantProfile(@Param('slug') slug: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        logoUrl: true,
        primaryColor: true,
        timeZone: true,
        locale: true
      }
    });

    if (!tenant) {
      throw new NotFoundException('Negocio no encontrado.');
    }

    return tenant;
  }

  @Get('services')
  async services(@Param('slug') slug: string) {
    const tenant = await this.findTenantBySlug(slug);
    return this.prisma.service.findMany({
      where: {
        tenantId: tenant.id,
        active: true
      },
      orderBy: { createdAt: 'asc' }
    });
  }

  @Get('form')
  async bookingForm(@Param('slug') slug: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug },
      select: {
        id: true,
        bookingFormFields: true
      }
    });

    if (!tenant) {
      throw new NotFoundException('Negocio no encontrado.');
    }

    return {
      tenantId: tenant.id,
      fields: tenant.bookingFormFields ?? []
    };
  }

  @Get('staff')
  async staff(@Param('slug') slug: string) {
    const tenant = await this.findTenantBySlug(slug);
    return this.prisma.staff.findMany({
      where: {
        tenantId: tenant.id,
        active: true
      },
      orderBy: { createdAt: 'asc' }
    });
  }

  @Get('slots')
  async slots(@Param('slug') slug: string, @Query() query: PublicSlotsQueryDto) {
    const tenant = await this.findTenantBySlug(slug);
    return this.bookingsService.getPublicSlots(tenant.id, query);
  }

  @Post('bookings')
  async createBooking(@Param('slug') slug: string, @Body() body: CreateBookingDto) {
    const tenant = await this.findTenantBySlug(slug);
    return this.bookingsService.createForTenant(tenant.id, body, true);
  }

  @Post('waitlist')
  async joinWaitlist(@Param('slug') slug: string, @Body() body: JoinWaitlistDto) {
    const tenant = await this.findTenantBySlug(slug);
    return this.bookingsService.joinWaitlistForTenant(tenant.id, body);
  }

  private async findTenantBySlug(slug: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug },
      select: { id: true }
    });

    if (!tenant) {
      throw new NotFoundException('Negocio no encontrado.');
    }

    return tenant;
  }
}
