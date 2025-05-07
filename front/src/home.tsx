import { LinkButton } from "./components/test/link";
export const Home = () => {
  const title: string = "ホーム画面";

  return (
    <div className="Home">
      <h1>{title}</h1>
        <LinkButton text="お気に入り画面/Favorite" link="/favorite" />
        <LinkButton text="推薦画面/Recommend" link="/recommend" />
        <LinkButton text="Spotify認証画面/Auth" link="/auth" />
        <h3>ヘッダー</h3>
        <LinkButton text="Spotify認証/Auth" link="/auth" />
        <h3>フッター</h3>
        <LinkButton text="ホーム画面/Home" link="/home" />
        <LinkButton text="検索画面/Search" link="/search" />
        <LinkButton text="お気に入り画面/Favorite" link="/favorite" />
    </div>
  );
}
