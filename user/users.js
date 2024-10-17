const express = require('express');
const db = require('../firebase');
const authMiddleware = require('../middlewares/authMiddleware');
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');

const router = express.Router();

// Middleware para manejar errores de validación
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Obtener información del usuario logueado
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const userRef = db.ref(`users/${req.user.id}`);
    const snapshot = await userRef.once('value');

    if (!snapshot.exists()) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json(snapshot.val());
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user data', error });
  }
});

// Actualizar información del usuario logueado
router.put(
  '/me',
  authMiddleware,
  [
    body('password')
      .optional()
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long'),
    body('name').optional().notEmpty().withMessage('Name cannot be empty'),
    body('surName').optional().notEmpty().withMessage('Surname cannot be empty'),
    body('phoneNumber')
      .optional()
      .isNumeric()
      .withMessage('Phone number must be numeric'),
  ],
  handleValidationErrors,
  async (req, res) => {
    const { name, surName, phoneNumber, password } = req.body;

    try {
      const updatedData = { name, surName, phoneNumber };

      // Si se incluye una nueva contraseña, se hashea
      if (password) {
        updatedData.password = await bcrypt.hash(password, 10);
      }

      const userRef = db.ref(`users/${req.user.id}`);
      await userRef.update(updatedData);

      res.status(200).json({ message: 'User updated successfully' });
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({ message: 'Error updating user', error });
    }
  }
);

// Eliminar usuario logueado
router.delete('/me', authMiddleware, async (req, res) => {
  try {
    const userRef = db.ref(`users/${req.user.id}`);
    await userRef.remove();

    res.clearCookie('token'); // Eliminar la cookie del token
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting user', error });
  }
});

module.exports = router;
