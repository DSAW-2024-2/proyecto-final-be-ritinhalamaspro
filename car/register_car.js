const express = require('express');
const jwt = require('jsonwebtoken');
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

// Registrar un vehículo
router.post(
  '/',
  [
    body('plate').notEmpty().withMessage('Plate is required'),
    body('capacity').isNumeric().withMessage('Capacity must be numeric'),
    body('brand').notEmpty().withMessage('Brand is required'),
    body('model').notEmpty().withMessage('Model is required'),
  ],
  handleValidationErrors,
  async (req, res) => {
    const { plate, capacity, brand, model } = req.body;

    try {
      // Recuperar JWT desde la cookie
      const token = req.cookies.token;
      if (!token) return res.status(403).json({ message: 'Not authorized' });

      // Decodificar el JWT y obtener el universityID
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      const universityID = decoded.universityID;
      if (!universityID) {
        return res.status(400).json({ message: 'universityID is missing in the token' });
      }

      // Verificar si la placa ya existe
      const snapshot = await db
        .ref('cars')
        .orderByChild('plate')
        .equalTo(plate)
        .once('value');

      if (snapshot.exists()) {
        return res.status(400).json({ message: 'Plate already exists' });
      }

      // Crear el nuevo vehículo
      const carsRef = db.ref('cars');
      const newCar = { plate, capacity, brand, model, universityID };

      await carsRef.push(newCar); // Guardar el nuevo vehículo en Firebase
      res.status(201).json({ message: 'Car registered successfully' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Error registering car', error });
    }
  }
);

module.exports = router;
