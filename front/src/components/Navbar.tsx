import './Navbar.css';
import { LinkButton } from "./link";


export const Navbar = () => {//フッター
    return (
        <nav className="nav">
            <LinkButton text="ホーム画面/Home" link="/home" />
            <LinkButton text="検索画面/Search" link="/search" />
            <LinkButton text="お気に入り画面/Favorite" link="/favorite" />
        </nav>
    )
}