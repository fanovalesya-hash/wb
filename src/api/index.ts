// Базовый URL. Благодаря прокси из шага 1, мы можем оставить его пустым
const BASE_URL = '';

type RequestOptions = {
  method?: string;
  body?: any;
};

// Главная функция для всех запросов
async function request(url: string, options: RequestOptions = {}) {
  const { method = 'GET', body } = options;

  const config: RequestInit = {
    method,
    // ОЧЕНЬ ВАЖНО: эта строчка говорит браузеру отправлять куки (наш токен) вместе с запросом
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  };

  // Если передали данные (например, при регистрации), превращаем их в JSON
  if (body) {
    config.body = JSON.stringify(body);
  }

  const response = await fetch(`${BASE_URL}${url}`, config);
  const data = await response.json();

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}

// Экспортируем удобные методы, чтобы потом писать просто api.get('/user/')
export const api = {
  get: (url: string) => request(url, { method: 'GET' }),
  post: (url: string, body: any) => request(url, { method: 'POST', body }),
  put: (url: string, body: any) => request(url, { method: 'PUT', body }),
  delete: (url: string) => request(url, { method: 'DELETE' }),
};