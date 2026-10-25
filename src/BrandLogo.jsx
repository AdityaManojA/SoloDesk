import './brand.css';

export function BrandMark({size=44}) {
  return <span className="brand-mark" style={{'--brand-size':size+'px'}} aria-hidden="true"><img className="brand-mark-light" src="/brand/throughline-mark.svg" width={size} height={size} alt=""/><img className="brand-mark-dark" src="/brand/throughline-mark-dark.svg" width={size} height={size} alt=""/></span>;
}
export default function BrandLogo() {
  return <b className="brand-lockup"><BrandMark/><span>Terracove</span></b>;
}
