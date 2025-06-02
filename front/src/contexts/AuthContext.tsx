// src/contexts/AuthContext.tsx
import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';

interface AuthContextType {
  spotifyAccessToken: string | null;
  spotifyTokenExpiresAt: number | null;
  setSpotifyAuthData: (token: string, expiresAt: number, refreshToken?: string) => void;
  clearSpotifyAuthData: () => void;
  isSpotifyAuthenticated: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [spotifyAccessToken, setSpotifyAccessToken] = useState<string | null>(null);
  const [spotifyTokenExpiresAt, setSpotifyTokenExpiresAt] = useState<number | null>(null);

  useEffect(() => {
    // localStorageからトークンを読み込む
    const storedToken = localStorage.getItem('spotify_access_token');
    const storedExpiresAt = localStorage.getItem('spotify_token_expires_at');
    const storedRefreshToken = localStorage.getItem('spotify_refresh_token');

    if (storedToken && storedExpiresAt) {
      const expiresAt = parseInt(storedExpiresAt, 10);
      if (Date.now() < expiresAt) {
        setSpotifyAccessToken(storedToken);
        setSpotifyTokenExpiresAt(expiresAt);
        console.log("AuthContext: Spotify token loaded from localStorage.");
      } else {
        localStorage.removeItem('spotify_access_token');
        localStorage.removeItem('spotify_token_expires_at');
        localStorage.removeItem('spotify_refresh_token');
        console.log("AuthContext: Spotify token expired and removed from localStorage.");
      }
    }
  }, []);

  const setSpotifyAuthData = (token: string, expiresAt: number, refreshToken?: string) => {
    setSpotifyAccessToken(token);
    setSpotifyTokenExpiresAt(expiresAt);
    localStorage.setItem('spotify_access_token', token);
    localStorage.setItem('spotify_token_expires_at', expiresAt.toString());
    if (refreshToken) {
      localStorage.setItem('spotify_refresh_token', refreshToken);
    }
    console.log("AuthContext: Spotify auth data set.");
  };

  const clearSpotifyAuthData = () => {
    setSpotifyAccessToken(null);
    setSpotifyTokenExpiresAt(null);
    localStorage.removeItem('spotify_access_token');
    localStorage.removeItem('spotify_token_expires_at');
    localStorage.removeItem('spotify_refresh_token');
    console.log("AuthContext: Spotify auth data cleared.");
  };

  const isSpotifyAuthenticated = (): boolean => {
    return !!spotifyAccessToken && !!spotifyTokenExpiresAt && Date.now() < spotifyTokenExpiresAt;
  };

  return (
    <AuthContext.Provider value={{ spotifyAccessToken, spotifyTokenExpiresAt, setSpotifyAuthData, clearSpotifyAuthData, isSpotifyAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
