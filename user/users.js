const express = require('express');
const { db, storage } = require('../firebase');
const authMiddleware = require('../middlewares/authMiddleware');
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');
const multer = require('multer');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const userRef = db.ref(`users/${req.user.id}`);
    const snapshot = await userRef.once('value');

    if (!snapshot.exists()) {
      return res.status(404).json({ message: 'User not found' });
    }

    const userData = snapshot.val();
    
    delete userData.password;

    res.status(200).json(userData); 
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user data', error });
  }
});


// Actualizar datos del usuario
router.put(
  '/me',
  authMiddleware,
  upload.single('photo'), 
  [
    body('password').optional().isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
    body('name').optional().notEmpty().withMessage('Name cannot be empty'),
    body('surName').optional().notEmpty().withMessage('Surname cannot be empty'),
    body('phoneNumber').optional().isNumeric().withMessage('Phone number must be numeric'),
  ],
  handleValidationErrors,
  async (req, res) => {
    const { name, surName, phoneNumber, password } = req.body;

    try {
      const updatedData = { name, surName, phoneNumber };
      const userRef = db.ref(`users/${req.user.id}`);

      if (password) {
        updatedData.password = await bcrypt.hash(password, 10);
      }

      const snapshot = await userRef.once('value');
      const userData = snapshot.val();

      if (req.file) {
        if (userData.photoURL) {
          const oldFileName = userData.photoURL.split('/').pop();
          const oldFile = storage.file(`users/${oldFileName}`);
          await oldFile.delete(); 
        }

        const newBlob = storage.file(`users/${req.user.universityID}-${Date.now()}`);
        const newBlobStream = newBlob.createWriteStream({
          metadata: { contentType: req.file.mimetype },
        });

        newBlobStream.end(req.file.buffer);

        updatedData.photoURL = `https://storage.googleapis.com/${storage.name}/${newBlob.name}`;
      }

      await userRef.update(updatedData);
      res.status(200).json({ message: 'User updated successfully' });
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({ message: 'Error updating user', error });
    }
  }
);

// Eliminar usuario
router.delete('/me', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const userRef = db.ref(`users/${userId}`);
    const userSnapshot = await userRef.once('value');
    let userData;

    if (userSnapshot.exists()) {
      userData = userSnapshot.val();
      if (userData.photoURL) {
        const fileName = userData.photoURL.split('/').pop();
        const file = storage.file(`users/${fileName}`);

        await file.delete();
      }
    }

    const carRef = db.ref('cars').orderByChild('universityID').equalTo(userData.universityID);
    const carSnapshot = await carRef.once('value');

    if (carSnapshot.exists()) {
      carSnapshot.forEach(async (child) => {
        const carData = child.val();
        
        if (carData.soatPhotoURL) {
          const soatFileName = carData.soatPhotoURL.split('/').pop();
          const soatFile = storage.file(`cars/soat/${soatFileName}`);
          await soatFile.delete().catch(error => {
            console.error(`Error deleting SOAT photo: ${error}`);
          });
        }

        if (carData.carPhotoURL) {
          const carFileName = carData.carPhotoURL.split('/').pop();
          const carFile = storage.file(`cars/car/${carFileName}`);
          await carFile.delete().catch(error => {
            console.error(`Error deleting car photo: ${error}`);
          });
        }

        await db.ref(`cars/${child.key}`).remove();
      });
    }

    await userRef.remove();

    res.status(200).json({ message: 'User and associated data deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Error deleting user', error });
  }
});

module.exports = router;
