import { Controller, Get, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@studyai/types';
import { AdminUsersQueryDto } from './dto/admin-users-query.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  async getUsers(@Query() query: AdminUsersQueryDto) {
    return this.adminService.getUsers(query);
  }

  @Patch('users/:id/status')
  async setUserActiveStatus(
    @Param('id') userId: string,
    @Body('isActive') isActive: boolean,
  ) {
    return this.adminService.setUserActiveStatus(userId, isActive);
  }

  @Patch('users/:id/role')
  async changeUserRole(
    @Param('id') userId: string,
    @Body('role') role: UserRole,
  ) {
    return this.adminService.changeUserRole(userId, role);
  }

  @Get('billing/stats')
  async getBillingStats() {
    return this.adminService.getBillingStats();
  }

  @Get('ai/stats')
  async getAiStats() {
    return this.adminService.getAiStats();
  }

  @Get('overview')
  async getOverview() {
    return this.adminService.getSystemOverviewStats();
  }

  @Get('retention')
  async getRetention() {
    return this.adminService.getRetentionCohortStats();
  }
}
