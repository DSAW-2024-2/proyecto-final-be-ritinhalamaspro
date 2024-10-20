var admin = require("firebase-admin");
var serviceAccount = require("./serviceAccountKey.json");

try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL
  });
} catch (error) {
  console.error('Firebase initialization error:', error);
}

const db = admin.database();
module.exports = db;
