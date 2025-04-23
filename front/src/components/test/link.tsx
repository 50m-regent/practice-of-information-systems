import { Link } from "react-router-dom";

type LinkButtonProps = {
    text: string,
    link: string
}

export const LinkButton = (props: LinkButtonProps) => {
  return (
    <div className="LinkButton">
      <Link to={props.link}>
        {props.text}
      </Link>
    </div>
  );
}