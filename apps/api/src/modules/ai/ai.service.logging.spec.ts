jest.mock('@studyai/database', () => ({
  db: {},
  explanations: {},
  eq: jest.fn(),
  and: jest.fn(),
}));

import { ConfigService } from '@nestjs/config';
import { AiService } from './ai.service';
import { StructuredLogger } from '../../common/logging/structured-logger';

describe('AiService logging', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = 'production';
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    jest.restoreAllMocks();
  });

  it('records structured parse diagnostics without emitting raw model output', () => {
    jest.spyOn(console, 'warn').mockImplementation();
    const output = jest.spyOn(console, 'error').mockImplementation();
    const config = {
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as ConfigService;
    const service = new AiService(config);
    (
      service as unknown as {
        logger: StructuredLogger;
      }
    ).logger = new StructuredLogger(true, AiService.name);
    const email = ['learner', '@example.com'].join('');
    const rawResponse = `invalid model output containing ${email} and private prompt contents`;

    expect(() =>
      (
        service as unknown as {
          sanitizeAndParseJson: (raw: string) => unknown;
        }
      ).sanitizeAndParseJson(rawResponse),
    ).toThrow('Explanation generation failed');

    expect(output).toHaveBeenCalledTimes(1);
    const serialized = output.mock.calls[0][0] as string;
    const entry = JSON.parse(serialized);
    expect(entry).toEqual(
      expect.objectContaining({
        level: 'error',
        source: 'AiService',
        message: 'AI response JSON parsing failed',
      }),
    );
    expect(entry.context[0]).toEqual(
      expect.objectContaining({
        name: 'SyntaxError',
        message: expect.any(String),
        stack: expect.any(String),
      }),
    );
    expect(entry.context[1]).toEqual({ responseLength: rawResponse.length });
    expect(serialized).not.toContain(rawResponse);
    expect(serialized).not.toContain(email);
    expect(serialized).not.toContain('private prompt contents');
  });
});
