const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../firebase');
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

// Registrar usuario con validaciones
router.post(
  '/',
  [
    body('email').isEmail().withMessage('Invalid email format'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long'),
    body('name').notEmpty().withMessage('Name is required'),
    body('surName').notEmpty().withMessage('Surname is required'),
    body('universityID').notEmpty().withMessage('University ID is required'),
    body('phoneNumber')
      .optional()
      .isNumeric()
      .withMessage('Phone number must be numeric'),
  ],
  handleValidationErrors,
  async (req, res) => {
    const { name, surName, universityID, email, phoneNumber, password } = req.body;

    try {
      // Verificar si el usuario ya existe por email
      const usersRef = db.ref('users');
      const userSnapshot = await usersRef
        .orderByChild('email')
        .equalTo(email)
        .once('value');

      if (userSnapshot.exists()) {
        return res.status(400).json({ message: 'User already exists' });
      }

      // Hashear la contraseña
      const hashedPassword = await bcrypt.hash(password, 10);

      // Crear nuevo usuario
      const newUser = {
        name,
        surName,
        universityID,
        email,
        phoneNumber,
        password: hashedPassword,
      };

      // Guardar el usuario en Firebase
      await usersRef.push(newUser);

      res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Error registering user', error });
    }
  }
);

module.exports = router;
