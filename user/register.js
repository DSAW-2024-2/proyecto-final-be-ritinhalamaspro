const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const { db, storage } = require('../firebase'); 

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

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
      const userSnapshot = await usersRef.orderByChild('email').equalTo(email).once('value');

      if (userSnapshot.exists()) {
        return res.status(400).json({ message: 'User already exists' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      let photoURL = null;

      if (req.file) {
        const blob = storage.file(`users/${universityID}-${Date.now()}`);
        const blobStream = blob.createWriteStream({
          metadata: { contentType: req.file.mimetype },
        });

        blobStream.end(req.file.buffer);

        photoURL = `https://storage.googleapis.com/${storage.name}/${blob.name}`;
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
        { expiresIn: '1h' }
      );

      res.status(201).json({ message: 'User registered successfully', token });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Error registering user', error });
    }
  }
);

module.exports = router;