require('dotenv').config(); // Load environment variables

const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const session = require('express-session');
const MongoStore = require('connect-mongo'); // For session storage
const bcrypt = require('bcryptjs'); // Use bcryptjs for hashing
const path = require('path');
const helmet = require('helmet'); // Security middleware

const app = express();

// Middleware
app.use(helmet()); // Secure HTTP headers
app.use(bodyParser.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'your_secret_key',
  resave: false,
  saveUninitialized: true,
  store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('MongoDB Connection Failed:', err.message);
    process.exit(1);
  });

// Define a schema
const dataSchema = new mongoose.Schema({
  voltage: String,
  feeder: String,
  year: String,
  MW: Number,
  date: Date, // Changed to Date type for proper querying
  time: String
});

// Store models in a map
const models = {};

// Function to get or create a model
const formatCollectionName = (feeder, year) => 
  `feeder_${feeder.replace(/\s+/g, '_').toLowerCase()}_year_${year}`;

const getModel = (collectionName) => {
  if (!models[collectionName]) {
    models[collectionName] = mongoose.model(collectionName, dataSchema);
  }
  return models[collectionName];
};

// User authentication system
const users = {}; // In-memory storage (replace with MongoDB in the future)

// Register user (Admin setup, should be used once)
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (users[username]) return res.status(400).json({ error: 'User already exists' });

  const passwordHash = await bcrypt.hash(password, 10);
  users[username] = { passwordHash };
  res.json({ message: 'User registered successfully' });
});

// Login Route
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!users[username]) return res.status(401).json({ error: 'Invalid username or password' });

  if (bcrypt.compareSync(password, users[username].passwordHash)) {
    req.session.authenticated = true;
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Invalid username or password' });
  }
});

// Logout Route
app.post('/logout', (req, res, next) => {
  req.session.destroy(err => {
    if (err) return next(err);
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out successfully' });
  });
});

// Middleware to check authentication
const isAuthenticated = (req, res, next) => {
  if (req.session.authenticated) return next();
  res.status(401).json({ error: 'Unauthorized' });
};

// Protected route example
app.get('/dataupload', isAuthenticated, (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(path.join(__dirname, 'public', 'Dataupload.html'));
});

// Function to check if data exists
const checkDataExists = async (feeder, year, voltage, MW, date, time) => {
  const collectionName = formatCollectionName(feeder, year);
  const Model = getModel(collectionName);
  const exists = await Model.exists({ voltage, feeder, year, MW, date, time });
  return !!exists;
};

// Insert Data Function
const insertDataIntoCollection = async (feeder, year, data) => {
  const collectionName = formatCollectionName(feeder, year);
  const Model = getModel(collectionName);
  const newData = new Model(data);
  return newData.save();
};

// POST route to save data
app.post('/upload', async (req, res) => {
  const { feeder, year, voltage, MW, date, time } = req.body;

  try {
    if (!feeder || !year || !voltage || !MW || !date || !time) {
      throw new Error('Missing required fields');
    }

    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) throw new Error('Invalid date format');

    const dataExists = await checkDataExists(feeder, year, voltage, MW, parsedDate, time);
    if (dataExists) return res.status(400).json({ error: 'Data already exists' });

    await insertDataIntoCollection(feeder, year, { voltage, feeder, year, MW, date: parsedDate, time });
    res.status(201).json({ message: 'Data saved successfully' });

  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET route to fetch data
app.get('/data', async (req, res) => {
  const { feeder, year, startMonth, startYear, endMonth, endYear } = req.query;
  const collectionName = formatCollectionName(feeder, year);

  try {
    if (!feeder || !year || !startMonth || !startYear || !endMonth || !endYear) {
      throw new Error('Missing required query parameters.');
    }

    const startDate = new Date(`${startYear}-${startMonth}-01`);
    const endDate = new Date(`${endYear}-${endMonth}-31`);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || startDate > endDate) {
      throw new Error('Invalid date range.');
    }

    const Model = getModel(collectionName);
    const data = await Model.find({ date: { $gte: startDate, $lte: endDate } });

    res.json(data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/fetch', async (req, res) => {
  try {
      // Fetch data based on request params
      const { voltageLevel, feeder, startMonth, startYear, endMonth, endYear } = req.query;
      
      // Implement your data fetch logic here
      const data = await fetchData(voltageLevel, feeder, startMonth, startYear, endMonth, endYear);

      res.json(data); // Send JSON response
  } catch (error) {
      console.error("Error fetching data:", error);
      res.status(500).json({ error: "Internal Server Error" });
  }
});


// PUT route to update data
app.put('/update', async (req, res) => {
  const { id, MW, date, time } = req.body;
  const { feeder, year } = req.query;
  const collectionName = formatCollectionName(feeder, year);

  try {
    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) throw new Error('Invalid date format');

    const Model = getModel(collectionName);
    const updatedData = await Model.findByIdAndUpdate(id, { MW, date: parsedDate, time }, { new: true });

    res.json({ message: 'Data updated successfully', data: updatedData });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE route to delete data
app.delete('/delete/:id', async (req, res) => {
  const { id } = req.params;
  const { feeder, year } = req.query;
  const collectionName = formatCollectionName(feeder, year);

  try {
    const Model = getModel(collectionName);
    await Model.findByIdAndDelete(id);
    res.json({ message: 'Data deleted successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Combined endpoint to check if data exists
app.get('/check-existence', async (req, res) => {
  const { feeder, year, date, time } = req.query;
  const collectionName = `Feeder_${feeder}_Year_${year}`;

  try {
    const Model = getModel(collectionName);
    const exists = await Model.exists({ feeder, year, date, time });
    res.json({ exists: !!exists });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
