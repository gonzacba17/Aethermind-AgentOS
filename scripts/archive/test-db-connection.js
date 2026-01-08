const { Client } = require('pg');

const connectionString = 'postgresql://aethermind:aethermind123@localhost:5432/aethermind';

console.log('Testing PostgreSQL connection...');
console.log('Connection string:', connectionString);

const client = new Client({
  connectionString: connectionString,
});

client.connect()
  .then(() => {
    console.log('✅ Successfully connected to PostgreSQL!');
    return client.query('SELECT version();');
  })
  .then((result) => {
    console.log('Database version:', result.rows[0].version);
    return client.end();
  })
  .then(() => {
    console.log('Connection closed.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Connection failed:', err.message);
    console.error('Error details:', err);
    process.exit(1);
  });
