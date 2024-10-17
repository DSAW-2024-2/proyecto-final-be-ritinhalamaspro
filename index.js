const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser'); // Importar cookie-parser

dotenv.config();
const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(cookieParser()); // Usar cookie-parser

// Rutas
app.use('/users', require('./user/users'));
app.use('/register', require('./user/register'));
app.use('/login', require('./user/login'));
app.use('/logout', require('./user/logout')); // Nueva ruta de logout

const PORT = process.env.PORT || 3000;

app.use((req, res) => {
  res.status(404).json({ message: 'Path not found' });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
