// Coarse pixel teaching props. Each exported component is independent of the
// narration, speaker and topic. Values and state come from the episode.
const P={ink:'#15221e',gold:'#b69a59',paper:'#e6debe',muted:'#8b947c',teal:'#82b6a1',red:'#b76850'};
const clamp=x=>Math.max(0,Math.min(1,x));
function r(c,x,y,w,h,color){c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
function frame(c,x,y,w,h,color=P.gold,stroke=3){r(c,x,y,w,stroke,color);r(c,x,y+h-stroke,w,stroke,color);r(c,x,y,stroke,h,color);r(c,x+w-stroke,y,stroke,h,color);}
function text(c,s,x,y,size=30,color=P.paper,align='left'){c.font=`${size}px "Fusion Pixel 12px Proportional Simplified Chinese",monospace`;c.textAlign=align;c.textBaseline='top';c.fillStyle=color;c.fillText(s,Math.round(x),Math.round(y));}
function panel(c,x,y,w,h,color=P.gold){r(c,x+7,y+9,w,h,'#07110c');r(c,x,y,w,h,P.ink);frame(c,x,y,w,h,color);for(const [a,b]of [[x,y],[x+w-6,y],[x,y+h-6],[x+w-6,y+h-6]])r(c,a,b,6,6,'#d5c48c');}
function dashed(c,x,y,w,h,color=P.muted){for(let a=x;a<x+w;a+=17){r(c,a,y,10,3,color);r(c,a,y+h-3,10,3,color)}for(let b=y;b<y+h;b+=17){r(c,x,b,3,10,color);r(c,x+w-3,b,3,10,color)}}
export const componentGlyphs='收藏栏资料已存入调取记忆未找到空白闭卷测试我的回答参考答案等待核对卡点即时反馈偏差答对了经验获得能力已解锁书籍先看再答先答再看验证成功检索任务问题✓×?+0123456789≠ ·';

export function drawPaper(c,{x,y,w=112,h=72,label='',mark=false,alpha=1}){
 c.save();c.globalAlpha=alpha;r(c,x+5,y+5,w,h,'#141c15');r(c,x,y,w,h,'#c4b58d');r(c,x+6,y+6,w-12,h-12,'#ddd2ae');r(c,x+12,y+16,w-36,4,'#77765b');r(c,x+12,y+27,w-29,4,'#888167');r(c,x+12,y+40,w-49,4,'#888167');r(c,x+w-18,y+9,8,14,P.gold);
 if(mark){r(c,x+10,y+29,w-30,8,'#a06042');r(c,x+14,y+50,w-45,4,'#a06042')}
 if(label)text(c,label,x+w/2,y+h+8,24,P.paper,'center');c.restore();
}
export function drawInventory(c,{x,y,w=278,count=0,title='收藏栏',state='已存入',alpha=1}){
 c.save();c.globalAlpha=alpha;panel(c,x,y,w,208);text(c,title,x+18,y+15,30,'#d1bd7c');r(c,x+17,y+58,w-34,2,'#52604b');
 for(let i=0;i<3;i++){const bx=x+19+i*79,by=y+80;r(c,bx,by,67,63,'#101a14');frame(c,bx,by,67,63,'#68785e',2);drawPaper(c,{x:bx+9,y:by+10,w:48,h:35});}
 text(c,`资料 ${count}`,x+19,y+160,30,'#d6c287');text(c,state,x+w-17,y+166,24,P.muted,'right');c.restore();
}
export function drawRecallPanel(c,{x,y,w=358,title='调取记忆',state='empty',alpha=1}){
 c.save();c.globalAlpha=alpha;panel(c,x,y,w,184,state==='failed'?P.red:P.gold);text(c,title,x+19,y+17,30,P.paper);r(c,x+17,y+58,w-34,2,'#53604b');
 for(let i=0;i<3;i++){const bx=x+22+i*103;dashed(c,bx,y+81,89,58,'#596651');text(c,state==='success'?'✓':'?',bx+44,y+94,36,state==='success'?P.teal:P.muted,'center')}
 if(state==='failed')text(c,'未找到',x+w/2,y+149,24,P.red,'center');c.restore();
}
export function drawOpenBook(c,{x,y,w=196,h=104,closed=0,mark=false}){
 const k=clamp(closed);
 if(k>.96){r(c,x+26,y+18,w-52,h-19,'#283e31');r(c,x+34,y+24,w-65,h-31,'#517050');r(c,x+42,y+31,8,h-42,'#bdac74');r(c,x+46,y+h-9,w-75,7,'#baae89');return}
 const spread=w*(1-k*.7),left=x+(w-spread)/2;panel(c,left,y,spread,h,'#8d815a');r(c,left+5,y+5,spread/2-8,h-10,'#d1c29a');r(c,left+spread/2+3,y+5,spread/2-8,h-10,'#e0d5b3');r(c,left+spread/2-3,y+3,6,h-6,'#887b52');
 for(let j=0;j<4;j++){r(c,left+13,y+18+j*16,spread/2-29,3,'#858066');r(c,left+spread/2+11,y+18+j*16,spread/2-29,3,'#858066')}
 if(mark)r(c,left+spread/2+9,y+47,spread/2-24,7,'#b16b51');
}
export function drawQuizBoard(c,{x,y,w=652,prompt='',answer='',reference='',reveal=0,correct=false,mark=false,alpha=1}){
 c.save();c.globalAlpha=alpha;panel(c,x,y,w,242,correct?P.teal:P.gold);text(c,'闭卷测试',x+20,y+15,30,'#d1bd7c');if(prompt)text(c,prompt,x+w-20,y+20,24,P.muted,'right');r(c,x+17,y+58,w-34,2,'#4b5a48');
 text(c,'我的回答',x+22,y+78,24,P.muted);dashed(c,x+183,y+71,w-211,54,mark?P.red:'#596950');text(c,answer||'?',x+205,y+79,30,mark?P.red:P.paper);
 text(c,'参考答案',x+22,y+151,24,P.muted);r(c,x+183,y+142,w-211,54,'#0c1912');frame(c,x+183,y+142,w-211,54,reveal>0?P.teal:'#465444',2);
 if(reveal>0){c.save();c.globalAlpha*=clamp(reveal);text(c,reference,x+205,y+150,30,P.teal);c.restore()}else text(c,'等待核对',x+205,y+154,24,'#52624e');
 if(correct)text(c,'✓',x+w-63,y+78,36,P.teal);else if(mark)text(c,'×',x+w-60,y+78,36,P.red);
 if(mark)r(c,x+215,y+120,Math.min(240,w-270),4,P.red);
 c.restore();
}
export function drawMarkerFlag(c,{x,y,label='卡点',alpha=1}){
 c.save();c.globalAlpha=alpha;r(c,x,y-73,5,73,'#88937c');r(c,x+5,y-73,67,35,'#9f5745');r(c,x+12,y-66,45,5,'#c88667');r(c,x-9,y,24,6,'#323c2e');text(c,label,x+33,y-59,24,'#eee0bd','center');c.restore();
}
export function drawFeedback(c,{x,y,w=313,progress=0,state='pending',alpha=1}){
 const correct=state==='correct';c.save();c.globalAlpha=alpha;panel(c,x,y,w,130,correct?P.teal:P.gold);text(c,'即时反馈',x+17,y+13,24,P.muted);text(c,correct?'答对了':'偏差',x+18,y+46,36,correct?P.teal:P.red);text(c,correct?'经验 +1':'经验 +0',x+w-19,y+55,24,correct?P.paper:P.muted,'right');r(c,x+17,y+101,w-34,12,'#08170f');r(c,x+19,y+103,(w-38)*clamp(progress),8,correct?'#88bda0':'#715c43');c.restore();
}
export function drawRewardBadge(c,{x,y,label='能力已解锁',alpha=1}){
 c.save();c.globalAlpha=alpha;panel(c,x,y,300,82,'#c3a762');r(c,x+18,y+19,39,39,'#4a472c');r(c,x+26,y+27,23,6,'#d5be71');r(c,x+31,y+27,6,25,'#d5be71');r(c,x+37,y+41,10,6,'#d5be71');const family='\"Fusion Pixel 12px Proportional Simplified Chinese\",monospace';c.font=`30px ${family}`;const width=c.measureText(label).width,size=width>204?Math.max(18,Math.floor(30*204/width/6)*6):30;text(c,label,x+78,y+23,size,'#e0c984');c.restore();
}
