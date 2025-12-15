const bcrypt = require('bcryptjs');

const apiKey = 'ak_da955087b123f8edee27231d122b2a9f50e98d847dc68646b9214af7153b85bc';

bcrypt.hash(apiKey, 10).then(hash => {
  console.log('\n========================================');
  console.log('  🔒 API Key Hash Generated');
  console.log('========================================\n');
  console.log('API_KEY_HASH:');
  console.log(hash);
  console.log('\n========================================\n');
}).catch(console.error);
