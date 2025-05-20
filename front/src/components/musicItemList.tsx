import { Link } from "react-router-dom";

// type LinkButtonProps = {
//     text: string,
//     link: string
// }
type DysplayMusic ={
    musicID : number;
    title : string;
    artist : string;
    thumbnail : string;//画像のURL? 画像そのもの？
}
export const MusicItemList = (props: DysplayMusic) => {
  return (//検索結果画面などのリストメインの音楽表示
    <div className="musicItemList">
      <Link to={`/practice?musicID=${props.musicID}`}>
        タイトル:{props.title}
        アーティスト:{props.artist}
        <img src={props.thumbnail} alt="thumbnail" />
      </Link>
    </div>
  );
}