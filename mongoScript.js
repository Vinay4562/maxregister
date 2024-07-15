// mongoScript.js

const { MongoClient } = require('mongodb');

const url = 'mongodb://localhost:27017';
const dbName = 'datastore';

MongoClient.connect(url, function(err, client) {
  if (err) {
    console.error('connection error:', err);
    return;
  }

  console.log('Connected to MongoDB');

  const db = client.db(dbName);

  function getCollectionName(feeder, year) {
    return `data_${feeder}_${year}`;
  }

  function insertData(feeder, year, data) {
    const collectionName = getCollectionName(feeder, year);
    const collection = db.collection(collectionName);

    collection.insertOne(data, function(err, result) {
      if (err) {
        console.error('insert error:', err);
        return;
      }

      console.log(`Inserted data for ${feeder} (${year})`);
    });
  }

  // Example data
  const data = {
    voltage: '400KV',
    feeder: 'Example Feeder',
    year: '2022',
    MW: 100,
    date: '2022-05-25',
    time: '12:00'
  };

  // Example usage
  insertData(data.feeder, data.year, data);

  // Close the connection
  client.close();
});
