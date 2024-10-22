const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { db, storage } = require('../firebase');

const router = express.Router();

router.post('/', async (req, res) => {
  const { email, password } = req.body;

  try {
    const userRef = db.ref('users').orderByChild('email').equalTo(email);
    const snapshot = await userRef.once('value');

    if (!snapshot.exists()) {
      return res.status(400).json({ message: 'User not found' });
    }

    const userData = Object.values(snapshot.val())[0];
    const userKey = Object.keys(snapshot.val())[0];

    const isMatch = await bcrypt.compare(password, userData.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: userKey, universityID: userData.universityID },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      maxAge: 3600000, // 1 hora
      secure: process.env.NODE_ENV === 'production',
    });

    console.log('Cookie token:', token);

    res.status(200).json({ message: 'Login successful' });
  } catch (error) {
    res.status(500).json({ message: 'Error logging in', error });
  }
});

module.exports = router;
