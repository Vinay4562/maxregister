require('dotenv').config(); // Load environment variables

const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const session = require('express-session');
const MongoStore = require('connect-mongo'); // For session storage
const bcrypt = require('bcryptjs'); // Use bcryptjs for hashing
const path = require('path');

const app = express();

// Middleware
app.use(bodyParser.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'your_secret_key', // Use a strong secret for session management
  resave: false,
  saveUninitialized: true,
  store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }), // Use MongoDB to store sessions
  cookie: { secure: process.env.NODE_ENV === 'production' } // Set to true in production if using HTTPS
}));

// MongoDB connection
mongoose.connect(process.env.MONGO_URI).then(() => {
  console.log('Connected to MongoDB');
}).catch(err => {
  console.error('Connection error', err);
});

// Define a schema
const dataSchema = new mongoose.Schema({
  voltage: String,
  feeder: String,
  year: String,
  MW: Number,
  date: Date,  // Changed to Date for proper date comparison
  time: String
});

// Store models in a map
const models = {};

// Function to get or create a model
const getModel = (collectionName) => {
  if (!models[collectionName]) {
    models[collectionName] = mongoose.model(collectionName, dataSchema);
  }
  return models[collectionName];
};

// Dummy credentials (hashed password)
const defaultUser = {
  username: 'Shankarpally400kv',
  passwordHash: bcrypt.hashSync('Shankarpally@9870', 10) // Replace 'password' with the actual password
};

// POST route for login
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  // Check credentials
  if (username === defaultUser.username && bcrypt.compareSync(password, defaultUser.passwordHash)) {
    req.session.authenticated = true; // Set session flag for authenticated user
    res.json({ success: true });
  } else {
    res.json({ success: false, message: 'Invalid username or password' });
  }
});

// Logout route
app.post('/logout', (req, res, next) => {
  req.session.destroy(err => {
    if (err) {
      return next(err);
    }
    res.clearCookie('connect.sid'); // Clear the session cookie
    res.redirect('/login.html'); // Redirect to login page after logout
  });
});

// GET route to check if user is authenticated
app.get('/check-auth', (req, res) => {
  res.json({ authenticated: req.session.authenticated || false });
});

// Middleware to check if the user is authenticated
const ensureAuthenticated = (req, res, next) => {
  if (req.session.authenticated) {
    return next();
  }
  res.redirect('/login.html'); // Redirect to login if not authenticated
};

// Protect the route that serves Dataupload.html
app.get('/dataupload', ensureAuthenticated, (req, res) => {
  res.setHeader('Cache-Control', 'no-store'); // Prevent caching of the page
  res.sendFile(path.join(__dirname, 'public', 'Dataupload.html'));
});

// Function to check if data exists in the collection
const checkDataExists = async (feeder, year, voltage, MW, date, time) => {
  const collectionName = `Feeder_${feeder}_Year_${year}`;
  const Model = getModel(collectionName);
  const exists = await Model.exists({ voltage, feeder, year, MW, date, time });
  return !!exists;
};

// Function to insert data into the correct collection
const insertDataIntoCollection = async (feeder, year, data) => {
  const collectionName = `Feeder_${feeder}_Year_${year}`;
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

    const dataExists = await checkDataExists(feeder, year, voltage, MW, date, time);

    if (dataExists) {
      res.json({ error: 'Data already exists in the database.' });
    } else {
      await insertDataIntoCollection(feeder, year, { voltage, feeder, year, MW, date, time });
      res.status(201).json({ message: 'Data saved successfully' });
    }
  } catch (err) {
    console.error('Error during data upload:', err); // Log the error for debugging
    res.status(400).json({ error: 'An error occurred while saving data. Please try again later.' });
  }
});

app.get('/data', async (req, res) => {
  const { feeder, year, fromDate, toDate } = req.query;
  const collectionName = `Feeder_${feeder}_Year_${year}`;

  try {
    // Log query parameters for debugging
    console.log('Fetching data for:', { feeder, year, fromDate, toDate });

    if (!feeder || !year) {
      return res.status(400).json({ error: 'Feeder and year are required' });
    }

    // Parse the fromDate and toDate strings into JavaScript Date objects
    let from = new Date(fromDate);
    let to = new Date(toDate);

    // Ensure that the dates are valid
    if (isNaN(from) || isNaN(to)) {
      return res.status(400).json({ error: 'Invalid date format. Please use YYYY-MM-DD.' });
    }

    // If only year is provided, create a default date range for the entire year (start to end)
    if (!fromDate || !toDate) {
      from = new Date(`${year}-01-01`);
      to = new Date(`${year}-12-31`);
    }

    const Model = getModel(collectionName);

    // Find data within the date range (if dates are provided)
    const data = await Model.find({
      date: { $gte: from, $lte: to }
    });

    // Log the resulting data
    console.log('Fetched Data:', data);

    if (data.length === 0) {
      return res.json({ message: 'No data found for the selected filters.' });
    }

    res.json(data);
  } catch (err) {
    console.error('Error fetching data:', err); // Log the error for debugging
    res.status(400).json({ error: 'An error occurred while fetching data. Please try again later.' });
  }
});

// PUT route to update data
app.put('/update', async (req, res) => {
  const { id, MW, date, time } = req.body;
  const { feeder, year } = req.query;
  const collectionName = `Feeder_${feeder}_Year_${year}`;

  try {
    const Model = getModel(collectionName);
    const updatedData = await Model.findByIdAndUpdate(id, { MW, date, time }, { new: true });
    res.json({ message: 'Data updated successfully', data: updatedData });
  } catch (err) {
    console.error('Error updating data:', err); // Log the error for debugging
    res.status(400).json({ error: 'An error occurred while updating data. Please try again later.' });
  }
});

// DELETE route to delete data
app.delete('/delete/:id', async (req, res) => {
  const { id } = req.params;
  const { feeder, year } = req.query;
  const collectionName = `Feeder_${feeder}_Year_${year}`;

  try {
    const Model = getModel(collectionName);
    await Model.findByIdAndDelete(id);
    res.json({ message: 'Data deleted successfully' });
  } catch (err) {
    console.error('Error deleting data:', err); // Log the error for debugging
    res.status(400).json({ error: 'An error occurred while deleting data. Please try again later.' });
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
    console.error('Error checking data existence:', err); // Log the error for debugging
    res.status(400).json({ error: 'An error occurred while checking data existence. Please try again later.' });
  }
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
