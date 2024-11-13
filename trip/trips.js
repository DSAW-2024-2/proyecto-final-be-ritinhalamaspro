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
    body('capacity').isInt({ gt: 0 }).withMessage('Capacity must be a positive integer'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { startPoint, endPoint, sector, departureTime, price, date, capacity } = req.body;
    const userId = req.user.universityID;

    try {
      if (capacity > req.carCapacity) {
        return res.status(400).json({ message: `Capacity cannot exceed the car's capacity of ${req.carCapacity}` });
      }

      const newTrip = {
        startPoint,
        endPoint,
        sector,
        departureTime,
        capacity,
        availability: capacity,
        reservationsCount: 0,
        carPhoto: req.carPhoto,
        price,
        date,
        userId,
        state: 0, 
        pendingRequests: [],
        acceptedRequests: [],
        rejectedRequests: [],
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

router.put('/update-state', authMiddleware, async (req, res) => {
  const { tripId, newState } = req.body;
  const userId = req.user.universityID;

  try {
    const tripRef = db.ref(`trips/${tripId}`);
    const tripSnapshot = await tripRef.once('value');
    const tripData = tripSnapshot.val();

    if (!tripData) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    if (tripData.userId !== userId) {
      return res.status(403).json({ message: 'You are not authorized to change this trip state' });
    }

    await tripRef.update({ state: newState });

    res.status(200).json({ message: 'Trip state updated successfully' });
  } catch (error) {
    console.error('Error updating trip state:', error);
    res.status(500).json({ message: 'Error updating trip state', error });
  }
});


router.post('/reserve', authMiddleware, async (req, res) => {
  const { tripId, location } = req.body;
  const userId = req.user.universityID;

  try {
    const tripRef = db.ref(`trips/${tripId}`);
    const tripSnapshot = await tripRef.once('value');
    const tripData = tripSnapshot.val();

    if (!tripData) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    if (tripData.availability <= 0) {
      return res.status(400).json({ message: 'No more seats available' });
    }

    const newRequest = {
      userId,
      location,
    };

    await tripRef.update({
      pendingRequests: [...(tripData.pendingRequests || []), newRequest],
    });

    res.status(200).json({ message: 'Reservation request sent successfully', request: newRequest });
  } catch (error) {
    console.error('Error sending reservation request:', error);
    res.status(500).json({ message: 'Error sending reservation request', error });
  }
});

router.put('/manage-reservation', authMiddleware, async (req, res) => {
  const { tripId, userId, action } = req.body; // 'accept' o 'reject'
  const driverId = req.user.universityID;

  try {
    const tripRef = db.ref(`trips/${tripId}`);
    const tripSnapshot = await tripRef.once('value');
    const tripData = tripSnapshot.val();

    if (!tripData) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    if (tripData.userId !== driverId) {
      return res.status(403).json({ message: 'You are not authorized to manage reservations for this trip' });
    }

    const pendingRequests = tripData.pendingRequests || [];
    const requestIndex = pendingRequests.findIndex((request) => request.userId === userId);

    if (requestIndex === -1) {
      return res.status(404).json({ message: 'Reservation request not found' });
    }

    const [request] = pendingRequests.splice(requestIndex, 1);
    let updateFields = { pendingRequests };

    if (action === 'accept') {
      updateFields = {
        ...updateFields,
        acceptedRequests: [...(tripData.acceptedRequests || []), request],
        availability: tripData.availability - 1,
        reservationsCount: tripData.reservationsCount + 1,
      };
    } else if (action === 'reject') {
      updateFields = {
        ...updateFields,
        rejectedRequests: [...(tripData.rejectedRequests || []), request],
      };
    }

    await tripRef.update(updateFields);

    res.status(200).json({ message: `Reservation ${action}ed successfully` });
  } catch (error) {
    console.error('Error managing reservation:', error);
    res.status(500).json({ message: 'Error managing reservation', error });
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

router.delete('/delete-trip', authMiddleware, async (req, res) => {
  const userId = req.user.universityID;
  const { tripId } = req.body;

  try {
    const tripRef = db.ref(`trips/${tripId}`);
    const tripSnapshot = await tripRef.once('value');
    const tripData = tripSnapshot.val();

    if (!tripData) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    if (tripData.userId !== userId) {
      return res.status(403).json({ message: 'You are not authorized to delete this trip' });
    }

    await tripRef.remove();

    res.status(200).json({ message: 'Trip deleted successfully' });
  } catch (error) {
    console.error('Error deleting trip:', error);
    res.status(500).json({ message: 'Error deleting trip', error });
  }
});


router.get('/my-reservations', authMiddleware, async (req, res) => {
  const userId = req.user.universityID;

  try {
    const tripsSnapshot = await db.ref('trips').once('value');
    const tripsData = tripsSnapshot.val();

    if (!tripsData) {
      return res.status(404).json({ message: 'No trips found' });
    }

    const reservedTrips = Object.keys(tripsData)
      .filter((tripId) =>
        tripsData[tripId].reservations?.some((reservation) => reservation.userId === userId)
      )
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

router.get('/my-trips', authMiddleware, async (req, res) => {
  const userId = req.user.universityID;

  try {
    const tripsSnapshot = await db.ref('trips').once('value');
    const tripsData = tripsSnapshot.val();

    if (!tripsData) {
      return res.status(404).json({ message: 'No trips found' });
    }

    const myTrips = Object.keys(tripsData)
      .filter((tripId) => tripsData[tripId].userId === userId)
      .map((tripId) => ({
        tripId,
        ...tripsData[tripId],
      }));

    if (myTrips.length === 0) {
      return res.status(404).json({ message: 'You have not created any trips' });
    }

    res.status(200).json({ myTrips });
  } catch (error) {
    console.error('Error fetching user trips:', error);
    res.status(500).json({ message: 'Error fetching user trips', error });
  }
});



module.exports = router;
