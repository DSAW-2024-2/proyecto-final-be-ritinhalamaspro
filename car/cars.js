const express = require('express');
const { db, storage } = require('../firebase');
const jwt = require('jsonwebtoken');  // Necesario para decodificar el token

const router = express.Router();

// Middleware para autenticar el JWT y extraer el universityID
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(403).json({ message: 'Not authorized' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { universityID: decoded.universityID };  // Extrae el universityID
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const carsRef = db.ref('cars').orderByChild('universityID').equalTo(req.user.universityID);
    const snapshot = await carsRef.once('value');

    if (!snapshot.exists()) {
      return res.status(404).json({ message: 'No car found for this user' });
    }

    res.status(200).json(snapshot.val());
  } catch (error) {
    res.status(500).json({ message: 'Error fetching car', error });
  }
});

router.delete('/me', authMiddleware, async (req, res) => {
  try {
    const carsRef = db.ref('cars').orderByChild('universityID').equalTo(req.user.universityID);
    const snapshot = await carsRef.once('value');

    if (!snapshot.exists()) {
      return res.status(404).json({ message: 'No car to delete' });
    }

    const deletePromises = [];
    snapshot.forEach((child) => {
      const carData = child.val();

      // Eliminar foto SOAT si existe
      if (carData.soatPhotoURL) {
        // Extraemos la ruta del archivo desde la URL completa
        const soatFilePath = carData.soatPhotoURL.split('storage.googleapis.com/')[1]?.split('?')[0];
        if (soatFilePath) {
          console.log("SOAT file path:", soatFilePath);  // Para depuración
          const soatFile = storage.file(soatFilePath);  // Usamos solo la ruta relativa
          deletePromises.push(
            soatFile.delete().catch((error) => {
              console.error(`Error deleting SOAT photo: ${error}`);
              if (error.code === 404) {
                console.log(`SOAT photo not found, skipping deletion.`);
              } else {
                throw error;
              }
            })
          );
        }
      }

      // Eliminar foto de carro si existe
      if (carData.carPhotoURL) {
        // Extraemos la ruta del archivo desde la URL completa
        const carFilePath = carData.carPhotoURL.split('storage.googleapis.com/')[1]?.split('?')[0];
        if (carFilePath) {
          console.log("Car file path:", carFilePath);  // Para depuración
          const carFile = storage.file(carFilePath);  // Usamos solo la ruta relativa
          deletePromises.push(
            carFile.delete().catch((error) => {
              console.error(`Error deleting car photo: ${error}`);
              if (error.code === 404) {
                console.log(`Car photo not found, skipping deletion.`);
              } else {
                throw error;
              }
            })
          );
        }
      }

      // Eliminar el dato del carro en la base de datos
      deletePromises.push(db.ref(`cars/${child.key}`).remove());
    });

    await Promise.all(deletePromises);
    res.status(200).json({ message: 'Car and associated data deleted successfully' });
  } catch (error) {
    console.error('Error deleting car:', error);
    res.status(500).json({ message: 'Error deleting car', error });
  }
});

module.exports = router;
