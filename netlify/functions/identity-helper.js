// v1 format function — Netlify injects clientContext.identity with a
// pre-signed admin JWT. This proxies GoTrue admin API calls using that token.

exports.handler = async (event, context) => {
  const identity = context.clientContext?.identity || {};
  const token = identity.token;
  const url = identity.url;

  if (!token || !url) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'No identity token. Include Authorization header with Netlify Identity JWT.' }),
    };
  }

  const method = event.httpMethod;
  const goPath = event.queryStringParameters?.path;

  if (!goPath) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Provide ?path= (e.g. ?path=/users)' }),
    };
  }

  console.log(`[identity-helper] ${method} /admin${goPath}`);

  const fetchOpts = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };
  if (method === 'POST' && event.body) {
    fetchOpts.body = event.body;
  }

  const res = await fetch(`${url}/admin${goPath}`, fetchOpts);
  const body = await res.text();

  console.log(`[identity-helper] GoTrue response: ${res.status}`);

  return {
    statusCode: res.status,
    headers: { 'Content-Type': 'application/json' },
    body,
  };
};
