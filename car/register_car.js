const express = require('express');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { body, validationResult } = require('express-validator');
const { db, storage } = require('../firebase');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

router.post(
  '/',
  upload.fields([
    { name: 'soatPhoto', maxCount: 1 },
    { name: 'carPhoto', maxCount: 1 }
  ]), 
  [
    body('plate').notEmpty().withMessage('Plate is required'),
    body('capacity').isNumeric().withMessage('Capacity must be numeric'),
    body('brand').notEmpty().withMessage('Brand is required'),
    body('model').notEmpty().withMessage('Model is required'),
  ],
  handleValidationErrors,
  async (req, res) => {
    const { plate, capacity, brand, model } = req.body;

    if (!req.files || !req.files.soatPhoto || !req.files.carPhoto) {
      return res.status(400).json({ message: 'soatPhoto and carPhoto are required' });
    }

    try {
      const token = req.cookies.token;
      if (!token) return res.status(403).json({ message: 'Not authorized' });

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const universityID = decoded.universityID;
      if (!universityID) {
        return res.status(400).json({ message: 'universityID is missing in the token' });
      }

      const existingCarSnapshot = await db.ref('cars').orderByChild('universityID').equalTo(universityID).once('value');
      if (existingCarSnapshot.exists()) {
        return res.status(400).json({ message: 'User can only have one car' });
      }

      const soatBlob = storage.file(`cars/soat/${universityID}-soat-${Date.now()}`);
      const carBlob = storage.file(`cars/car/${universityID}-car-${Date.now()}`);

      const soatStream = soatBlob.createWriteStream({
        metadata: { contentType: req.files.soatPhoto[0].mimetype },
      });
      const carStream = carBlob.createWriteStream({
        metadata: { contentType: req.files.carPhoto[0].mimetype },
      });

      soatStream.end(req.files.soatPhoto[0].buffer);
      carStream.end(req.files.carPhoto[0].buffer);

      const soatPhotoURL = `https://storage.googleapis.com/${storage.name}/${soatBlob.name}`;
      const carPhotoURL = `https://storage.googleapis.com/${storage.name}/${carBlob.name}`;

      const newCar = {
        plate,
        capacity,
        brand,
        model,
        universityID,
        soatPhotoURL,
        carPhotoURL
      };

      await db.ref('cars').push(newCar);
      res.status(201).json({ message: 'Car registered successfully' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Error registering car', error });
    }
  }
);

module.exports = router;
