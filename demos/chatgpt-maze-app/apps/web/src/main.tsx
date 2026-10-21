import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Badge, Button, Panel, Metric, NumberField, MazeView, ToolLog, type ToolEntry } from '@maze/ui';
import type { VisibleState } from '@maze/core';
import { askAgent, callTool, getCurrent, isEmbedded, ready, registerWebMcp, subscribe } from './bridge';
import '@maze/ui/style.css';
import './style.css';
function Gallery(){return <div className="gallery"><h1>Wayfinder component library</h1><Panel><h2>Actions</h2><div className="gallery-row"><Button>Primary action</Button><Button variant="secondary">Secondary action</Button><Button variant="ghost">Quiet action</Button><Button disabled>Working…</Button></div></Panel><Panel><h2>Status</h2><div className="gallery-row"><Badge>Neutral</Badge><Badge tone="success">Connected</Badge><Badge tone="accent">Exploring</Badge></div></Panel><Panel><h2>Inputs and metrics</h2><div className="gallery-row"><NumberField label="Rows" value={10} onChange={()=>{}}/><Metric label="Moves" value={42} detail="Every step counts"/></div></Panel></div>;}
function MazeApp(){
 const [state,setState]=useState<VisibleState|undefined>(getCurrent());
 const [rows,setRows]=useState(10),[cols,setCols]=useState(10),[items,setItems]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [entries,setEntries]=useState<ToolEntry[]>([]),[webMcp,setWebMcp]=useState(false);
 useEffect(()=>{
   const unsubscribe=subscribe((result,name)=>{
    if(result._meta?.state){setState(result._meta.state);setNotice('');}
    const d=result.structuredContent;
    setEntries(list=>[...list.slice(-49),{id:Date.now()+Math.random(),name:name==='agent tool'?(d?.moveCount!==undefined?'agent observation':'agent tool'):name,message:String(d?.reason??d?.message??(d?.atExit?'Exit reached. Beautifully done.':d?.position?`At row ${(d.position as any).row}, column ${(d.position as any).col}.`:'Maze ready to explore.')),time:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}),success:!result.isError&&d?.success!==false}]);
   });
   void ready.catch(e=>setError(e.message));
   try{setWebMcp(registerWebMcp());}catch(e){setError(`WebMCP registration failed: ${String(e)}`);}
   return unsubscribe;
 },[]);
 async function start(){setBusy(true);setError('');try{await callTool('start_game',{rows,cols,items});}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}}
 async function solve(){setError('');setBusy(true);try{if(isEmbedded())await askAgent();else setNotice(`In ChatGPT, ask: “Solve my maze ${state?.mazeId} using the maze tools.” Browser agents can also use the registered WebMCP tools here.`);}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}}
 const valid=Number.isInteger(rows)&&Number.isInteger(cols)&&rows>=2&&cols>=2&&rows<=40&&cols<=40;
 const explored=state?Math.round(state.explored/(state.rows*state.cols)*100):0;
 return <div className="shell">
 <header className="topbar"><div className="brand"><span className="brandmark" aria-hidden="true">⌘</span>wayfinder<span style={{fontFamily:'sans-serif',fontSize:9,color:'#929889',marginLeft:5,letterSpacing:'.06em'}}>MAZE LAB</span></div><div className="top-meta"><span>A small adventure in agentic play</span><Badge tone="success">{isEmbedded()?'MCP App':webMcp?'WebMCP active':'Local playground'}</Badge></div></header>
 {new URLSearchParams(location.search).has('gallery')?<Gallery/>:<>
 <div className="hero"><div><span className="chapter">Experiment 001 / The maze</span><h1>A little lost. On purpose.</h1><p>Build a maze. Give your agent the compass.<br/>Watch it find a way through, one tool call at a time.</p></div><Badge tone={state?.atExit?'success':'accent'}>{state?.atExit?'Journey complete':state?'Exploration in progress':'Ready when you are'}</Badge></div>
 {error&&<div className="error" role="alert">{error}</div>}{notice&&<div className="notice" role="status">{notice}</div>}{state?.atExit&&<div className="notice" role="status">Exit reached in {state.moveCount} moves. A path well travelled.</div>}
 <div className="stats"><Metric label="Grid size" value={state?`${state.rows} × ${state.cols}`:'—'} detail={state?`${state.rows*state.cols} places to discover`:'Your next adventure'}/><Metric label="Moves taken" value={state?.moveCount??'00'} detail="One cell. One decision."/><Metric label="Discovered" value={`${explored}%`} detail={state?`${state.explored} of ${state.rows*state.cols} cells revealed`:'The unknown awaits'}/><Metric label="Inventory" value={state?.inventory?state.inventory.replaceAll('_',' '):'Empty'} detail={state?.items?'One item at a time':'Travel light'}/></div>
 <main className="workspace"><Panel><div className="board-header"><span className="board-title"><span style={{color:'#96a384'}}>⊞</span> The maze</span><span className="board-subtitle">{state?`${state.rows}R / ${state.cols}C · FOG OF WAR`:'YOUR UNCHARTED TERRITORY'}</span></div><div className="maze-wrap">{state?<MazeView state={state}/>:<div className="empty-board"><div className="large-symbol">⌖</div><h2>Every path starts somewhere.</h2><p>Choose your dimensions and create a maze.<br/>Your agent will take it from there.</p></div>}</div><div className="board-footer"><span className="legend"><i/>Explorer</span><span className="legend legend-exit"><i/>Exit</span><span className="legend legend-fog"><i/>Unexplored</span><span className="coordinates">{state?`POS (${state.position.row}, ${state.position.col})`:'POS (—, —)'}</span></div></Panel>
 <aside className="sidebar"><Panel><div className="section-head"><h2>Make it your maze</h2><span style={{color:'#9ca18f'}}>⚙</span></div><form className="settings" onSubmit={e=>{e.preventDefault();void start();}}><div className="dimensions"><NumberField label="Rows" value={rows} onChange={setRows}/><span className="times">×</span><NumberField label="Columns" value={cols} onChange={setCols}/></div><div className="presets">{[6,10,20].map(n=><button key={n} type="button" aria-pressed={rows===n&&cols===n} onClick={()=>{setRows(n);setCols(n);}}>{n===6?'A stroll':n===10?'An adventure':'Get lost'} · {n}</button>)}</div><label className="check"><input type="checkbox" checked={items} onChange={e=>setItems(e.target.checked)}/>Add keys, doors & rocks</label><Button className="full" type="submit" disabled={busy||!valid}>{busy?'Working…':state?'Create a new maze ↗':'Create maze ↗'}</Button><p className="hint">2–40 rows and columns. A fresh, connected maze every time. New mazes keep their own progress.</p></form></Panel>
 <div className="agent-card"><h2>✧ &nbsp; Let curiosity lead.</h2><p>Your agent sees only what it discovers. It looks, moves, collects, and learns its way to the exit.</p><Button variant="secondary" disabled={busy||!state||state.atExit} onClick={()=>void solve()}>Ask agent to explore <span aria-hidden="true">↗</span></Button></div>
 <Panel><div className="section-head"><h2>On the trail</h2><span className="tool-caption">TOOL ACTIVITY</span></div><ToolLog entries={entries}/></Panel></aside></main>
 <footer className="bottom"><span>Built on Chrome’s WebMCP maze · Made for curious agents.</span><a href="?gallery">Component library ↗</a></footer>
 </>}
 </div>;
}
createRoot(document.getElementById('root')!).render(<MazeApp/>);
