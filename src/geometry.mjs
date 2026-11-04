// Vizcom stores centers in Cartesian coordinates: positive Y points UP.
export function bounds({x,y,width,height}){return {left:x-width/2,right:x+width/2,top:y+height/2,bottom:y-height/2};}
export function fromTopLeft(left,top,width,height){return {x:left+width/2,y:top-height/2,width,height};}
export function contains(section,item,padding=0){const a=bounds(section),b=bounds(item);return b.left>=a.left+padding&&b.right<=a.right-padding&&b.top<=a.top-padding&&b.bottom>=a.bottom+padding;}
export function overlaps(a,b){const x=bounds(a),y=bounds(b);return x.left<y.right&&x.right>y.left&&x.top>y.bottom&&x.bottom<y.top;}
