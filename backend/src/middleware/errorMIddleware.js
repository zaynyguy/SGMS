function notFound(req, res, next) {
  res.status(404).json({ message: 'Not found' });
}

function errorHandler(err, req, res, next) {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ message: err.publicMessage || 'Internal server error.' });
}

module.exports = { notFound, errorHandler };
