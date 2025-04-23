import { LinkButton } from "./components/test/link";
export const Auth = () => {
  const title: string = "Spotify認証画面/ モーダルウィンドウにしたい";

  return (
    <div className="Auth">
      <h1>{title}</h1>
        <LinkButton text="ホーム画面/Home" link="/home" />
        <LinkButton text="検索画面/Search" link="/search" />
        <LinkButton text="お気に入り画面/Favorite" link="/favorite" />
        <LinkButton text="推薦画面/Recommend" link="/recommend" />
    </div>
  );
}