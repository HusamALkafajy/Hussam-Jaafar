import { StructuredLogger } from '../logging/structured-logger';

const FATAL_EXIT_GRACE_MS = 100;

type ProcessLifecycle = Pick<NodeJS.Process, 'exit' | 'exitCode'>;
type ExitTimer = Pick<NodeJS.Timeout, 'unref'>;
type ScheduleExit = (callback: () => void, delay: number) => ExitTimer;

export function reportBootstrapFailure(
  error: unknown,
  logger: StructuredLogger,
  processLifecycle: ProcessLifecycle = process,
  scheduleExit: ScheduleExit = setTimeout,
): void {
  logger.fatal('StudyAI API bootstrap failed', error);
  processLifecycle.exitCode = 1;

  // Give redirected stderr a chance to flush, while guaranteeing that partially
  // constructed infrastructure clients cannot keep a failed process alive.
  const timer = scheduleExit(() => processLifecycle.exit(1), FATAL_EXIT_GRACE_MS);
  timer.unref();
}
