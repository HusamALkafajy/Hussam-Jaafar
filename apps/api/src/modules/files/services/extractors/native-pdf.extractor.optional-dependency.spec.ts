describe('NativePdfExtractor optional native dependency', () => {
  afterEach(() => {
    jest.dontMock('canvas');
    jest.resetModules();
  });

  it('loads when the optional canvas native binding is unavailable', () => {
    jest.doMock(
      'canvas',
      () => {
        const error = new Error('Optional canvas native binding unavailable');
        Object.assign(error, { code: 'MODULE_NOT_FOUND' });
        throw error;
      },
      { virtual: true },
    );

    expect(() => {
      jest.isolateModules(() => {
        require('./native-pdf.extractor');
      });
    }).not.toThrow();
  });
});
