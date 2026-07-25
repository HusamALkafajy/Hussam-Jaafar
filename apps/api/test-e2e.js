const http = require('http');

async function request(method, path, data, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 4000,
      path: '/api' + path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        let json;
        try {
          json = JSON.parse(body);
        } catch(e) {
          json = body;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: json
        });
      });
    });

    req.on('error', reject);
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

function extractCookies(headers) {
  const cookieHeaders = headers['set-cookie'];
  if (!cookieHeaders) return '';
  return cookieHeaders.map(c => c.split(';')[0]).join('; ');
}

function extractCsrfToken(cookiesStr) {
  const match = cookiesStr.match(/csrf_token=([^;]+)/);
  return match ? match[1] : '';
}

async function run() {
  console.log('--- User Registration ---');
  let email = `test+${Date.now()}@example.com`;
  let res = await request('POST', '/auth/register', { email, password: 'Password123!', firstName: 'Test', lastName: 'User' });
  console.log('Status:', res.status);
  
  if (res.status === 409) {
    console.log('Already registered. Logging in instead.');
  } else if (res.status !== 201 && res.status !== 200) {
    console.log('Registration failed:', res.data);
    return;
  }

  console.log('--- User Login ---');
  res = await request('POST', '/auth/login', { email, password: 'Password123!' });
  console.log('Status:', res.status);
  if (res.status !== 200) {
    console.log('Login failed:', res.data);
    return;
  }
  let cookies = extractCookies(res.headers);
  let csrf = extractCsrfToken(cookies);
  let accessToken = res.data.data ? res.data.data.accessToken : res.data.accessToken;
  console.log('Cookies extracted:', cookies ? 'YES' : 'NO');
  console.log('Access token extracted:', accessToken ? 'YES' : 'NO');
  
  console.log('--- User Refresh Token ---');
  res = await request('POST', '/auth/refresh', null, {
    'Cookie': cookies,
    'X-CSRF-Token': csrf
  });
  console.log('Status:', res.status);
  if (res.status === 200) {
    cookies = extractCookies(res.headers) || cookies;
    csrf = extractCsrfToken(cookies);
    accessToken = res.data.data ? res.data.data.accessToken : res.data.accessToken;
    console.log('Refreshed successfully.');
  } else {
    console.log('Refresh failed:', res.data);
  }

  console.log('--- Get Me (Session Check) ---');
  res = await request('GET', '/auth/me', null, {
    'Authorization': `Bearer ${accessToken}`
  });
  console.log('Status:', res.status);
  if (res.status === 200) {
    console.log('Get Me succeeded:', res.data.user.email);
  } else {
    console.log('Get Me failed:', res.data);
  }

  console.log('--- Logout ---');
  res = await request('POST', '/auth/logout', null, {
    'Cookie': cookies,
    'X-CSRF-Token': csrf,
    'Authorization': `Bearer ${accessToken}`
  });
  console.log('Status:', res.status);
  if (res.status === 200) {
    console.log('Logout successful.');
  } else {
    console.log('Logout failed:', res.data);
  }
}

run().catch(console.error);
