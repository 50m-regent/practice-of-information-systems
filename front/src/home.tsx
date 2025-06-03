import { LinkButton } from "./components/link";
import { Navbar } from './components/Navbar';
import { useState, useEffect} from "react";
import axios from "axios"; // PKCEではトークン交換にaxiosは不要になりますが、他のAPI呼び出しで使用している場合は残してください。
import { MusicItemIcon } from "./components/musicItemIcon";
import { generateRandomString } from "./utils/stringUtils"; // 既存のユーティリティ
import "./css/Home.css";
import { useAuth } from './contexts/AuthContext';

import { DysplayMusic } from "./types/types";

 const MAX_MUSIC_NUM = 5; //表示する音楽の最大数

const CLIENT_ID = "826a4a6ab717454aa24268036207a028";
const REDIRECT_URI = "http://127.0.0.1:5173/callback.html";
const SCOPES = ["user-top-read", "user-read-recently-played", "user-library-read", "playlist-read-private", "playlist-read-collaborative", "user-follow-read"];

// PKCE用のヘルパー関数
/**
 * Generates a cryptographically secure random string for PKCE code_verifier.
 */
function generateCodeVerifier(length: number = 128): string {
  const possibleChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let randomString = '';
  const randomValues = new Uint8Array(length);
  window.crypto.getRandomValues(randomValues);
  for (let i = 0; i < length; i++) {
    randomString += possibleChars.charAt(randomValues[i] % possibleChars.length);
  }
  return randomString;
}

/**
 * Generates a code_challenge from a code_verifier.
 */
async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await window.crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}


