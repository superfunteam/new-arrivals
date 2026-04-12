// v1 format function — gets clientContext.identity injected by Netlify
exports.handler = async (event, context) => {
  // Log everything about the identity context
  const identity = context.clientContext?.identity || {};
  const user = context.clientContext?.user || {};
  
  console.log('[identity-helper] identity keys:', Object.keys(identity));
  console.log('[identity-helper] identity.url:', identity.url);
  console.log('[identity-helper] identity.token:', identity.token ? identity.token.slice(0, 20) + '...' : 'none');
  console.log('[identity-helper] user:', JSON.stringify(user));
  
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      hasToken: !!identity.token,
      tokenPreview: identity.token ? identity.token.slice(0, 20) + '...' : null,
      url: identity.url || null,
      identityKeys: Object.keys(identity),
    }),
  };
};
