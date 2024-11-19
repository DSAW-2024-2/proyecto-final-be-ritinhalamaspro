const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const { db, storage } = require('../firebase');
const { getStorage } = require('firebase-admin/storage'); 

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
const bucket = getStorage().bucket(); 

router.post(
  '/',
  upload.single('photo'),
  [
    body('email').isEmail().withMessage('Invalid email format'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
    body('name').notEmpty().withMessage('Name is required'),
    body('surName').notEmpty().withMessage('Surname is required'),
    body('universityID').notEmpty().withMessage('University ID is required'),
    body('phoneNumber').notEmpty().isNumeric().withMessage('Phone number must be numeric'),
  ],
  async (req, res) => {
    const { name, surName, universityID, email, phoneNumber, password } = req.body;

    try {
      const usersRef = db.ref('users');

      const emailSnapshot = await usersRef.orderByChild('email').equalTo(email).once('value');
      if (emailSnapshot.exists()) {
        return res.status(400).json({ message: 'Email already exists' });
      }

      const universityIDSnapshot = await usersRef.orderByChild('universityID').equalTo(universityID).once('value');
      if (universityIDSnapshot.exists()) {
        return res.status(400).json({ message: 'University ID already exists' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      let photoURL = null;

      if (req.file) {
        const photoFilePath = `users/${universityID}-${Date.now()}`;
        const photoBlob = bucket.file(photoFilePath);

        await photoBlob.save(req.file.buffer, {
          metadata: { contentType: req.file.mimetype },
        });

        [photoURL] = await photoBlob.getSignedUrl({
          action: 'read',
          expires: '03-01-2500', 
        });
      }

      const newUser = {
        name,
        surName,
        universityID,
        email,
        phoneNumber,
        password: hashedPassword,
        photoURL,
      };

      const newUserRef = await usersRef.push(newUser);

      const token = jwt.sign(
        { id: newUserRef.key, universityID },
        process.env.JWT_SECRET,
        { expiresIn: '3h' }
      );

      res.status(201).json({ message: 'User registered successfully', token });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Error registering user', error });
    }
  }
);

module.exports = router;
