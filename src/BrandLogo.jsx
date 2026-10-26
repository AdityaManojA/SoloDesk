import './brand.css';

// Terracove sun (1.14): terracotta block, sun in the top half, sea below. The sun and sea use
// --brand-ink (black on light surfaces, cream on dark ones). Plays the float-up motion once when it
// mounts unless animate={false}; reduced-motion users get the still mark (brand.css).
export function BrandMark({size=44, animate=true}) {
  return <span className={'brand-mark'+(animate?' brand-anim':'')} style={{'--brand-size':size+'px'}} aria-hidden="true">
    <svg viewBox="0 0 256 256" width={size} height={size} focusable="false">
      <path className="bm-block" fill="#E8957A" d="M40 76a36 36 0 0 1 36-36h104a36 36 0 0 1 36 36v64c-30 0-44 24-88 24s-58-24-88-24z"/>
      <circle className="bm-sun" cx="128" cy="100" r="30"/>
      <path className="bm-sea" d="M40 168c30 0 44 24 88 24s58-24 88-24v12a36 36 0 0 1-36 36H76a36 36 0 0 1-36-36z"/>
    </svg>
  </span>;
}
export default function BrandLogo({animate=true}) {
  return <b className="brand-lockup"><BrandMark animate={animate}/><span>terracove</span></b>;
}
