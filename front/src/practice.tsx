import { LinkButton } from "./components/test/link";
import { Navbar } from './components/Navbar';
import { useRef, useEffect, useState } from 'react';
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';

// 楽譜を小節単位で変更する
async function replaceMeasure(
    musicXmlA: string,      // この楽譜の小節を変更
    musicXmlB: string,      // 変更する小節を持つ楽譜
    measureNumber: string   // 変更する小節番号
): Promise<string | null> {
    try {
        const parser = new DOMParser();
        const serializer = new XMLSerializer();

        const xmlDocA = parser.parseFromString(musicXmlA, 'application/xml');
        const xmlDocB = parser.parseFromString(musicXmlB, 'application/xml');

        const measureB = xmlDocB.querySelector(`measure[number="${measureNumber}"]`);
        if (!measureB) {
            console.error(`B楽譜に${measureNumber}小節目は見つかりません`);
            return null;
        }
        const clonedMeasureBChildren = Array.from(measureB.childNodes).map(node => node.cloneNode(true));

        const measureA = xmlDocA.querySelector(`measure[number="${measureNumber}"]`);
        if (!measureA) {
            console.error(`A楽譜に${measureNumber}小節目は見つかりません`);
            return null;
        }

        while (measureA.firstChild) {
            measureA.removeChild(measureA.firstChild);
        }
        clonedMeasureBChildren.forEach(child => {
            measureA.appendChild(child);
        });

        return serializer.serializeToString(xmlDocA);
    } catch (error) {
        console.error('楽譜の処理中にエラーが発生しました:', error);
        return null;
    }
}

export const Practice = () => {
    const title: string = "楽譜表示画面";

    const divRef = useRef<HTMLDivElement>(null);
    const osmdRef = useRef<OpenSheetMusicDisplay | null>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // 表示する楽譜の内容はstring型でxmlに格納
    // 楽譜表示の際などはその都度xml形式に変換してください
    const [xml, setXml] = useState<string | null>(null);

    // スクロール位置を保存する
    const saveScrollPosition = () => {
        return scrollContainerRef.current
            ? scrollContainerRef.current.scrollTop
            : 0;
    };

    // スクロール位置を復元する
    const restoreScrollPosition = (scrollTop: number) => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = scrollTop;
        }
    };

    // 初期化: OSMDのインスタンス生成
    useEffect(() => {
        if (divRef.current) {
            osmdRef.current = new OpenSheetMusicDisplay(divRef.current);
        }
    }, []);

    // 楽譜の読み込み
    useEffect(() => {
        // 楽譜を読み込んで setXml(初期楽譜) で xml に初期楽譜を入れてください
    }, []);

    // xmlが更新されたときに再描画
    useEffect(() => {
        if (xml && osmdRef.current) {
            // 楽譜変更後もその場にとどまるようにスクロール位置を保存
            const scrollTop = saveScrollPosition();
            console.log(scrollTop)

            const parser = new DOMParser();
            const parsedXml = parser.parseFromString(xml, 'application/xml');
            osmdRef.current.load(parsedXml)
                .then(() => {
                    osmdRef.current?.render();
                    restoreScrollPosition(scrollTop); // スクロール位置を復元
                })
                .catch((err) => console.error('OSMD 再描画エラー:', err));
        }
    }, [xml]);

    // xml2 の楽譜データの measureNumber 小節で xml の内容を変更します
    const handleReplace = async (xml2: string | null, measureNumber: number) => {
        if (!xml || !xml2) {
            console.error("楽譜データが読み込まれていません。");
            return;
        }
        const updatedXml = await replaceMeasure(xml, xml2, measureNumber.toString());
        if (updatedXml) {
            setXml(updatedXml);
            console.log('sheet changed')
        }
    };

    const handleScrollToMeasure = (measureNumber: number) => {
        const container = scrollContainerRef.current;
        const div = divRef.current;
        if (!container || !div) return;

        // 小節番号（id）を指定
        const measureId = measureNumber.toString();

        // 該当する g.vf-measure 要素を探す
        const svgMeasure = div.querySelector(`g.vf-measure[id="${measureId}"]`);
        if (!svgMeasure) {
            console.warn(`小節 ${measureId} のSVG要素が見つかりません`);
            return;
        }

        // 要素の画面上の位置を取得し、スクロールコンテナの座標系に変換
        const svgRect = svgMeasure.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        // scrollTop の調整量を計算してスクロール
        const scrollTop = container.scrollTop + (svgRect.top - containerRect.top);
        container.scrollTop = scrollTop;

        console.log(`スクロール位置を小節 ${measureId} に移動しました`);
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
