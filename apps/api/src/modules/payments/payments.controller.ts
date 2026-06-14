import { Controller, Get, Post, Req, Headers, UseGuards, RawBodyRequest } from '@nestjs/common';
import { Request } from 'express';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

@Controller()
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('payments/history')
  async getPaymentHistory(@CurrentUser('sub') userId: string) {
    return this.paymentsService.getPaymentHistory(userId);
  }

  @Public()
  @Post('webhooks/stripe')
  async handleStripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    const rawBody = req.body as Buffer;
    return this.paymentsService.handleWebhook(rawBody, signature);
  }
}
