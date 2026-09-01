/**
 * API Client Service
 * Centralized HTTP client with JWT authentication
 */

const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('token');
}

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers,
  };

  const response = await fetch(url, config);
  const data = await response.json();

  if (response.status === 401) {
    // Token expired or invalid — clear and reload
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
    throw new Error('Session expired');
  }

  if (!response.ok) {
    const error = new Error(data.message || 'API request failed');
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

// ── Auth API ──────────────────────────────────────────────────

export const authApi = {
  login(username, password) {
    return request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },

  getProfile() {
    return request('/auth/me');
  },

  register(data) {
    return request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  changePassword(data) {
    return request('/auth/password', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  listUsers() {
    return request('/auth/users');
  },

  toggleUser(id) {
    return request(`/auth/users/${id}/toggle`, { method: 'PUT' });
  },

  forceLogout(id) {
    return request(`/auth/users/${id}/force-logout`, { method: 'POST' });
  },
};

// ── Machines API ──────────────────────────────────────────────

export const machinesApi = {
  list(params = {}) {
    const query = new URLSearchParams(params).toString();
    return request(`/machines?${query}`);
  },

  get(id) {
    return request(`/machines/${id}`);
  },

  create(data) {
    return request('/machines', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update(id, data) {
    return request(`/machines/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete(id) {
    return request(`/machines/${id}`, { method: 'DELETE' });
  },

  getTownships() {
    return request('/machines/lookups/townships');
  },

  getBrands() {
    return request('/machines/lookups/brands');
  },

  getTypes() {
    return request('/machines/lookups/types');
  },

  getModels(brandId) {
    const query = brandId ? `?brand_id=${brandId}` : '';
    return request(`/machines/lookups/models${query}`);
  },

  getEngineers() {
    return request('/machines/lookups/engineers');
  },
};

// ── PM Schedules API ──────────────────────────────────────────

export const pmSchedulesApi = {
  getDashboard(params = {}) {
    const query = new URLSearchParams(params).toString();
    return request(`/pm-schedules/dashboard?${query}`);
  },

  getSummary() {
    return request('/pm-schedules/summary');
  },

  complete(id, data = {}) {
    return request(`/pm-schedules/${id}/complete`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  regenerate(machineId) {
    return request(`/pm-schedules/regenerate/${machineId}`, { method: 'POST' });
  },

  delete(id) {
    return request(`/pm-schedules/${id}`, { method: 'DELETE' });
  },
};

// ── Service Tickets API ───────────────────────────────────────

export const ticketsApi = {
  list(params = {}) {
    const query = new URLSearchParams(params).toString();
    return request(`/service-tickets?${query}`);
  },

  get(id) {
    return request(`/service-tickets/${id}`);
  },

  create(data) {
    return request('/service-tickets', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateStatus(id, data) {
    return request(`/service-tickets/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  update(id, data) {
    return request(`/service-tickets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete(id) {
    return request(`/service-tickets/${id}`, { method: 'DELETE' });
  },
};

// ── Admin API ────────────────────────────────────────────────

function createAdminApi(resource) {
  return {
    list() {
      return request(`/admin/${resource}`);
    },
    get(id) {
      return request(`/admin/${resource}/${id}`);
    },
    create(data) {
      return request(`/admin/${resource}`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    update(id, data) {
      return request(`/admin/${resource}/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    delete(id) {
      return request(`/admin/${resource}/${id}`, { method: 'DELETE' });
    },
  };
}

export const adminApi = {
  townships: createAdminApi('townships'),
  brands: createAdminApi('brands'),
  machineTypes: createAdminApi('machine-types'),
  engineers: createAdminApi('engineers'),
  models: {
    list(brandId) {
      const query = brandId ? `?brand_id=${brandId}` : '';
      return request(`/admin/models${query}`);
    },
    get(id) {
      return request(`/admin/models/${id}`);
    },
    create(data) {
      return request('/admin/models', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    update(id, data) {
      return request(`/admin/models/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    delete(id) {
      return request(`/admin/models/${id}`, { method: 'DELETE' });
    },
  },
};

// ── Permissions API ──────────────────────────────────────────

export const permissionsApi = {
  getSchema() {
    return request('/permissions/schema');
  },

  getUser(userId) {
    return request(`/permissions/${userId}`);
  },

  update(userId, permissions) {
    return request(`/permissions/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({ permissions }),
    });
  },

  check(tab, field) {
    return request('/permissions/check', {
      method: 'POST',
      body: JSON.stringify({ tab, field }),
    });
  },
};

// ── Audit Logs API ─────────────────────────────────────────

export const auditLogsApi = {
  list(params = {}) {
    const query = new URLSearchParams(params).toString();
    return request(`/audit-logs?${query}`);
  },

  delete(id) {
    return request(`/audit-logs/${id}`, { method: 'DELETE' });
  },

  bulkDelete(olderThan) {
    return request('/audit-logs', {
      method: 'DELETE',
      body: JSON.stringify({ older_than: olderThan }),
    });
  },
};

// ── Login Logs API ────────────────────────────────────────

export const loginLogsApi = {
  list(params = {}) {
    const query = new URLSearchParams(params).toString();
    return request(`/login-logs?${query}`);
  },

  getStats() {
    return request('/login-logs/stats');
  },

  delete(id) {
    return request(`/login-logs/${id}`, { method: 'DELETE' });
  },

  bulkDelete(olderThan) {
    return request('/login-logs', {
      method: 'DELETE',
      body: JSON.stringify({ older_than: olderThan }),
    });
  },
};

// ── Backup API ──────────────────────────────────────────────

export const backupApi = {
  async download() {
    const token = getToken();
    const response = await fetch(`${API_BASE}/backup/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || 'Backup failed');
    }
    // Trigger file download
    const blob = await response.blob();
    const disposition = response.headers.get('Content-Disposition');
    const filename = disposition?.match(/filename="?(.+)"?/)?.[1] || 'backup.sql';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return filename;
  },
};
