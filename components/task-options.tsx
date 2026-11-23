'use client'
import {useEffect,useRef,useState} from 'react'

type Values={priority:string;category:string}

export function TaskSheet({name,values,groups,save,close}:{name:string;values:Values;groups:string[];save:(v:Values)=>void;close:()=>void}){
  const [priority,setPriority]=useState(values.priority)
  const [category,setCategory]=useState(values.category)
  const [custom,setCustom]=useState(values.category!==''&&!groups.includes(values.category))
  const [closing,setClosing]=useState(false)
  const sheet=useRef<HTMLDivElement>(null)
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null)

  useEffect(()=>{
    sheet.current?.focus({preventScroll:true})
    const previous=document.body.style.overflow
    document.body.style.overflow='hidden'
    return()=>{
      document.body.style.overflow=previous
      if(timer.current)clearTimeout(timer.current)
    }
  },[])

  const reduce=typeof window!=='undefined'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches

  function requestClose(after?:()=>void){
    if(closing)return
    setClosing(true)
    timer.current=setTimeout(()=>{if(after)after();else close()},reduce?0:230)
  }

  return <div
    className={'sheet-backdrop'+(closing?' closing':'')}
    onClick={()=>requestClose()}
  >
    <div
      className="sheet"
      ref={sheet}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={'Options for '+name}
      onClick={e=>e.stopPropagation()}
      onKeyDown={e=>{if(e.key==='Escape')requestClose()}}
    >
      <div className="grabber" aria-hidden="true"/>
      <div className="sheet-head"><strong>Task details</strong><button type="button" onClick={()=>requestClose()}>Cancel</button></div>
      <p className="sheet-task">{name}</p>
      <form onSubmit={e=>{
        e.preventDefault()
        requestClose(()=>save({priority,category:category.trim()}))
      }}>
        <div className="field">
          <label htmlFor="sheet-priority"><span className={'priority-dot'+(priority?' '+priority.toLowerCase():'')} aria-hidden="true"/>Priority</label>
          <select id="sheet-priority" value={priority} onChange={e=>setPriority(e.target.value)}>
            <option value="">None</option><option value="Low">Low</option><option value="Medium">Medium</option><option value="High">High</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="sheet-category">Category</label>
          <select id="sheet-category" value={custom?'__new':category} onChange={e=>{
            if(e.target.value==='__new'){setCustom(true);setCategory('')}
            else{setCustom(false);setCategory(e.target.value)}
          }}>
            <option value="">None</option>
            {groups.map(g=><option key={g} value={g}>{g}</option>)}
            <option value="__new">New category…</option>
          </select>
          {custom&&<input className="new-cat" aria-label="New category name" placeholder="Category name" value={category} onChange={e=>setCategory(e.target.value)} maxLength={40} required autoFocus/>}
        </div>
        <button className="sheet-done" disabled={custom&&!category.trim()}>Done</button>
      </form>
    </div>
  </div>
}
