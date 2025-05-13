import { LinkButton } from "./components/test/link";
import { Navbar } from './components/Navbar';
import { useRef, useEffect, useState } from 'react';
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';

export const Practice = () => {
    const title: string = "楽譜表示画面";

    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const divRef = useRef<HTMLDivElement>(null);
    const osmdRef = useRef<OpenSheetMusicDisplay | null>(null);
    const [xml, setXml] = useState<string | null>(null);
    const [measureNum, setMeasureNum] = useState<number>(1);

    // スクロール位置を保存する
    const saveScrollPosition = () => {
        return scrollContainerRef.current
            ? scrollContainerRef.current.scrollTop
            : 0;
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <header style={{ padding: '1rem', background: '#f0f0f0', flexShrink: 0 }}>
            <LinkButton text="ホーム画面" link="/home" />
        </header>
        <main
            ref={scrollContainerRef}
            style={{
                flexGrow: 1,
                overflow: 'auto',
                    background: '#ffffff',
                    padding: '1rem'
                }}
        >
            <div ref={divRef} />
        </main>
        <footer style={{ padding: '1rem', background: '#f0f0f0', flexShrink: 0 }}>
            <p style={{ margin:0 }}>フッター</p>
        </footer>
        </div>
    );
}
