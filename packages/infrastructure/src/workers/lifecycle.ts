import { IWorkerRegistry } from './registry';
import { ILeaseManager } from './lease';
import { IWorker } from '../queues/contracts';
import { PrismaClient } from '../prisma-client';

export interface IWorkerRuntimeEngine {
  start(): Promise<void>;
  stop(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
}

export class WorkerRuntimeEngine implements IWorkerRuntimeEngine {
  private isRunning = false;
  private heartbeatTimer?: NodeJS.Timeout;

  constructor(
    private readonly workerId: string,
    private readonly workerName: string,
    private readonly registry: IWorkerRegistry,
    private readonly leaseManager: ILeaseManager,
    private readonly queueAdapter: IWorker,
    private readonly prisma: PrismaClient
  ) {}

  async start(): Promise<void> {
    const capabilities = this.registry.getCapabilities(this.workerName);
    if (!capabilities) {
      throw new Error(`Worker ${this.workerName} is not registered in the registry`);
    }

    // 1. Register Runtime in Postgres
    await this.prisma.workerRuntime.upsert({
      where: { workerId: this.workerId },
      create: {
        workerId: this.workerId,
        workerName: this.workerName,
        status: 'IDLE',
        capabilities: capabilities as any,
        leaseExpiration: new Date(Date.now() - 1000), // Initially expired, renewed on job
        version: '1.0.0'
      },
      update: {
        status: 'IDLE',
        startedAt: new Date()
      }
    });

    this.isRunning = true;

    // 2. Start the Queue Execution Adapter
    await this.queueAdapter.start();

    // 3. Start Heartbeat Loop
    this.startHeartbeatLoop();
  }

  private startHeartbeatLoop() {
    this.heartbeatTimer = setInterval(async () => {
      if (!this.isRunning) return;
      try {
        await this.prisma.workerRuntime.update({
          where: { workerId: this.workerId },
          data: { lastHeartbeat: new Date() }
        });
        
        // If we have an active job lease, renew it
        const workerInfo = await this.prisma.workerRuntime.findUnique({
          where: { workerId: this.workerId }
        });
        
        if (workerInfo?.currentJobId && workerInfo.status === 'PROCESSING') {
          await this.leaseManager.renewLease(this.workerId);
        }
      } catch (err) {
        // Silently ignore if DB fails, lease will eventually expire if network partition
      }
    }, 10000); // 10s based on DefaultHeartbeatPolicy
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    
    await this.prisma.workerRuntime.update({
      where: { workerId: this.workerId },
      data: { status: 'DRAINING' }
    });

    await this.queueAdapter.stop();

    await this.prisma.workerRuntime.update({
      where: { workerId: this.workerId },
      data: { status: 'STOPPED' }
    });
  }

  async pause(): Promise<void> {
    await this.prisma.workerRuntime.update({
      where: { workerId: this.workerId },
      data: { status: 'PAUSED' }
    });
    // For BullMQ this implies stopping the queue adapter reading
    await this.queueAdapter.stop();
  }

  async resume(): Promise<void> {
    await this.prisma.workerRuntime.update({
      where: { workerId: this.workerId },
      data: { status: 'IDLE' }
    });
    await this.queueAdapter.start();
  }
}