export const Home = () => {
  const title: string = "ホーム画面";
  const [favoriteMusic, setFavoriteMusic] = useState<DysplayMusic[]>([]);
  const [recommendMusic, setRecommendMusic] = useState<DysplayMusic[]>([]);
  const [quickAccess, setQuickAccess] = useState<DysplayMusic[]>([]);
  // const [spotifyAccessToken, setSpotifyAccessToken] = useState<string | null>(null);
  // const [spotifyTokenExpiresAt, setSpotifyTokenExpiresAt] = useState<number | null>(null);
  const { spotifyAccessToken, spotifyTokenExpiresAt, setSpotifyAuthData, isSpotifyAuthenticated } = useAuth(); // Use context

  const openSpotifyLogin = async () => {
    const state = generateRandomString(16); // CSRF対策のstate
    const codeVerifier = generateCodeVerifier(); // PKCEのcode_verifier

    sessionStorage.setItem('spotify_auth_state', state);
    sessionStorage.setItem('spotify_pkce_code_verifier', codeVerifier);

    const codeChallenge = await generateCodeChallenge(codeVerifier);

    const authUrlParams = new URLSearchParams({
      client_id: CLIENT_ID,
      response_type: 'code',
      redirect_uri: REDIRECT_URI,
      scope: SCOPES.join(' '), // スペース区切り
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    const authUrl = `https://accounts.spotify.com/authorize?${authUrlParams.toString()}`;
    window.open(authUrl, "Spotify Login", "width=400,height=600");
  };

  useEffect(() => {
    // localStorageからトークンを読み込む
    // const storedToken = localStorage.getItem('spotify_access_token');
    // const storedExpiresAt = localStorage.getItem('spotify_token_expires_at');

    // if (storedToken && storedExpiresAt) {
    //   const expiresAt = parseInt(storedExpiresAt, 10);
    //   if (Date.now() < expiresAt) {
    //     setSpotifyAccessToken(storedToken);
    //     setSpotifyTokenExpiresAt(expiresAt);
    //     console.log("Spotify token loaded from localStorage");
    //   } else {
    //     // Token expired
    //     localStorage.removeItem('spotify_access_token');
    //     localStorage.removeItem('spotify_token_expires_at');
    //     console.log("Spotify token expired and removed from localStorage");
    //   }
    // }

    // localStorageからのトークン読み込みはAuthProviderが担当します。
    // このuseEffectは主にメッセージイベントリスナーと初期データ取得を担当します

    // Spotify認証コールバックからのメッセージを処理
    const handleAuthMessage = async (event: MessageEvent) => {
      console.log('handleAuthMessage triggered. Event origin:', event.origin, 'Expected origin:', window.location.origin, 'Event data:', event.data);
      // callback.htmlが提供されるオリジンを正確に指定する
      // viteのデフォルト開発サーバーであれば window.location.origin で問題ないはず
      if (event.origin !== window.location.origin) {
        console.warn("Message from unknown origin:", event.origin);
        return;
      }

      const { type, code, error, state: receivedState } = event.data;
      const storedState = sessionStorage.getItem('spotify_auth_state');
      sessionStorage.removeItem('spotify_auth_state'); // 検証後は削除

      if (receivedState !== storedState) {
        console.error('Spotify Auth Error: State mismatch. Possible CSRF attack.');
        // TODO: ユーザーにエラーを通知
        return;
      }

      if (type === 'spotifyAuthSuccess' && code) {
        console.log('Spotify Authorization Code received:', code);
        const storedCodeVerifier = sessionStorage.getItem('spotify_pkce_code_verifier');
        sessionStorage.removeItem('spotify_pkce_code_verifier'); // 使用後は削除

        if (!storedCodeVerifier) {
          console.error('Spotify Auth Error: Code verifier not found in session storage.');
          // TODO: ユーザーにエラーを通知
          return;
        }

        try {
          const tokenRequestBody = new URLSearchParams({
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: REDIRECT_URI,
            client_id: CLIENT_ID,
            code_verifier: storedCodeVerifier,
          });

          const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: tokenRequestBody.toString(),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Token exchange failed: ${errorData.error_description || response.statusText}`);
          }

          const tokenData = await response.json();
          const { access_token, expires_in, refresh_token } = tokenData; // refresh_tokenも取得可能

          if (access_token && expires_in) {
            const expiresAt = Date.now() + (expires_in * 1000);
            // setSpotifyAccessToken(access_token);
            // setSpotifyTokenExpiresAt(expiresAt);
            // localStorage.setItem('spotify_access_token', access_token);
            // localStorage.setItem('spotify_token_expires_at', expiresAt.toString());
            setSpotifyAuthData(access_token, expiresAt, refresh_token);
            if (refresh_token) {
              // localStorage.setItem('spotify_refresh_token', refresh_token); // リフレッシュトークンも保存
              // refresh_tokenはsetSpotifyAuthData内でlocalStorageに保存されます
              console.log('Spotify Refresh Token obtained and stored.');
            }
            console.log('Spotify Access Token obtained directly from Spotify:', access_token);
          } else {
            console.error('Failed to get access token from Spotify:', tokenData.error || 'Unknown error');
          }
        } catch (err: any) {
          console.error('Error exchanging code for token with Spotify:', err.message || err);
          // TODO: ユーザーにエラーを通知
        }

      } else if (type === 'spotifyAuthError') {
        console.error('Spotify Auth Error from callback:', error);
        // TODO: ユーザーにエラーを通知
      }
    };

    window.addEventListener('message', handleAuthMessage);
    console.log("home.tsx: Event listener for 'message' added.");

    (
      async () => {
        const favoData = await axios.get("http://localhost:8080/favorites");
        const quickData = await axios.get("http://localhost:8080/recommendations/proficiency"); // 習熟度からおすすめ取るのはこっち
        // const recoData = await axios.get("http://localhost:8080/recommendations/proficiency");

        const recoData = await axios.post("http://localhost:8080/recommendations/spotify",
          {
            access_token: spotifyAccessToken,
            limit: 10,
            count: 10
          },
          {
            headers: {
              'Content-Type': 'application/json'
            }
          }
        ); //Spotifyからおすすめ取るのはこっち
        // const quickData = await axios.get("http://localhost:8080/getquickaccess"); //まだ実装されてない？
        setFavoriteMusic((favoData.data || []).slice(0,Math.min(MAX_MUSIC_NUM, (favoData.data || []).length)));
        setRecommendMusic((recoData.data || []).slice(0,Math.min(MAX_MUSIC_NUM, (recoData.data || []).length)));
        setQuickAccess((recoData.data || []).slice(0,Math.min(MAX_MUSIC_NUM, (recoData.data || []).length)));
        }
    )();

    return () => {
      window.removeEventListener('message', handleAuthMessage);
      console.log("home.tsx: Event listener for 'message' removed.");
    };
    },[setSpotifyAuthData]); // 依存配列は空のまま（初回マウント時のみ実行）

  return (
    <div className="Home">
      {/* ヘッダー */}
      <div className="header">
        {/* ヘッダーの左側のコンテンツ */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {/* <div style={{
            width: '30px',
            height: '30px',
            backgroundColor: '#A0A0A0', // ダミーのアイコン色
            borderRadius: '5px',
            marginRight: '10px',
          }}></div> */}
          <span className="app-title">やさシート</span> {/* 画像の「NAME」部分 */}
        </div>
        {/* ヘッダーの右側のコンテンツ */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <img
            className="spotify-icon-header"
            src="/Primary_Logo_White_RGB.svg"
            alt="Spotify Icon"
            style={{ width: '30px', height: '30px' }}
            onClick={openSpotifyLogin}
          />
        </div>
      </div>

    {/* <button onClick={openSpotifyLogin}>Spotifyと連携</button>
      {spotifyAccessToken ? (
        <p style={{ color: 'green', fontSize: 'small' }}>Spotify連携済み (有効期限: {spotifyTokenExpiresAt ? new Date(spotifyTokenExpiresAt).toLocaleString() : 'N/A'})</p>
      ) : (
        <p style={{ color: 'red', fontSize: 'small' }}>Spotify未連携</p>
      )} */}

      {/* メイン */}
      <div className="main">
        <b style={{paddingLeft: '10px'}}>クイックアクセス</b>
        <div className="horizontal-scroll-container">
          {
            quickAccess.map((music) => (
              <MusicItemIcon
                key={music.music_id}
                musicID={music.music_id}
                title={music.title}
                artist={music.artist}
                thumbnail={music.thumbnail}
              />
            ))
          }
        </div>
        <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 10px' }}>
          <b>お気に入り</b>
          <LinkButton text="すべて見る" link="/favorite" />
        </div>
        <div className="horizontal-scroll-container">
          {
            favoriteMusic.map((music) => (
              <MusicItemIcon
                key={music.music_id}
                musicID={music.music_id}
                title={music.title}
                artist={music.artist}
                thumbnail={music.thumbnail}
              />
            ))
          }
        </div>
        <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 10px' }}>
          <b>おすすめ</b>
          <LinkButton text="すべて見る" link="/recommend"/>
        </div>
        <div className="horizontal-scroll-container">
          {
            recommendMusic.map((music) => (
              <MusicItemIcon
                key={music.music_id}
                musicID={music.music_id}
                title={music.title}
                artist={music.artist}
                thumbnail={music.thumbnail}
              />
            ))
          }
        </div>
      </div>
      <div className="footer">
        <Navbar />
      </div>
    </div>
  );
}
