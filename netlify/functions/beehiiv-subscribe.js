exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  let email, firstName;
  try {
    const body = JSON.parse(event.body);
    email = body.email;
    firstName = body.first_name || body.firstName || body.name || '';
  } catch {
    return { statusCode: 400, headers, body: 'Invalid JSON' };
  }

  if (!email) {
    return { statusCode: 400, headers, body: 'Email required' };
  }

  const PUB_ID = process.env.BEEHIIV_PUB_ID;
  const API_KEY = process.env.BEEHIIV_API_KEY;

  const res = await fetch(`https://api.beehiiv.com/v2/publications/${PUB_ID}/subscriptions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      first_name: firstName,
      reactivate_existing: true,
      send_welcome_email: true,
      utm_source: 'landing-page',
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: data }) };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ success: true, id: data.data?.id }),
  };
};
