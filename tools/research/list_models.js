const https = require('https');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config();

const options = {
  hostname: 'api.groq.com',
  path: '/openai/v1/models',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
    'Content-Type': 'application/json'
  }
};

const req = https.request(options, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      if (parsed.error) {
        console.error('API Error:', parsed.error);
        return;
      }
      const models = parsed.data || [];
      console.log('Available Models:');
      models.forEach(m => console.log(`- ${m.id}`));
    } catch (e) {
      console.error('Parse error:', e.message);
      console.log('Raw:', data);
    }
  });
});

req.on('error', e => console.error('Req error:', e));
req.end();
