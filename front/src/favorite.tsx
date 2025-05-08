import { LinkButton } from "./components/test/link";
import { Navbar } from './components/Navbar';

export const Favorite = () => {
    const title: string = "お気に入り楽曲画面";

    return (
        <>
        <div className="Favorite">
            <h1>{title}</h1>
            <LinkButton text="楽譜表示画面/Practice" link="/practice" />
            <h3>ヘッダー</h3>
            <LinkButton text="Spotify認証/Auth" link="/auth" />
        </div>
        <Navbar />
        </>
    );
}