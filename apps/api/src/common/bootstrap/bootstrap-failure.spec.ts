import { StructuredLogger } from '../logging/structured-logger';
import { reportBootstrapFailure } from './bootstrap-failure';

describe('reportBootstrapFailure', () => {
  it('logs the fatal error, sets a non-zero status, and guarantees termination', () => {
    const logger = {
      fatal: jest.fn(),
    } as unknown as StructuredLogger;
    const processLifecycle = {
      exitCode: undefined as number | undefined,
      exit: jest.fn() as unknown as NodeJS.Process['exit'],
    };
    const timer = {
      unref: jest.fn(),
    };
    const scheduleExit = jest.fn((callback: () => void) => {
      callback();
      return timer;
    });
    const error = new Error('Mandatory bootstrap dependency failed');

    reportBootstrapFailure(error, logger, processLifecycle, scheduleExit);

    expect(logger.fatal).toHaveBeenCalledWith('StudyAI API bootstrap failed', error);
    expect(processLifecycle.exitCode).toBe(1);
    expect(scheduleExit).toHaveBeenCalledWith(expect.any(Function), 100);
    expect(processLifecycle.exit).toHaveBeenCalledWith(1);
    expect(timer.unref).toHaveBeenCalled();
  });
});
