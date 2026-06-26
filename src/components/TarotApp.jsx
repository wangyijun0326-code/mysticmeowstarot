/* =====================================================================
   塔罗页面组件 —— 一次性覆盖三个需求,可直接给 Lovable
   需求1: end 结果页(固定背景 + 文字滚动) + 三个揭示页(真牌按透视塞进发光槽)
   需求2: 导航栏 menu 可点击,点任意项返回第一页
   需求3: 卡槽位置 = 实测四角(带透视),见下方 QUADS
   ---------------------------------------------------------------------
   用法:
   - 把背景图换成你的实际资源地址(import 或 public 路径)。
   - 揭示页:<TarotReveal spread="three" background={bgThree} cards={[url1,url2,url3]} />
   - 结果页:<ReadingPage background={bgEnd} text={aiText} />
   - 路由:用了 react-router 的 useNavigate;若你没用路由,把 goHome 换成你的跳转方式。
   ===================================================================== */

import { useRef, useLayoutEffect, useState, useCallback } from "react";
// 本工程用 TanStack Router。NavBar 用 onHome 回调,不硬绑路由库(见文件底部说明)。

/* ---------- 需求3:实测四角(百分比,相对 1672×941 的画布) ----------
   六张全部纳入:*_reveal = 揭示页(真牌放进发光槽);*_select = 选牌页(可滑动牌背)。
   每张牌 4 个角:TL 左上 / TR 右上 / BR 右下 / BL 左下。daily_select 已按要求减高 3%。 */
const QUADS = {
  // —— 揭示页(真牌面飞进发光槽,牌填满槽)——
  daily_reveal: [
    { id:"card", TL:[40.20,32.15], TR:[59.41,32.09], BR:[61.80,82.36], BL:[37.58,82.36] },
  ],
  three_reveal: [
    { id:"past",    TL:[25.05,31.05], TR:[38.75,30.65], BR:[37.90,70.13], BL:[23.08,70.14] },
    { id:"present", TL:[43.45,30.71], TR:[56.70,30.71], BR:[57.11,70.14], BL:[42.88,70.14] },
    { id:"future",  TL:[61.18,30.65], TR:[74.62,31.05], BR:[76.54,70.14], BL:[61.80,70.13] },
  ],
  five_reveal: [
    { id:"a_outcome", TL:[28.14,18.60], TR:[36.87,18.60], BR:[36.30,42.19], BL:[27.03,42.19] },
    { id:"b_outcome", TL:[62.89,18.70], TR:[71.62,18.70], BR:[72.40,42.30], BL:[63.07,42.30] },
    { id:"a_path",    TL:[30.86,48.03], TR:[39.47,48.03], BR:[38.85,72.05], BL:[29.64,72.05] },
    { id:"b_path",    TL:[60.20,48.14], TR:[68.93,48.14], BR:[69.86,72.05], BL:[60.44,72.05] },
    { id:"current",   TL:[45.01,58.34], TR:[53.86,58.34], BR:[53.92,82.25], BL:[44.65,82.25] },
  ],
  // —— 选牌页(滑动选择时的牌背位置)。daily_select 已减高 3% ——
  daily_select: [
    { id:"card", TL:[43.77,24.72], TR:[56.01,24.54], BR:[56.64,57.81], BL:[42.72,57.51] },
  ],
  three_select: [
    { id:"past",    TL:[27.21,23.18], TR:[39.73,23.08], BR:[39.56,55.57], BL:[26.01,55.49] },
    { id:"present", TL:[43.82,22.80], TR:[56.06,22.85], BR:[56.60,55.55], BL:[43.15,55.57] },
    { id:"future",  TL:[60.19,23.10], TR:[72.59,23.18], BR:[73.72,55.51], BL:[60.25,55.59] },
  ],
  five_select: [
    { id:"p3", TL:[26.33,21.25], TR:[34.34,21.25], BR:[34.13,40.07], BL:[26.08,40.06] },
    { id:"p5", TL:[65.53,21.25], TR:[73.52,21.25], BR:[73.75,40.06], BL:[65.69,40.06] },
    { id:"p2", TL:[29.47,44.74], TR:[37.42,44.74], BR:[37.17,63.76], BL:[29.11,63.69] },
    { id:"p1", TL:[46.08,46.55], TR:[53.81,46.55], BR:[53.86,66.51], BL:[45.96,66.53] },
    { id:"p4", TL:[62.42,44.74], TR:[70.40,44.74], BR:[70.71,63.73], BL:[62.65,63.64] },
  ],
};

