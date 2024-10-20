const express = require('express');
const router = express.Router();

// Logout del usuario: borrar la cookie del token
router.post('/', (req, res) => {
  res.clearCookie('token'); // Eliminar la cookie
  res.status(200).json({ message: 'Logged out successfully' });
});

module.exports = router;
