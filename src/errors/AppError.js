class AppError extends Error {
  // `detalle` viaja junto al mensaje en la respuesta JSON, para los casos en
  // que el cliente necesita más que un texto (p. ej. las sedes donde ya está
  // registrado un DNI, para preguntar si es apoyo o traslado).
  constructor(message, statusCode = 500, detalle = null) {
    super(message);
    this.statusCode = statusCode;
    this.isAppError = true;
    this.detalle = detalle;
  }
}

module.exports = AppError;
