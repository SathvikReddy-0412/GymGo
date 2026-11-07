// GymGo Frontend API Client
const API = (function() {
  let currentUser = {
    id: 'usr_1',
    username: 'athlete',
    name: 'Alex Turner',
    role: 'athlete'
  };

  try {
    const saved = localStorage.getItem('gymgo_user');
    if (saved) currentUser = JSON.parse(saved);
  } catch(e) {}

  function getHeaders() {
    return {
      'Content-Type': 'application/json',
      'x-user-id': currentUser.id,
      'x-user-role': currentUser.role
    };
  }

  async function request(url, options = {}) {
    try {
      options.headers = { ...getHeaders(), ...(options.headers || {}) };
      const res = await fetch(url, options);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error || 'Server error');
      }
      return await res.json();
    } catch (e) {
      console.warn('API error (using fallback if applicable):', e.message);
      throw e;
    }
  }

  return {
    getCurrentUser: () => currentUser,
    setCurrentUser: (u) => {
      currentUser = u;
      try { localStorage.setItem('gymgo_user', JSON.stringify(u)); } catch(e) {}
    },

    auth: {
      login: async (username, password) => {
        const data = await request('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ username, password })
        });
        if (data.user) API.setCurrentUser(data.user);
        return data;
      },
      register: async (userData) => {
        const data = await request('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify(userData)
        });
        if (data.user) API.setCurrentUser(data.user);
        return data;
      },
      forgotPassword: async (identity) => {
        return await request('/api/auth/forgot-password', {
          method: 'POST',
          body: JSON.stringify({ identity })
        });
      },
      resetPassword: async (identity, code, newPassword) => {
        return await request('/api/auth/reset-password', {
          method: 'POST',
          body: JSON.stringify({ identity, code, newPassword })
        });
      },
      me: async () => {
        const data = await request('/api/auth/me');
        if (data.user) API.setCurrentUser(data.user);
        return data;
      },
      switchRole: async (role) => {
        const data = await request('/api/auth/switch-role', {
          method: 'POST',
          body: JSON.stringify({ role })
        });
        if (data.user) API.setCurrentUser(data.user);
        return data;
      }
    },

    gyms: {
      getCities: () => request('/api/cities'),
      getGyms: (params = {}) => {
        const q = new URLSearchParams(params).toString();
        return request(`/api/gyms?${q}`);
      },
      getById: (id) => request(`/api/gyms/${id}`)
    },

    bookings: {
      list: () => request('/api/bookings'),
      request: (data) => request('/api/bookings/request', {
        method: 'POST',
        body: JSON.stringify(data)
      }),
      ownerAction: (id, action, slots) => request(`/api/bookings/${id}/owner-action`, {
        method: 'POST',
        body: JSON.stringify({ action, slots })
      }),
      chooseSlot: (id, slot, paymentMethod) => request(`/api/bookings/${id}/choose-slot`, {
        method: 'POST',
        body: JSON.stringify({ slot, paymentMethod })
      }),
      checkIn: (id) => request(`/api/bookings/${id}/check-in`, {
        method: 'POST'
      })
    },

    coach: {
      getAssessment: () => request('/api/coach/assessment'),
      saveAssessment: (data) => request('/api/coach/assessment', {
        method: 'POST',
        body: JSON.stringify(data)
      }),
      updateWater: (glasses) => request('/api/coach/water', {
        method: 'POST',
        body: JSON.stringify({ glasses })
      })
    },

    workouts: {
      getState: () => request('/api/workouts/state'),
      saveState: (data) => request('/api/workouts/state', {
        method: 'POST',
        body: JSON.stringify(data)
      }),
      getLogs: () => request('/api/workouts/logs'),
      saveLog: (log) => request('/api/workouts/logs', {
        method: 'POST',
        body: JSON.stringify({ log })
      }),
      deleteLog: (timestamp) => request(`/api/workouts/logs/${timestamp}`, {
        method: 'DELETE'
      })
    },

    passport: {
      get: () => request('/api/passport'),
      checkIn: (gymData) => request('/api/passport/check-in', {
        method: 'POST',
        body: JSON.stringify(gymData)
      })
    },

    gymgram: {
      getPosts: () => request('/api/gymgram/posts'),
      createPost: (data) => request('/api/gymgram/posts', {
        method: 'POST',
        body: JSON.stringify(data)
      }),
      likePost: (id) => request(`/api/gymgram/posts/${id}/like`, {
        method: 'POST'
      }),
      addComment: (id, text) => request(`/api/gymgram/posts/${id}/comment`, {
        method: 'POST',
        body: JSON.stringify({ text })
      })
    },

    admin: {
      getOverview: () => request('/api/admin/overview'),
      getUsers: () => request('/api/admin/users'),
      updateUserRole: (id, role) => request(`/api/admin/users/${id}/role`, {
        method: 'POST',
        body: JSON.stringify({ role })
      }),
      deleteUser: (id) => request(`/api/admin/users/${id}`, {
        method: 'DELETE'
      }),
      getGyms: () => request('/api/admin/gyms'),
      verifyGym: (id) => request(`/api/admin/gyms/${id}/verify`, {
        method: 'POST'
      }),
      getBookings: () => request('/api/admin/bookings'),
      broadcast: (message, title, type) => request('/api/admin/broadcast', {
        method: 'POST',
        body: JSON.stringify({ message, title, type })
      }),
      getAnnouncement: () => request('/api/announcement')
    }
  };
})();
