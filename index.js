const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();
const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
app.use('/users', require('./user/users'));
app.use('/register', require('./user/register'));
app.use('/login', require('./user/login'));
app.use('/register_car', require('./car/register_car'))
app.use('/cars', require('./car/cars.js'))
app.use('/trips', require('./trip/trips.js'))

const PORT = process.env.PORT || 3000;

app.use((req, res) => {
  res.status(404).json({ message: 'Path not found' });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
