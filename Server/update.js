const http = require('http');

// Данные, которые мы хотим обновить
const data = JSON.stringify({
  nickname: 'SuperCoolUser',
  email: 'test@example.com'
});

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/user/',
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length,
    // Вот здесь мы передаем наш токен, который получили при входе!
    'Cookie': 'token=2FP_FszuYGkwGW7Bvqns4' 
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('Код ответа:', res.statusCode);
    console.log('Ответ сервера:', body);
  });
});

req.on('error', (e) => {
  console.error('Ошибка:', e.message);
});

req.write(data);
req.end();