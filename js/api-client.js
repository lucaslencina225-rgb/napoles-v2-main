// Cliente API para comunicación con backend
// Handles authentication, requests, and token management

export class APIClient {
  constructor() {
    this.baseURL = '';
    this.token = null;
    this.usuario = null;
  }

  // Almacenar token en localStorage
  setToken(token) {
    this.token = token;
    localStorage.setItem('pos_auth_token', JSON.stringify({ token, ts: Date.now() }));
  }

  // Obtener token del localStorage
  getToken() {
    try {
      const data = JSON.parse(localStorage.getItem('pos_auth_token') || '{}');
      this.token = data.token;
      return data.token;
    } catch (e) {
      return null;
    }
  }

  // Configurar headers con token
  getHeaders(withAuth = true) {
    const headers = {
      'Content-Type': 'application/json'
    };
    if (withAuth) {
      const token = this.getToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }
    return headers;
  }

  // Request genérico
  async request(method, endpoint, data = null) {
    const url = `${this.baseURL}/api${endpoint}`;
    const options = {
      method,
      headers: this.getHeaders(endpoint !== '/login')
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, options);
      const text = await response.text();
      let result = {};
      if (text) {
        try {
          result = JSON.parse(text);
        } catch {
          throw new Error('Respuesta inválida del servidor');
        }
      }

      if (!response.ok) {
        throw new Error(result.error || `Error ${response.status}`);
      }

      return result;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  // Read all pages so saved records never disappear behind a UI-only cap.
  async getAll(endpoint) {
    const rows = [];
    const size = 500;
    for (let offset = 0; ; offset += size) {
      const separator = endpoint.includes('?') ? '&' : '?';
      const page = await this.request('GET', `${endpoint}${separator}limite=${size}&offset=${offset}`);
      if (!Array.isArray(page)) throw new Error('Listado inválido del servidor');
      rows.push(...page);
      if (page.length < size) return rows;
    }
  }

  // Login
  async login(usuario, password) {
    const result = await this.request('POST', '/login', { usuario, password });
    if (result.token) {
      this.setToken(result.token);
      this.usuario = result.usuario;
      return result;
    }
    throw new Error('Login fallido');
  }

  // Logout
  async logout() {
    try {
      await this.request('POST', '/logout');
    } catch (e) {
      // Ignorar error en logout
    }
    localStorage.removeItem('pos_auth_token');
    this.token = null;
    this.usuario = null;
  }

  // Obtener datos del usuario actual
  async getMe() {
    return this.request('GET', '/me');
  }

  // Verificar si está autenticado
  isAutenticado() {
    return !!this.getToken();
  }

  // Obtener usuario actual
  getUsuario() {
    return this.usuario;
  }
}

// Instancia global
export const api = new APIClient();

