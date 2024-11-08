const express = require('express');
const { body, validationResult } = require('express-validator');
const { db } = require('../firebase');
const authMiddleware = require('../middlewares/authMiddleware');
const verifyUserHasCar = require('../middlewares/verifyUserHasCar');

const router = express.Router();

router.post(
  '/create',
  authMiddleware,
  verifyUserHasCar,
  [
    body('startPoint').notEmpty().withMessage('Start point is required'),
    body('endPoint').notEmpty().withMessage('End point is required'),
    body('sector').notEmpty().withMessage('Sector is required'),
    body('departureTime').notEmpty().withMessage('Departure time is required'),
    body('price').isNumeric().withMessage('Price must be a number'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { startPoint, endPoint, sector, departureTime, price } = req.body;
    const userId = req.user.id;

    try {
      const newTrip = {
        startPoint,
        endPoint,
        sector,
        departureTime,
        capacity: req.carCapacity, 
        price,
        userId,
        reservations: [],
      };

      const newTripRef = db.ref('trips').push();
      await newTripRef.set(newTrip);

      res.status(201).json({
        message: 'Trip created successfully',
        tripId: newTripRef.key,
        trip: newTrip,
      });
    } catch (error) {
      console.error('Error creating trip:', error);
      res.status(500).json({ message: 'Error creating trip', error });
    }
  }
);

router.get('/all', authMiddleware, async (req, res) => {
  try {
    const tripsSnapshot = await db.ref('trips').once('value');
    const tripsData = tripsSnapshot.val();

    if (!tripsData) {
      return res.status(404).json({ message: 'No trips found' });
    }

    const trips = Object.keys(tripsData).map((tripId) => ({
      tripId,
      ...tripsData[tripId],
    }));

    res.status(200).json({ trips });
  } catch (error) {
    console.error('Error fetching trips:', error);
    res.status(500).json({ message: 'Error fetching trips', error });
  }
});

router.post('/reserve', authMiddleware, async (req, res) => {
  const { tripId } = req.body;
  const userId = req.user.id;

  try {
    const tripRef = db.ref(`trips/${tripId}`);
    const tripSnapshot = await tripRef.once('value');
    const tripData = tripSnapshot.val();

    if (!tripData) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    if (tripData.capacity <= 0) {
      return res.status(400).json({ message: 'No more seats available' });
    }

    await tripRef.update({
      capacity: tripData.capacity - 1,
      reservations: [...(tripData.reservations || []), userId],
    });

    res.status(200).json({ message: 'Trip reserved successfully' });
  } catch (error) {
    console.error('Error reserving trip:', error);
    res.status(500).json({ message: 'Error reserving trip', error });
  }
});

router.delete('/cancel', authMiddleware, async (req, res) => {
  const { tripId } = req.body;
  const userId = req.user.id;

  try {
    const tripRef = db.ref(`trips/${tripId}`);
    const tripSnapshot = await tripRef.once('value');
    const tripData = tripSnapshot.val();

    if (!tripData) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    if (!tripData.reservations || !tripData.reservations.includes(userId)) {
      return res.status(400).json({ message: 'You have not reserved this trip' });
    }

    const updatedReservations = tripData.reservations.filter((id) => id !== userId);
    await tripRef.update({
      capacity: tripData.capacity + 1,
      reservations: updatedReservations,
    });

    res.status(200).json({ message: 'Reservation cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling reservation:', error);
    res.status(500).json({ message: 'Error cancelling reservation', error });
  }
});

router.get('/my-reservations', authMiddleware, async (req, res) => {
  const userId = req.user.id;

  try {
    const tripsSnapshot = await db.ref('trips').once('value');
    const tripsData = tripsSnapshot.val();

    if (!tripsData) {
      return res.status(404).json({ message: 'No trips found' });
    }

    const reservedTrips = Object.keys(tripsData)
      .filter((tripId) => tripsData[tripId].reservations?.includes(userId))
      .map((tripId) => ({
        tripId,
        ...tripsData[tripId],
      }));

    res.status(200).json({ reservedTrips });
  } catch (error) {
    console.error('Error fetching reserved trips:', error);
    res.status(500).json({ message: 'Error fetching reserved trips', error });
  }
});

module.exports = router;
