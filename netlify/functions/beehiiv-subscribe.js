exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let email, firstName;
  try {
    const body = JSON.parse(event.body);
    email = body.email;
    firstName = body.first_name || body.firstName || '';
  } catch {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  if (!email) {
    return { statusCode: 400, body: 'Email required' };
  }

  const PUB_ID = 'pub_a34f87b7-36af-445a-a468-f69c5c6caa8f';
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
      utm_source: 'manychat',
      utm_medium: 'instagram_dm',
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    return { statusCode: 500, body: JSON.stringify({ error: data }) };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true, id: data.data?.id }),
  };
};
