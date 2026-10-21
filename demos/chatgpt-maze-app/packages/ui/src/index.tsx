import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
export function Button({variant='primary',className='',...props}:ButtonHTMLAttributes<HTMLButtonElement>&{variant?:'primary'|'secondary'|'ghost'}){return <button className={`button button-${variant} ${className}`} {...props}/>;}
export function Badge({children,tone='neutral'}:{children:ReactNode;tone?:'neutral'|'success'|'accent'}){return <span className={`badge badge-${tone}`}>{children}</span>;}
export function Panel({className='',...props}:HTMLAttributes<HTMLElement>){return <section className={`panel ${className}`} {...props}/>;}
export function Metric({label,value,detail}:{label:string;value:ReactNode;detail?:string}){return <div className="metric"><span className="eyebrow">{label}</span><strong>{value}</strong>{detail&&<small>{detail}</small>}</div>;}
export function NumberField({label,value,onChange}:{label:string;value:number;onChange:(n:number)=>void}){return <label className="number-field"><span>{label}</span><input aria-label={label} type="number" min={2} max={40} required value={value} onChange={e=>onChange(e.target.value===''?NaN:Number(e.target.value))}/></label>;}
export type MazeCell={row:number;col:number;walls:Record<string,boolean>;collectible:string|null;blockers:Partial<Record<string,string>>};
export type MazeViewState={rows:number;cols:number;cells:MazeCell[];position:{row:number;col:number};atExit:boolean};
const offsets:Record<string,[number,number,number,number]>={north:[0,0,1,0],south:[0,1,1,1],east:[1,0,1,1],west:[0,0,0,1]};
const itemColor=(s:string)=>s.includes('red')?'#e56b62':s.includes('blue')?'#739be9':s.includes('green')?'#75ad83':'#dba753';
export function MazeView({state}:{state:MazeViewState}){
 const unit=32,pad=14,w=state.cols*unit,h=state.rows*unit;
 return <svg className="maze-svg" viewBox={`0 0 ${w+pad*2} ${h+pad*2}`} role="img" aria-label={`${state.rows} by ${state.cols} maze. Player row ${state.position.row}, column ${state.position.col}${state.atExit?'. Exit reached.':''}`}>
 <defs><pattern id="fog-grid" width={unit} height={unit} patternUnits="userSpaceOnUse"><path d={`M ${unit} 0 L 0 0 0 ${unit}`} fill="none" stroke="#ffffff" strokeOpacity=".045" strokeWidth="1"/><circle cx={unit/2} cy={unit/2} r="1" fill="#ffffff" fillOpacity=".12"/></pattern><filter id="glow"><feGaussianBlur stdDeviation="3"/></filter></defs>
 <g transform={`translate(${pad},${pad})`}><rect width={w} height={h} rx="3" fill="#1c302e"/><rect width={w} height={h} fill="url(#fog-grid)"/>
 {state.cells.map(c=><g key={`${c.row},${c.col}`} transform={`translate(${c.col*unit},${c.row*unit})`}><rect width={unit} height={unit} fill="#e6e6d8"/>{Object.entries(c.walls).filter(([,v])=>v).map(([d])=>{const [x1,y1,x2,y2]=offsets[d];return <line key={d} x1={x1*unit} y1={y1*unit} x2={x2*unit} y2={y2*unit} stroke="#304b43" strokeWidth="2" strokeLinecap="round"/>;})}
 {Object.entries(c.blockers).map(([d,b])=>{const [x1,y1,x2,y2]=offsets[d];return <line key={d} x1={x1*unit+((x2-x1)*5)} y1={y1*unit+((y2-y1)*5)} x2={x2*unit-((x2-x1)*5)} y2={y2*unit-((y2-y1)*5)} stroke={itemColor(b!)} strokeWidth="5"/>;})}
 {c.collectible&&<g fill={itemColor(c.collectible)}><circle cx="13" cy="13" r="4"/><path d="M15 15l7 7m-4-4 3-3" stroke={itemColor(c.collectible)} strokeWidth="2"/></g>}
 {(c.row===state.rows-1&&c.col===state.cols-1)&&<g><rect x="9" y="8" width="14" height="16" rx="3" fill="#a5c589"/><path d="M12 16h8m-3-3 3 3-3 3" stroke="#304b43" strokeWidth="1.8" fill="none"/></g>}
 </g>)}
 <g transform={`translate(${(state.position.col+.5)*unit},${(state.position.row+.5)*unit})`}><circle r="11" fill="#f4b664" opacity=".4" filter="url(#glow)"/><circle r="8" fill="#e8a64c" stroke="#fff2c9" strokeWidth="2"/><circle r="2" fill="#374a36"/></g>
 </g></svg>;
}
export type ToolEntry={id:number;name:string;message:string;time:string;success:boolean};
export function ToolLog({entries}:{entries:ToolEntry[]}){return <ol className="tool-log" aria-label="Tool activity">{entries.length?entries.slice(-8).reverse().map(e=><li key={e.id}><span className={`log-dot ${e.success?'':'log-error'}`}/><div><code>{e.name}</code><p>{e.message}</p></div><time>{e.time}</time></li>):<li className="log-empty">The trail starts with your first tool call.</li>}</ol>;}
