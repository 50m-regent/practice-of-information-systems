import { LinkButton } from "./components/test/link";

export const Search = () => {
    const title: string = "検索画面";

    return (
        <div className="Search">
            <h1>{title}</h1>
            <LinkButton text="ホーム画面/Home" link="/home" />
            <LinkButton text="検索結果画面/Result" link="/result" />
            <h3>ヘッダー</h3>
            <LinkButton text="Spotify認証/Auth" link="/auth" />
            <h3>フッター</h3>
            <LinkButton text="ホーム画面/Home" link="/home" />
            <LinkButton text="検索画面/Search" link="/search" />
            <LinkButton text="お気に入り画面/Favorite" link="/favorite" />
        </div>
    );
}