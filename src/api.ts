const BASE_URL = '';

type RequestOptions = {
  method?: string;
  body?: any;
};

async function request(url: string, options: RequestOptions = {}) {
  const { method = 'GET', body } = options;

  const config: RequestInit = {
    method,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  };

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

export const api = {
  get: (url: string) => request(url, { method: 'GET' }),
  post: (url: string, body: any) => request(url, { method: 'POST', body }),
  put: (url: string, body: any) => request(url, { method: 'PUT', body }),
  delete: (url: string) => request(url, { method: 'DELETE' }),
};