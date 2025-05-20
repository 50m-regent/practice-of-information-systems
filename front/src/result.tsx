import { LinkButton } from "./components/test/link";
import { Navbar } from './components/Navbar';

export const Result = () => {
    const title: string = "検索結果画面";

    return (
        <>
        <div className="Result">
            <h1>{title}</h1>
            <LinkButton text="検索画面/Search" link="/search" />
            <LinkButton text="楽譜表示画面/Practice" link="/practice" />
            <h3>ヘッダー</h3>
            <LinkButton text="Spotify認証/Auth" link="/auth" />
        </div>
        <Navbar />
        </>
    );
}