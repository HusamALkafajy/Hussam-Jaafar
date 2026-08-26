import { PrismaClient } from '../prisma-client';
import { ILeasePolicy } from './policies';

export interface ILeaseManager {
  acquireLease(workerId: string): Promise<boolean>;
  renewLease(workerId: string): Promise<boolean>;
  releaseLease(workerId: string): Promise<void>;
  isLeaseExpired(workerId: string): Promise<boolean>;
}

export class PrismaLeaseManager implements ILeaseManager {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly leasePolicy: ILeasePolicy
  ) {}

  async acquireLease(workerId: string): Promise<boolean> {
    const expiration = new Date(Date.now() + this.leasePolicy.getLeaseDurationMs());
    try {
      await this.prisma.workerRuntime.update({
        where: { workerId },
        data: { leaseExpiration: expiration, status: 'PROCESSING' }
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  async renewLease(workerId: string): Promise<boolean> {
    const newExpiration = new Date(Date.now() + this.leasePolicy.getLeaseDurationMs());
    try {
      const result = await this.prisma.workerRuntime.update({
        where: { workerId },
        data: { 
          leaseExpiration: newExpiration, 
          lastHeartbeat: new Date()
        }
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  async releaseLease(workerId: string): Promise<void> {
    const pastExpiration = new Date(Date.now() - 1000);
    try {
      await this.prisma.workerRuntime.update({
        where: { workerId },
        data: { 
          leaseExpiration: pastExpiration,
          status: 'IDLE',
          currentJobId: null
        }
      });
    } catch (e) {}
  }

  async isLeaseExpired(workerId: string): Promise<boolean> {
    const worker = await this.prisma.workerRuntime.findUnique({
      where: { workerId }
    });
    if (!worker) return true;
    return worker.leaseExpiration.getTime() < Date.now();
  }
}
