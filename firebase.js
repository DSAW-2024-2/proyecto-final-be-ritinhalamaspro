var admin = require("firebase-admin");
var serviceAccount = require("./serviceAccountKey.json");

try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET, 
  });
} catch (error) {
  console.error('Firebase initialization error:', error);
}

const db = admin.database();
const storage = admin.storage().bucket(); 

module.exports = { db, storage };
