const https = require('https');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let email, firstName;
  try {
    const body = JSON.parse(event.body);
    email = body.email;
    firstName = body.firstName;
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request' }) };
  }

  if (!email || !email.includes('@')) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid email' }) };
  }

  const pubId = process.env.BEEHIIV_PUB_ID;
  const apiKey = process.env.BEEHIIV_API_KEY;

  console.log('pubId length:', pubId ? pubId.length : 'MISSING');
  console.log('apiKey length:', apiKey ? apiKey.length : 'MISSING');
  console.log('apiKey last 4:', apiKey ? apiKey.slice(-4) : 'MISSING');

  const payload = JSON.stringify({
    email,
    ...(firstName && { first_name: firstName }),
    reactivate_existing: false,
    send_welcome_email: true
  });

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.beehiiv.com',
      path: `/v2/publications/${pubId}/subscriptions`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('Beehiiv status:', res.statusCode);
        console.log('Beehiiv body:', data);
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ statusCode: 200, body: JSON.stringify({ success: true }) });
        } else {
          let err = {};
          try { err = JSON.parse(data); } catch {}
          resolve({
            statusCode: res.statusCode,
            body: JSON.stringify({ error: err.message || err.errors?.[0]?.message || data || 'Subscription failed' })
          });
        }
      });
    });

    req.on('error', (e) => {
      console.log('Request error:', e.message);
      resolve({ statusCode: 500, body: JSON.stringify({ error: e.message }) });
    });

    req.write(payload);
    req.end();
  });
};
