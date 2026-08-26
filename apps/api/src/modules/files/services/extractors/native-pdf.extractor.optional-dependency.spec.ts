describe('NativePdfExtractor optional native dependency', () => {
  it('does not initialize a browser Worker or native Canvas during construction', () => {
    expect(() => {
      jest.isolateModules(() => {
        const { NativePdfExtractor } = require('./native-pdf.extractor');
        new NativePdfExtractor();
      });
    }).not.toThrow();
  });
});
