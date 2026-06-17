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

  // ── User management ─────────────────────────────────────────────────────

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

  // ── Dashboard stats ──────────────────────────────────────────────────────

  /**
   * GET /api/admin/stats
   * Primary admin dashboard stats endpoint — matches the api.ts contract.
   * Returns: totalUsers, activeUsers, mrr, totalRevenue, aiCallsToday, …
   */
  @Get('stats')
  async getStats() {
    return this.adminService.getSystemOverviewStats();
  }

  /** Legacy alias kept for backwards compatibility */
  @Get('overview')
  async getOverview() {
    return this.adminService.getSystemOverviewStats();
  }

  // ── Activity logs ────────────────────────────────────────────────────────

  /**
   * GET /api/admin/activity-logs
   * Returns paginated system-wide activity logs — matches the api.ts contract.
   */
  @Get('activity-logs')
  async getActivityLogs(
    @Query('limit') limit?: string,
    @Query('page') page?: string,
    @Query('userId') userId?: string,
  ) {
    return this.adminService.getActivityLogs(
      limit ? parseInt(limit, 10) : 50,
      page ? parseInt(page, 10) : 1,
      userId,
    );
  }

  // ── Billing ──────────────────────────────────────────────────────────────

  @Get('payments')
  async getPayments() {
    return this.adminService.getBillingStats();
  }

  /** Legacy alias */
  @Get('billing/stats')
  async getBillingStats() {
    return this.adminService.getBillingStats();
  }

  // ── AI Usage ─────────────────────────────────────────────────────────────

  /**
   * GET /api/admin/ai-usage/stats
   * Matches the api.ts contract exactly.
   */
  @Get('ai-usage/stats')
  async getAiUsageStats() {
    return this.adminService.getAiStats();
  }

  /** Legacy alias */
  @Get('ai/stats')
  async getAiStats() {
    return this.adminService.getAiStats();
  }

  // ── Retention ────────────────────────────────────────────────────────────

  @Get('retention')
  async getRetention() {
    return this.adminService.getRetentionCohortStats();
  }
}
