import { LinkButton } from "./components/test/link";

export const Result = () => {
    const title: string = "検索結果画面";

    return (
        <div className="Result">
            <h1>{title}</h1>
            <LinkButton text="検索画面/Search" link="/search" />
            <LinkButton text="楽譜表示画面/Practice" link="/practice" />
            <h3>ヘッダー</h3>
            <LinkButton text="Spotify認証/Auth" link="/auth" />
            <h3>フッター</h3>
            <LinkButton text="ホーム画面/Home" link="/home" />
            <LinkButton text="検索画面/Search" link="/search" />
            <LinkButton text="お気に入り画面/Favorite" link="/favorite" />
        </div>
    );
}