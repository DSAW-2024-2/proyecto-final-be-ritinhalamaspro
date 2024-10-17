const jwt = require('jsonwebtoken');

// Middleware para validar el token desde la cookie
function authenticateToken(req, res, next) {
  const token = req.cookies.token; // Leer token desde la cookie

  if (!token) {
    return res.status(403).json({ message: 'No token provided' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid token' });
    }
    req.user = user; // Guardar usuario en la request
    next();
  });
}

module.exports = authenticateToken;
