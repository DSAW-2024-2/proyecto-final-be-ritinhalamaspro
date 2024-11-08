const express = require('express');
const { db } = require('../firebase');
const authMiddleware = require('../middlewares/authMiddleware');
const verifyUserHasCar = require('../middlewares/verifyUserHasCar')

const router = express.Router();

// Crear un viaje
router.post('/create', authMiddleware, verifyUserHasCar, async (req, res) => {
  const { startPoint, endPoint, sector, departureTime, price } = req.body;

  // Validar campos requeridos
  if (!startPoint || !endPoint || !sector || !departureTime || !price) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const tripData = {
      startPoint,
      endPoint,
      sector,
      departureTime,
      capacity: req.carCapacity, // Capacidad obtenida del middleware
      price
    };

    // Guardar el viaje en la base de datos
    const newTripRef = db.collection('trips').add(tripData);

    res.status(201).json({ message: 'Trip created successfully', tripId: (await newTripRef).id });
  } catch (error) {
    console.error('Error creating trip:', error);
    res.status(500).json({ message: 'Error creating trip', error });
  }
});

module.exports = router;
