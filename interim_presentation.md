---

marp: true
math: mathjax
paginate: true
style: |
    :root {
        --alert-color: #D33;
    }

    section.cover {
        background: linear-gradient(
            var(--h1-color) 0%,
            var(--h1-color) 52%, /*タイトルの行数と大きさで変える*/
            white 0%,
            white 100%
        );
    }

    h1 { /* タイトル */
        color: white;
        font-size: 280%; /*タイトルの文字数で変える*/
    }

    h6 { /*日付など*/
        position: absolute;
        bottom: 25%;
    }

    h4 { /* 所属 */
        position: absolute;
        bottom: 15%;
    }

    h5 { /* 名前 */
        font-size: 120%;
        color: var(--h1-color);
        position: absolute;
        bottom: 10%;
    }

    header {
        font-size: 180%;
        font-weight: 600;
        color: white;
        background: var(--h1-color);
        width: 100%;
        padding: 0.5em 0.8em 0em;
        left: 0;
        top: 0;
        line-height: 85%;
    }

    h2 {
        color: white;
        font-size: 300%
    }

    h3 {
        color: var(--h1-color);
    }

    section.content {
        /* 中央寄せじゃなくて上寄せにしたければ外す
        justify-content: start;
        padding-top: 3em;
        */
    }
    

    blockquote > blockquote > blockquote {
        font-size: 75%;
        font-weight: 400;
        padding: 0;
        margin: 0;
        border: 0;
        border-top: 0.1em dashed #555;
        position: absolute;
        bottom: 40px;
        left: 70px;
        width: 1140px;
    }

    table {
        font-size: 75%;
        margin: 0 auto;
    }

    img[alt~="center"] {
        display: block;
        margin: 0 auto;
    }

    section::after {
        content: attr(data-marpit-pagination) " / " attr(data-marpit-pagination-total);
    }

---

<!--
_paginate: false
_class: cover
-->

# 9班 中間発表

###### 2025/5/13

<!--#### M1

##### 平田 蓮 - Lenne Hirata-->

---

<!--
_header: 解決したい課題 - Challenge to Solve
_class: content
-->

### 楽器の練習シーンでの問題に着目

### Focusing on problems in musical instrument practice scenes.

- **課題**: 自身の弾きたい楽曲と自分のレベルに合った楽曲が一致していない
- **Problem**: The songs users want to play often do not match their skill level.
- **提案価値**: ユーザーが弾きたい曲を選び，アプリ側で本人の実力にあった難易度に改変した楽譜を表示する
- **Solution**: Users select songs they want to play, then the app then adjusts the difficulty of the sheet music to match their skill level.

---

<!--
_header: アプリ概要 - Overview
_class: content
-->

- ユーザーの演奏の様子から熟練度を測定
- The app measures user’s skill level based on their playing performance
- リアルタイムで楽譜をユーザーのレベルにあったものへ変更する
- Automatically adjusts the sheet difficulty to match their skill level in realtime.

---

<!--
_header: アプリ概要 - Overview
_class: content
-->

---

<!--
_header: 機能一覧 - Features
_class: content
-->

- 楽曲の検索・提案・お気に入り - Song Search / Recommendations / Favorites
- 楽譜の表示 - Display scores
- 楽譜の難易度変更 (自動でも、手動でも) - Change score difficulty in realtime (automatically and manually)
- 演奏に合わせて自動で楽譜の進行 - Show playing position on the score
- 演奏の録音・再生 - Record and playback
- 修正した楽譜の保存 - Save modified score
