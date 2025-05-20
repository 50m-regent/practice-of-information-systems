import { LinkButton } from "./components/test/link";
import { Navbar } from './components/Navbar';

export const Practice = () => {
    const title: string = "楽譜表示画面";

    return (
        <>
        <div className="Practice">
            <h1>{title}</h1>
            <LinkButton text="ホーム画面" link="/home" />
        </div>
        <Navbar />
        </>
    );
}