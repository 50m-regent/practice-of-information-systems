import { LinkButton } from "./components/test/link";
import { Navbar } from './components/Navbar';
import { useState, useEffect} from "react";
import axios from "axios";
import { MusicItemIcon } from "./components/musicItemIcon";
import { generateRandomString } from "./utils/stringUtils";

type DysplayMusic ={
  musicID : number;
  title : string;
  artist : string;
  thumbnail : string;//画像のURL? 画像そのもの？
}
 const MAX_MUSIC_NUM = 5; //表示する音楽の最大数

const CLIENT_ID = "826a4a6ab717454aa24268036207a028";
const REDIRECT_URI = "http://127.0.0.1:5173/callback.html"; // ← vite起動URLに合わせて変更(vite.config.tsで5173番のポートを指定)
const SCOPES = ["user-top-read", "user-read-recently-played", "user-library-read", "playlist-read-private", "playlist-read-collaborative", "user-follow-read"]
const AUTH_URL = `https://accounts.spotify.com/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${SCOPES.join("%20")}`;

export const Home = () => {
  const title: string = "ホーム画面";
  const [favoriteMusic, setFavoriteMusic] = useState<DysplayMusic[]>([]);
  const [recommendMusic, setRecommendMusic] = useState<DysplayMusic[]>([]);
  const [quickAccess, setQuickAccess] = useState<DysplayMusic[]>([]);
  const [spotifyAccessToken, setSpotifyAccessToken] = useState<string | null>(null);
  const [spotifyTokenExpiresAt, setSpotifyTokenExpiresAt] = useState<number | null>(null);

  const openSpotifyLogin = () => {
    const state = generateRandomString(16);
    sessionStorage.setItem('spotify_auth_state', state);
    const authUrlWithState = `${AUTH_URL}&state=${state}`;
    window.open(authUrlWithState, "Spotify Login", "width=400,height=600");
  };

  useEffect(() => {
    // localStorageからトークンを読み込む
    const storedToken = localStorage.getItem('spotify_access_token');
    const storedExpiresAt = localStorage.getItem('spotify_token_expires_at');

    if (storedToken && storedExpiresAt) {
      const expiresAt = parseInt(storedExpiresAt, 10);
      if (Date.now() < expiresAt) {
        setSpotifyAccessToken(storedToken);
        setSpotifyTokenExpiresAt(expiresAt);
        console.log("Spotify token loaded from localStorage");
      } else {
        // Token expired
        localStorage.removeItem('spotify_access_token');
        localStorage.removeItem('spotify_token_expires_at');
        console.log("Spotify token expired and removed from localStorage");
      }
    }

    // Spotify認証コールバックからのメッセージを処理
    const handleAuthMessage = (event: MessageEvent) => {
      console.log('handleAuthMessage triggered. Event origin:', event.origin, 'Expected origin:', window.location.origin, 'Event data:', event.data);
      if (event.origin !== window.location.origin) {
        console.warn("Message from unknown origin:", event.origin);
        return;
      }

      // callback.htmlからは code と state が送られてくる想定
      console.log('Received message from callback.html:', event.data);
      const { type, code, error, state: receivedState } = event.data;
      const storedState = sessionStorage.getItem('spotify_auth_state');
      sessionStorage.removeItem('spotify_auth_state'); // 一度使ったら削除

      if (receivedState !== storedState) {
        console.error('Spotify Auth Error: State mismatch.');
        // TODO: ユーザーにエラーを通知 (例: エラーステートを設定してUIに表示)
        return;
      }

      if (type === 'spotifyAuthSuccess' && code) {
        console.log('Spotify Authorization Code received:', code);
        // バックエンドに認証コードを送信してアクセストークンを取得
        axios.post('http://localhost:8080/api/spotify/exchange-token', { code: code }) // バックエンドのエンドポイントは適宜変更
          .then(response => {
            const { access_token, expires_in } = response.data;
            if (access_token && expires_in) {
              const expiresAt = Date.now() + (expires_in * 1000);
              setSpotifyAccessToken(access_token);
              setSpotifyTokenExpiresAt(expiresAt);
              localStorage.setItem('spotify_access_token', access_token);
              localStorage.setItem('spotify_token_expires_at', expiresAt.toString());
              console.log('Spotify Access Token obtained from backend:', access_token);
            } else {
              console.error('Failed to get access token from backend:', response.data.error || 'Unknown error');
            }
          })
          .catch(err => {
            console.error('Error exchanging code for token:', err.response ? err.response.data : err.message);
            // TODO: ユーザーにエラーを通知
          });
      } else if (type === 'spotifyAuthError') {
        console.error('Spotify Auth Error:', error);
        // TODO: ユーザーにエラーを通知
      }
    };

    window.addEventListener('message', handleAuthMessage);
    console.log("home.tsx: Event listener for 'message' added."); // ★リスナー登録確認ログ

    (
      async () => {
        const favoData = {data:[
          {
            musicID: 1,
            title: "Favorite Song 1",
            artist: "Artist A",
            thumbnail: "https://via.placeholder.com/100x100?text=Favo1",
          },
          {
            musicID: 2,
            title: "Favorite Song 2",
            artist: "Artist B",
            thumbnail: "https://via.placeholder.com/100x100?text=Favo2",
          },
          {
            musicID: 3,
            title: "Favorite Song 3",
            artist: "Artist C",
            thumbnail: "https://via.placeholder.com/100x100?text=Favo3",
          },
          {
            musicID: 4,
            title: "Favorite Song 4",
            artist: "Artist D",
            thumbnail: "https://via.placeholder.com/100x100?text=Favo4",
          },

        ]}

        const recoData= {data:[
          {
            musicID: 5,
            title: "Favorite Song 5",
            artist: "Artist E",
            thumbnail: "https://via.placeholder.com/100x100?text=Favo5",
          },
          {
            musicID: 6,
            title: "Recommended Song 1",
            artist: "Artist X",
            thumbnail: "https://via.placeholder.com/100x100?text=Reco1",
          },
          {
            musicID: 7,
            title: "Recommended Song 2",
            artist: "Artist Y",
            thumbnail: "https://via.placeholder.com/100x100?text=Reco2",
          },
          {
            musicID: 8,
            title: "Recommended Song 3",
            artist: "Artist Z",
            thumbnail: "https://via.placeholder.com/100x100?text=Reco3",
          },
          {
            musicID: 9,
            title: "Recommended Song 4",
            artist: "Artist W",
            thumbnail: "https://via.placeholder.com/100x100?text=Reco4",
          },
          {
            musicID: 10,
            title: "Recommended Song 5",
            artist: "Artist V",
            thumbnail: "https://via.placeholder.com/100x100?text=Reco5",
          },
        ]}
        // const favoData = await axios.get("http://localhost:8080/getfavorite");
        // const recoData = await axios.get("http://localhost:8080/getrecommend?");
        // const quickData = await axios.get("http://localhost:8080/getquickaccess");
        setFavoriteMusic(favoData.data.slice(0,Math.min(MAX_MUSIC_NUM, favoData.data.length)));
        setRecommendMusic(recoData.data.slice(0,Math.min(MAX_MUSIC_NUM, recoData.data.length)));
        setQuickAccess(recoData.data.slice(0,Math.min(MAX_MUSIC_NUM, recoData.data.length)));
        }
    )();

    return () => {
      window.removeEventListener('message', handleAuthMessage);
    };
    },[]);

  return (
    <>
    <div className="Home">
      ヘッダー
    {/* <LinkButton text="Spotify認証画面/Auth" link="/auth" /> */}
    <button onClick={openSpotifyLogin}>Spotifyと連携</button>
      <h3>クイックアクセス</h3>
      {spotifyAccessToken ? (
        <p style={{ color: 'green', fontSize: 'small' }}>Spotify連携済み (有効期限: {spotifyTokenExpiresAt ? new Date(spotifyTokenExpiresAt).toLocaleString() : 'N/A'})</p>
      ) : (
        <p style={{ color: 'red', fontSize: 'small' }}>Spotify未連携</p>
      )}
        {
          quickAccess.map((music) => (
            <div key={music.musicID}>
              <MusicItemIcon
                musicID={music.musicID}
                title={music.title}
                artist={music.artist}
                thumbnail={music.thumbnail}
              />
            </div>
          ))
        }
      <h3>お気に入り</h3>
        <LinkButton text="すべて見る" link="/favorite" />
        {
          favoriteMusic.map((music) => (
            <div key={music.musicID}>
              <MusicItemIcon
                musicID={music.musicID}
                title={music.title}
                artist={music.artist}
                thumbnail={music.thumbnail}
              />
            </div>
          ))
        }
        <h3>おすすめ</h3>
        <LinkButton text="すべて見る" link="/recommend" />
        {
          recommendMusic.map((music) => (
            <div key={music.musicID}>
              <MusicItemIcon
                musicID={music.musicID}
                title={music.title}
                artist={music.artist}
                thumbnail={music.thumbnail}
              />
            </div>
          ))
        }
    <Navbar />
    </div>
    </>
  );
}
