const { db } = require('../firebase'); // Configuración de Firebase
const authMiddleware = require('./authMiddleware');

// Middleware para verificar si el usuario tiene un carro registrado
const verifyUserHasCar = async (req, res, next) => {
  const userId = req.user.id; // Extraído del token JWT

  try {
    // Buscar carro asociado al usuario en Firebase usando su `userId`
    const carRef = db.collection('cars').where('userId', '==', userId);
    const carSnapshot = await carRef.get();

    if (carSnapshot.empty) {
      return res.status(403).json({ message: 'User must have a registered car to create trips' });
    }

    // Extraer datos del carro
    const carData = carSnapshot.docs[0].data(); // Obtenemos el primer carro encontrado
    req.carCapacity = carData.capacity; // Almacenar la capacidad del carro en el request

    next();
  } catch (error) {
    console.error('Error verifying user car:', error);
    res.status(500).json({ message: 'Error verifying user car', error });
  }
};

module.exports = verifyUserHasCar