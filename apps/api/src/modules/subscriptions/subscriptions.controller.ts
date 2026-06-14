import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateCheckoutDto } from './dto/create-checkout.dto';

@Controller('subscriptions')
@UseGuards(JwtAuthGuard)
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get('current')
  async getCurrentSubscription(@CurrentUser('sub') userId: string) {
    return this.subscriptionsService.getCurrentSubscription(userId);
  }

  @Post('checkout')
  async createCheckout(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateCheckoutDto,
  ) {
    return this.subscriptionsService.createCheckout(userId, dto.plan);
  }

  @Post('cancel')
  async cancelSubscription(@CurrentUser('sub') userId: string) {
    return this.subscriptionsService.cancelSubscription(userId);
  }

  @Post('resume')
  async resumeSubscription(@CurrentUser('sub') userId: string) {
    return this.subscriptionsService.resumeSubscription(userId);
  }

  @Post('portal')
  async createPortalSession(@CurrentUser('sub') userId: string) {
    return this.subscriptionsService.createPortalSession(userId);
  }
}
