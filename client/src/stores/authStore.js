import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi, usersApi } from '../api';

const useAuthStore = create(
  persist(
    (set, get) => ({
      user:          null,
      accessToken:   null,
      refreshToken:  null,
      preferences:   null,

      login: async (email, password) => {
        const { data } = await authApi.login(email, password);
        const { access_token, refresh_token, user, preferences } = data.data;
        localStorage.setItem('access_token', access_token);
        localStorage.setItem('refresh_token', refresh_token);
        set({ user, accessToken: access_token, refreshToken: refresh_token, preferences });
        return user;
      },

      logout: async () => {
        try { await authApi.logout(get().refreshToken); } catch (_) {}
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        set({ user: null, accessToken: null, refreshToken: null, preferences: null });
      },

      updatePreferences: async (prefs) => {
        const userId = get().user?.id;
        if (!userId) return;
        const { data } = await usersApi.updatePreferences(userId, prefs);
        set({ preferences: data.data });
        return data.data;
      },

      isLoggedIn: () => !!get().user,
      role:        () => get().user?.role,
    }),
    {
      name: 'gigi-auth',
      partialize: state => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        preferences: state.preferences,
      }),
    }
  )
);

export default useAuthStore;
