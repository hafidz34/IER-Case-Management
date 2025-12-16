import logo from "../assets/spil-logo.png";

type Props = { size?: number };

export default function LogoMark({ size = 22 }: Props) {
  return (
    <img
      src={logo}
      alt="SPIL"
      style={{ width: size, height: size, objectFit: "contain" }}
      loading="lazy"
    />
  );
}