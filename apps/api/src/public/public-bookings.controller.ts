import { Body, Controller, Get, Header, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BookingsService } from '../bookings/bookings.service';
import { CreateBookingDto } from '../bookings/dto/create-booking.dto';
import { PublicSlotsQueryDto } from './dto/public-slots-query.dto';
import { JoinWaitlistDto } from '../bookings/dto/join-waitlist.dto';

@Controller('public/:slugOrDomain')
export class PublicBookingsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bookingsService: BookingsService
  ) {}

  @Get()
  async tenantProfile(@Param('slugOrDomain') slugOrDomain: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ slug: slugOrDomain }, { customDomain: slugOrDomain.toLowerCase() }]
      },
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        logoUrl: true,
        primaryColor: true,
        customDomain: true,
        widgetEnabled: true,
        timeZone: true,
        locale: true
      }
    });

    if (!tenant) {
      throw new NotFoundException('Negocio no encontrado.');
    }

    return tenant;
  }

  @Get('widget-config')
  async widgetConfig(@Param('slugOrDomain') slugOrDomain: string) {
    const tenant = await this.findTenantBySlugOrDomain(slugOrDomain);
    const bookingUrl = this.getBookingUrl(tenant);
    const popupScriptSnippet = `<button id="apoint-book-btn" type="button">Reservar cita</button>\n<script>\n(function(){\n  var btn=document.getElementById('apoint-book-btn');\n  if(!btn)return;\n  btn.addEventListener('click',function(){\n    var width=480,height=780,left=(window.screen.width-width)/2,top=(window.screen.height-height)/2;\n    window.open('${bookingUrl}','apointBooking','width='+width+',height='+height+',left='+left+',top='+top+',menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes');\n  });\n})();\n<\/script>`;

    return {
      tenantName: tenant.name,
      slug: tenant.slug,
      customDomain: tenant.customDomain,
      widgetEnabled: tenant.widgetEnabled,
      bookingUrl,
      iframeSnippet: `<iframe src="${bookingUrl}" width="100%" height="780" style="border:0;border-radius:12px;overflow:hidden;" loading="lazy"></iframe>`,
      popupSnippet:
        `<a href="${bookingUrl}" target="_blank" rel="noopener noreferrer">Reservar cita</a>`,
      popupScriptSnippet
    };
  }

  @Get('widget.js')
  @Header('Content-Type', 'application/javascript; charset=utf-8')
  async widgetScript(@Param('slugOrDomain') slugOrDomain: string) {
    const tenant = await this.findTenantBySlugOrDomain(slugOrDomain);

    if (!tenant.widgetEnabled) {
      throw new NotFoundException('Widget deshabilitado para este tenant.');
    }

    const bookingUrl = this.getBookingUrl(tenant);
    const escapedBookingUrl = JSON.stringify(bookingUrl);

    return `(() => {
  const bookingUrl = ${escapedBookingUrl};

  function openBooking() {
    const width = 480;
    const height = 780;
    const left = Math.max(0, (window.screen.width - width) / 2);
    const top = Math.max(0, (window.screen.height - height) / 2);
    window.open(
      bookingUrl,
      'apointBooking',
      'width=' + width + ',height=' + height + ',left=' + left + ',top=' + top + ',menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes'
    );
  }

  const selectors = ['[data-apoint-book]', '[data-apoint-booking]'];
  const targets = selectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)));

  if (targets.length === 0) {
    return;
  }

  targets.forEach((element) => {
    element.addEventListener('click', (event) => {
      event.preventDefault();
      openBooking();
    });
  });
})();`;
  }

  @Get('services')
  async services(@Param('slugOrDomain') slugOrDomain: string) {
    const tenant = await this.findTenantBySlugOrDomain(slugOrDomain);
    return this.prisma.service.findMany({
      where: {
        tenantId: tenant.id,
        active: true
      },
      orderBy: { createdAt: 'asc' }
    });
  }

  @Get('form')
  async bookingForm(@Param('slugOrDomain') slugOrDomain: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ slug: slugOrDomain }, { customDomain: slugOrDomain.toLowerCase() }]
      },
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
  async staff(@Param('slugOrDomain') slugOrDomain: string) {
    const tenant = await this.findTenantBySlugOrDomain(slugOrDomain);
    return this.prisma.staff.findMany({
      where: {
        tenantId: tenant.id,
        active: true
      },
      orderBy: { createdAt: 'asc' }
    });
  }

  @Get('slots')
  async slots(@Param('slugOrDomain') slugOrDomain: string, @Query() query: PublicSlotsQueryDto) {
    const tenant = await this.findTenantBySlugOrDomain(slugOrDomain);
    return this.bookingsService.getPublicSlots(tenant.id, query);
  }

  @Post('bookings')
  async createBooking(@Param('slugOrDomain') slugOrDomain: string, @Body() body: CreateBookingDto) {
    const tenant = await this.findTenantBySlugOrDomain(slugOrDomain);
    return this.bookingsService.createForTenant(tenant.id, body, true);
  }

  @Post('waitlist')
  async joinWaitlist(@Param('slugOrDomain') slugOrDomain: string, @Body() body: JoinWaitlistDto) {
    const tenant = await this.findTenantBySlugOrDomain(slugOrDomain);
    return this.bookingsService.joinWaitlistForTenant(tenant.id, body);
  }

  private async findTenantBySlugOrDomain(slugOrDomain: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ slug: slugOrDomain }, { customDomain: slugOrDomain.toLowerCase() }]
      },
      select: { id: true, name: true, slug: true, customDomain: true, widgetEnabled: true }
    });

    if (!tenant) {
      throw new NotFoundException('Negocio no encontrado.');
    }

    return tenant;
  }

  private getWebAppBaseUrl() {
    const raw = process.env.NEXT_PUBLIC_APP_URL ?? process.env.WEB_APP_URL ?? 'http://localhost:3000';
    return raw.replace(/\/+$/, '');
  }

  private getBookingUrl(tenant: { slug: string; customDomain: string | null }) {
    if (tenant.customDomain) {
      const protocol = tenant.customDomain.startsWith('localhost') ? 'http' : 'https';
      return `${protocol}://${tenant.customDomain}`;
    }

    const webBaseUrl = this.getWebAppBaseUrl();
    return `${webBaseUrl}/public/${tenant.slug}`;
  }
}
