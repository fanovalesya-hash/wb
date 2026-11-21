const http = require('http');

const data = JSON.stringify({
  email: 'test@example.com',
  password: '12345'
});

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/auth/',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('Код ответа:', res.statusCode);
    console.log('Ответ сервера:', body);
    console.log('Куки (тут будет токен):', res.headers['set-cookie']);
  });
});

req.on('error', (e) => {
  console.error('Ошибка:', e.message);
});

req.write(data);
req.end();