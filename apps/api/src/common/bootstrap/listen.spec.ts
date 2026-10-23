import { listenApi } from './listen';

describe('API listen boundary', () => {
  it('preserves the one-argument listen call when no host is configured', async () => {
    const listen = jest.fn().mockResolvedValue(undefined);
    await listenApi({ listen }, 4000);
    expect(listen).toHaveBeenCalledTimes(1);
    expect(listen).toHaveBeenCalledWith(4000);
    expect(listen.mock.calls[0]).toHaveLength(1);
  });

  it.each(['127.0.0.1', '::1', '0.0.0.0', 'studyai-api'])('passes the configured host %s explicitly', async (host) => {
    const listen = jest.fn().mockResolvedValue(undefined);
    await listenApi({ listen }, 43181, host);
    expect(listen).toHaveBeenCalledTimes(1);
    expect(listen).toHaveBeenCalledWith(43181, host);
  });

  it('propagates a failed bind rather than reporting readiness', async () => {
    const error = new Error('EADDRINUSE');
    const listen = jest.fn().mockRejectedValue(error);
    await expect(listenApi({ listen }, 43181, '127.0.0.1')).rejects.toBe(error);
  });
});
