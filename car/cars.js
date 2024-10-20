const express = require('express');
const db = require('../firebase');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

// Obtener los vehículos del usuario logueado
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const carsRef = db.ref('cars').orderByChild('universityID').equalTo(req.user.universityID);
    const snapshot = await carsRef.once('value');

    if (!snapshot.exists()) {
      return res.status(404).json({ message: 'No cars found for this user' });
    }

    res.status(200).json(snapshot.val());
  } catch (error) {
    res.status(500).json({ message: 'Error fetching cars', error });
  }
});

// Eliminar un vehículo asociado al usuario logueado
router.delete('/me', authMiddleware, async (req, res) => {
  try {
    const carsRef = db.ref('cars').orderByChild('universityID').equalTo(req.user.universityID);
    const snapshot = await carsRef.once('value');

    if (!snapshot.exists()) {
      return res.status(404).json({ message: 'No car to delete' });
    }

    const deletePromises = [];
    snapshot.forEach((child) => deletePromises.push(db.ref(`cars/${child.key}`).remove()));
    await Promise.all(deletePromises);

    res.status(200).json({ message: 'Car deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting car', error });
  }
});

module.exports = router;
