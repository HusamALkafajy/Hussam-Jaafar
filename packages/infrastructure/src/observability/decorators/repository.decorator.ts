import { ILogger, IMetrics, ITracer } from '../contracts';
import { IRepository } from '../../repositories/repository.interface';

export class ObservedRepository<T extends { id?: string }> implements IRepository<T> {
  constructor(
    private readonly inner: IRepository<T>,
    private readonly repositoryName: string,
    private readonly logger: ILogger,
    private readonly metrics: IMetrics,
    private readonly tracer: ITracer
  ) {}

  async save(aggregate: T): Promise<void> {
    const span = this.tracer.startSpan(`${this.repositoryName}.save`, {
      attributes: { 'aggregate.id': aggregate.id }
    });

    return this.tracer.withSpan(span, async () => {
      const startTime = Date.now();
      try {
        await this.inner.save(aggregate);
        const duration = Date.now() - startTime;
        
        this.metrics.recordTimer('repository.save.duration', duration, { repository: this.repositoryName });
        this.logger.debug(`Aggregate saved successfully`, 'repository.save', { aggregateId: aggregate.id, durationMs: duration });
      } catch (error) {
        this.metrics.incrementCounter('repository.save.error', 1, { repository: this.repositoryName });
        this.logger.error(`Failed to save aggregate`, error as Error, 'repository.save', { aggregateId: aggregate.id });
        throw error;
      }
    });
  }

  async findById(id: string): Promise<T | null> {
    const span = this.tracer.startSpan(`${this.repositoryName}.findById`, {
      attributes: { 'aggregate.id': id }
    });

    return this.tracer.withSpan(span, async () => {
      const startTime = Date.now();
      try {
        const result = await this.inner.findById(id);
        const duration = Date.now() - startTime;
        
        this.metrics.recordTimer('repository.find.duration', duration, { repository: this.repositoryName });
        if (!result) {
          this.metrics.incrementCounter('repository.find.miss', 1, { repository: this.repositoryName });
        }
        return result;
      } catch (error) {
        this.metrics.incrementCounter('repository.find.error', 1, { repository: this.repositoryName });
        this.logger.error(`Failed to find aggregate`, error as Error, 'repository.find', { aggregateId: id });
        throw error;
      }
    });
  }

  async findAll(): Promise<T[]> {
    const span = this.tracer.startSpan(`${this.repositoryName}.findAll`);

    return this.tracer.withSpan(span, async () => {
      const startTime = Date.now();
      try {
        const results = await this.inner.findAll();
        const duration = Date.now() - startTime;
        
        this.metrics.recordTimer('repository.findAll.duration', duration, { repository: this.repositoryName });
        return results;
      } catch (error) {
        this.metrics.incrementCounter('repository.findAll.error', 1, { repository: this.repositoryName });
        this.logger.error(`Failed to findAll aggregates`, error as Error, 'repository.findAll');
        throw error;
      }
    });
  }

  async delete(id: string): Promise<void> {
    const span = this.tracer.startSpan(`${this.repositoryName}.delete`, {
      attributes: { 'aggregate.id': id }
    });

    return this.tracer.withSpan(span, async () => {
      const startTime = Date.now();
      try {
        await this.inner.delete(id);
        const duration = Date.now() - startTime;
        
        this.metrics.recordTimer('repository.delete.duration', duration, { repository: this.repositoryName });
      } catch (error) {
        this.metrics.incrementCounter('repository.delete.error', 1, { repository: this.repositoryName });
        this.logger.error(`Failed to delete aggregate`, error as Error, 'repository.delete', { aggregateId: id });
        throw error;
      }
    });
  }
}
