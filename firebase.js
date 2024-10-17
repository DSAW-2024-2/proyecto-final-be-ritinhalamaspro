var admin = require("firebase-admin");
var serviceAccount = require("./serviceAccountKey.json");

try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://web-project-c80a8-default-rtdb.firebaseio.com/"
  });
} catch (error) {
  console.error('Firebase initialization error:', error);
}

const db = admin.database();
module.exports = db;
