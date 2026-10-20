// Both the spotlight and callout use viewport coordinates, including visual zoom/pan.
export function tourHighlight(box, radius, viewport, padding=5) {
  const left=Math.max(viewport.left+2,box.left-padding),top=Math.max(viewport.top+2,box.top-padding);
  const right=Math.min(viewport.left+viewport.width-2,box.right+padding),bottom=Math.min(viewport.top+viewport.height-2,box.bottom+padding);
  if(right<=left||bottom<=top)return null;
  const rounded=String(radius).endsWith('%')?Math.min(box.width,box.height)*parseFloat(radius)/100:parseFloat(radius)||0;
  return {left,top,width:right-left,height:bottom-top,borderRadius:Math.min(rounded+padding,(right-left)/2,(bottom-top)/2)};
}

export function placeTourCard(rect,size,viewport) {
  const margin=12,gap=16,w=Math.min(size.width,viewport.width-margin*2),h=Math.min(size.height,viewport.height-margin*2);
  const clamp=(v,min,max)=>Math.max(min,Math.min(v,max));
  if(!rect)return {left:margin,top:margin,maxHeight:viewport.height-margin*2,side:'center'};
  const x=rect.left-viewport.left,y=rect.top-viewport.top,right=x+rect.width,bottom=y+rect.height;
  const below=viewport.height-margin-bottom-gap,above=y-gap-margin;
  // Beside a small control keeps a large cutout from being hidden by the card.
  if(viewport.width-right-gap-margin>=w)return {left:right+gap,top:clamp(y,margin,viewport.height-margin-h),maxHeight:viewport.height-margin*2,side:'right'};
  if(x-gap-margin>=w)return {left:x-gap-w,top:clamp(y,margin,viewport.height-margin-h),maxHeight:viewport.height-margin*2,side:'left'};
  const left=clamp(right-w,margin,viewport.width-margin-w);
  if(below>=Math.min(h,220)||below>=above&&below>=160)return {left,top:bottom+gap,maxHeight:below,side:'below'};
  if(above>=160)return {left,top:margin+Math.max(0,above-h),maxHeight:above,side:'above'};
  return {left,top:margin,maxHeight:viewport.height-margin*2,side:'center'};
}
