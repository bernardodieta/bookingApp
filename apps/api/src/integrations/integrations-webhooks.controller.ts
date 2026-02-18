import { Body, Controller, Headers, HttpCode, Post, Query } from '@nestjs/common';
import { IntegrationsService } from './integrations.service';

@Controller('integrations/calendar/webhooks')
export class IntegrationsWebhooksController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Post('google')
  @HttpCode(200)
  googleWebhook(@Body() body: Record<string, unknown>, @Headers('x-goog-channel-token') channelToken?: string) {
    return this.integrationsService.handleGoogleWebhook(body, channelToken);
  }

  @Post('microsoft')
  @HttpCode(200)
  microsoftWebhook(
    @Body() body: Record<string, unknown>,
    @Query('validationToken') validationToken?: string
  ) {
    if (validationToken) {
      return validationToken;
    }

    return this.integrationsService.handleMicrosoftWebhook(body);
  }
}