/* ---------- 透视数学:把一个正方形映射到任意四边形,得到 CSS matrix3d ---------- */
function adj(m){return[m[4]*m[8]-m[5]*m[7],m[2]*m[7]-m[1]*m[8],m[1]*m[5]-m[2]*m[4],m[5]*m[6]-m[3]*m[8],m[0]*m[8]-m[2]*m[6],m[2]*m[3]-m[0]*m[5],m[3]*m[7]-m[4]*m[6],m[1]*m[6]-m[0]*m[7],m[0]*m[4]-m[1]*m[3]];}
function mm(a,b){const r=[];for(let i=0;i<3;i++)for(let j=0;j<3;j++){let s=0;for(let k=0;k<3;k++)s+=a[3*i+k]*b[3*k+j];r[3*i+j]=s;}return r;}
function mv(m,v){return[m[0]*v[0]+m[1]*v[1]+m[2]*v[2],m[3]*v[0]+m[4]*v[1]+m[5]*v[2],m[6]*v[0]+m[7]*v[1]+m[8]*v[2]];}
function basis(p){const m=[p[0],p[2],p[4],p[1],p[3],p[5],1,1,1];const v=mv(adj(m),[p[6],p[7],1]);return mm(m,[v[0],0,0,0,v[1],0,0,0,v[2]]);}
function matrix3d(W,H,d){ // d = [TLx,TLy,TRx,TRy,BRx,BRy,BLx,BLy]  (容器内像素)
  const t=mm(basis(d),adj(basis([0,0,W,0,W,H,0,H])));
  for(let i=0;i<9;i++)t[i]/=t[8];
  return `matrix3d(${t[0]},${t[3]},0,${t[6]}, ${t[1]},${t[4]},0,${t[7]}, 0,0,1,0, ${t[2]},${t[5]},0,${t[8]})`;
}
// 把四角朝中心收缩 inset(默认 4% → 牌占槽 96%,金色光边露在外面当画框)
function shrink(q, inset=0.04){
  const cx=(q.TL[0]+q.TR[0]+q.BR[0]+q.BL[0])/4, cy=(q.TL[1]+q.TR[1]+q.BR[1]+q.BL[1])/4;
  const f=p=>[p[0]+(cx-p[0])*inset, p[1]+(cy-p[1])*inset];
  return { TL:f(q.TL), TR:f(q.TR), BR:f(q.BR), BL:f(q.BL) };
}

/* ---------- 一张按透视贴入卡槽的真牌 ---------- */
function PerspectiveCard({ quad, src, size }) {
  // size = {w,h} 容器当前像素尺寸;牌随窗口缩放自动重算
  const q = shrink(quad, 0.04);
  const d = [
    q.TL[0]/100*size.w, q.TL[1]/100*size.h,
    q.TR[0]/100*size.w, q.TR[1]/100*size.h,
    q.BR[0]/100*size.w, q.BR[1]/100*size.h,
    q.BL[0]/100*size.w, q.BL[1]/100*size.h,
  ];
  return (
    <div style={{
      position:"absolute", left:0, top:0, width:100, height:100,
      transformOrigin:"0 0", transform:matrix3d(100,100,d),
      borderRadius:14, overflow:"hidden",
      border:"none", outline:"none", background:"transparent", boxShadow:"none",
    }}>
      <img src={src} alt="" style={{
        width:"100%", height:"100%", objectFit:"cover", display:"block",
        border:"none", outline:"none", background:"transparent", boxShadow:"none",
      }}/>
    </div>
  );
}

