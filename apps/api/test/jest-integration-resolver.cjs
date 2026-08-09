module.exports = (request, options) => {
  if (request === 'pdfjs-dist/legacy/build/pdf.mjs') {
    return require.resolve(request, { paths: [options.rootDir] });
  }

  return options.defaultResolver(request, options);
};
