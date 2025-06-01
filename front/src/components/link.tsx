import { Link } from "react-router-dom";
import React from 'react';
import './link.css';

type LinkButtonProps = {
    text?: string,
    link: string,
    icon?: React.ReactNode,
    state?: any; // ルーターのstateを渡せるように追加
}

export const LinkButton = (props: LinkButtonProps) => {
  return (
    <div className="LinkButton">
      <Link to={props.link} className="nav-item" state={props.state}> {/* stateをLinkコンポーネントに渡す */}
        {props.icon && <div className="nav-icon">{props.icon}</div>} {/* アイコンがあれば表示 */}
        {props.text && <span className="nav-text">{props.text}</span>} {/* テキストがあれば表示 */}
      </Link>
    </div>
  );
}
