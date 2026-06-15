import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CertificationsService } from './certifications.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('certifications')
export class CertificationsController {
  constructor(private readonly certificationsService: CertificationsService) {}

  @Get('verify/:hash')
  async verifyCertificate(@Param('hash') hash: string) {
    return this.certificationsService.verifyCertificate(hash);
  }

  @Get('user')
  @UseGuards(JwtAuthGuard)
  async getUserCertificates(@CurrentUser('sub') userId: string) {
    return this.certificationsService.getUserCertificates(userId);
  }
}