/* ====================== 需求1-B:三个揭示页 ====================== */
export function TarotReveal({ spread="three_reveal", background, cards=[] }) {
  // spread: "daily_reveal" | "three_reveal" | "five_reveal" (放真牌的揭示页)
  //       或 "daily_select" | "three_select" | "five_select" (选牌页牌背)
  const ref = useRef(null);
  const [size, setSize] = useState({ w:0, h:0 });
  const measure = useCallback(()=>{ if(ref.current){
    setSize({ w:ref.current.clientWidth, h:ref.current.clientHeight });
  }},[]);
  useLayoutEffect(()=>{
    measure();
    const ro = new ResizeObserver(measure);
    if(ref.current) ro.observe(ref.current);
    return ()=>ro.disconnect();
  },[measure]);
  const quads = QUADS[spread] || [];
  return (
    <div style={{ width:"100%", maxWidth:1672, margin:"0 auto" }}>
      {/* 画布锁定 1672:941 —— 百分比坐标相对它,换屏幕不跑偏 */}
      <div ref={ref} style={{
        position:"relative", width:"100%", aspectRatio:"1672 / 941",
        backgroundImage:`url(${background})`, backgroundSize:"cover",
        backgroundPosition:"center", overflow:"hidden",
      }}>
        {quads.map((q,i)=> cards[i] && size.w>0 && (
          <PerspectiveCard key={q.id||i} quad={q} src={cards[i]} size={size}/>
        ))}
      </div>
    </div>
  );
}

/* ====================== 需求1-A:end 结果页 ====================== */
export function ReadingPage({ background, text }) {
  return (
    <div style={{
      position:"fixed", inset:0, height:"100vh", width:"100vw",
      backgroundImage:`url(${background})`, backgroundSize:"cover",
      backgroundPosition:"center", backgroundRepeat:"no-repeat",
      backgroundAttachment:"fixed",            // 背景钉死,不随滚动
    }}>
      <div style={{
        position:"absolute", left:"12%", right:"12%", top:"20%",
        maxHeight:"70vh", overflowY:"auto",     // 文字长就在容器内部滚
        background:"transparent",
        color:"#e8d5a8",                         // 暖金奶白色
        fontSize:18, lineHeight:1.8, padding:"0 8px",
        whiteSpace:"pre-wrap",
      }}>
        {text}
      </div>
    </div>
  );
}

/* ====================== 需求2:导航栏,点任意项回第一页 ======================
   router 无关:传入 onHome 回调即可。TanStack Router 用法见下方示例。 */
export function NavBar({ onHome }) {
  const goHome = onHome || (() => { window.location.href = "/"; }); // 兜底
  const items = ["HOME","ABOUT","HISTORY","CONTACT"];
  return (
    <nav style={{ display:"flex", gap:32, justifyContent:"center", padding:"18px 0" }}>
      {items.map(label=>(
        <button key={label} onClick={goHome} style={{
          background:"none", border:"none", cursor:"pointer",
          color:"#d9b15a", letterSpacing:2, fontSize:15, fontWeight:600,
        }}>{label}</button>
      ))}
    </nav>
  );
}

/* ====================== 示例:怎么拼起来(TanStack Router) ======================
import { useNavigate } from "@tanstack/react-router";
import bgThree from "@/assets/three_cards_reversal.png";
import bgEnd   from "@/assets/end.png";

export default function Demo(){
  const navigate = useNavigate();
  const drawn = ["/cards/the-sun.png","/cards/the-moon.png","/cards/the-star.png"];
  const reading = "你抽到的三张牌讲述了……(AI 返回的长短不一文本)";
  return (<>
    <NavBar onHome={() => navigate({ to: "/" })}/>   {/* 点导航回第一页 */}
    <TarotReveal spread="three_reveal" background={bgThree} cards={drawn}/>
    {/* 揭示后跳转到结果页: <ReadingPage background={bgEnd} text={reading}/> */}
  </>);
}
============================================================= */
