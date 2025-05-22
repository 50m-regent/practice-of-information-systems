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
        <img src={props.thumbnail} alt="thumbnail" />
        {/* ダミーデータ */}
        <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAMAAAAp4XiDAAAABGdBTUEAALGPC/xhBQAAACBjSFJNAAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAAA3lBMVEU9Q7jT1O////+xs+JKUL3Fx+ry8vrExuo+RLjx8vpSV8BGTLtDSbqkp96usOFCSLpPVb/29vzY2fHDxelOU77i4/RbYMN/g9A/RblJT7zk5PVfZMViZsXOz+1LUL23uuW8vub39/xESrv19fu5u+WXmtmRlNdQVb/3+PxFSrtITrzk5fXKy+xjaMZpbshLUb3t7fhZXsLj5PVRVr/n5/be3/NrcMnu7/lcYcNCR7qrreCwsuKprOCnqd8/RLnLzex+gtCmqd6Okdbw8PlITbzHyOrq6/eUl9hHTbxrb8n+VD9KAAAAAWJLR0QCZgt8ZAAAAAd0SU1FB+MDFQY4O956N5wAAACwSURBVEjH7dC3EoJAFIXhAyqgsigGzIKYEMw55/j+L+TAoGOxBfb7dff83QUYhmH+wfE8HwLCEUEMBytSNBaPywBREgpBoJJUU2o6A2Q1aFl3yHH5QrFEKx/lSrmqG0DNhFn3lkZTb9HLj7YAWDI6lnfZTleiF1+vDwyGQHGE0dhbJtOZTC+++WK5Wm+ALZHIzh32h+PmRC3fv5ydi34FCre7aLvDw8DTedEKwzBMYG/7KBXMD75mAgAAACV0RVh0ZGF0ZTpjcmVhdGUAMjAxOS0wMy0yMVQxNTo1Njo1OSswOTowMFEJEK0AAAAldEVYdGRhdGU6bW9kaWZ5ADIwMTktMDMtMjFUMTU6NTY6NTkrMDk6MDAgVKgRAAAAAElFTkSuQmCC" alt="サムネイル"/>
        タイトル:{props.title}
        アーティスト:{props.artist}
      </Link>
    </div>
  );
}