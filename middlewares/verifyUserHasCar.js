const { db } = require('../firebase'); 

const verifyUserHasCar = async (req, res, next) => {
  const userId = req.user.id;
  try {
    const carRef = db.ref('cars').orderByChild('universityID').equalTo(req.user.universityID);
    const carSnapshot = await carRef.once('value');

    if (!carSnapshot.exists()) {
      return res.status(403).json({ message: 'User must have a registered car to create trips' });
    }

    const carData = Object.values(carSnapshot.val())[0]; 
    req.carCapacity = carData.capacity;
    req.carPhoto = carData.carPhotoURL

    next();
  } catch (error) {
    console.error('Error verifying user car:', error);
    res.status(500).json({ message: 'Error verifying user car', error });
  }
};

module.exports = verifyUserHasCar