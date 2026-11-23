'use client'
import {useCallback,useEffect,useRef,useState} from 'react'
import {ArrowUp,Check,ChevronRight,Layers2,Plus} from 'lucide-react'
import {TaskSheet} from './task-options'
import {supabase} from '@/lib/supabase'

type Task={id:string;text:string;priority:string;category:string}
type Row={id:string;text:string;created_at:number;priority:string|null;group_name:string|null}
const key='daylist.v1'
const POLL_MS=5000

function fromRow(r:Row):Task{return{id:r.id,text:r.text,priority:r.priority??'',category:r.group_name??''}}
function toRow(t:Task):Omit<Row,'created_at'>{return{id:t.id,text:t.text,priority:t.priority||null,group_name:t.category||null}}

function buzz(){try{if(typeof navigator!=='undefined'&&'vibrate' in navigator)navigator.vibrate(12)}catch{}}

function TaskRow({task,onOpen,onComplete}:{task:Task;onOpen:()=>void;onComplete:()=>void}){
  const [done,setDone]=useState(false)
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null)
  useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current)},[])
  function complete(){
    if(done)return
    setDone(true)
    buzz()
    timer.current=setTimeout(onComplete,270)
  }
  return <div className={'task-item'+(done?' done':'')}>
    <button type="button" className="check" aria-label={'Complete '+task.text} onClick={complete}>
      <Check size={16} strokeWidth={3} aria-hidden="true"/>
    </button>
    <button type="button" className="task-front" aria-label={'Edit '+task.text} onClick={onOpen}>
      <span className="task-main"><span className="task-name">{task.text}</span>{task.category&&<span className="task-cat">{task.category}</span>}</span>
      <span className={'priority-dot'+(task.priority?' '+task.priority.toLowerCase():'')} aria-hidden="true"/>
      <ChevronRight className="task-chevron" size={17} aria-hidden="true"/>
    </button>
  </div>
}

export function Daylist(){
  const [tasks,setTasks]=useState<Task[]>([]),[grouped,setGrouped]=useState(false),[ready,setReady]=useState(false),[text,setText]=useState(''),[editing,setEditing]=useState<string|null>(null),[closed,setClosed]=useState<string[]>([]),[error,setError]=useState(''),[notice,setNotice]=useState('')
  const input=useRef<HTMLInputElement>(null)
  const tasksRef=useRef<Task[]>([])
  const writing=useRef(0)

  // Keep the ref in sync so async callbacks always see current tasks.
  useEffect(()=>{tasksRef.current=tasks},[tasks])

  // Load local cache instantly, then replace with the server copy.
  const pull=useCallback(async()=>{
    if(writing.current>0)return
    const {data,error:err}=await supabase.from('tasks').select('*').order('created_at',{ascending:true})
    if(err){setError('Sync unavailable — showing this device’s copy.');return}
    if(!data)return
    const next=(data as Row[]).map(fromRow)
    setTasks(prev=>JSON.stringify(prev)===JSON.stringify(next)?prev:next)
    setError('')
  },[])

  useEffect(()=>{
    try{
      const raw=localStorage.getItem(key)
      if(raw){
        const data=JSON.parse(raw)
        if(!Array.isArray(data.tasks)||!data.tasks.every((t:Task)=>t&&['id','text','priority','category'].every(k=>typeof t[k as keyof Task]==='string')))throw Error()
        setTasks(data.tasks)
        setGrouped(data.grouped===true)
        if(Array.isArray(data.closed))setClosed(data.closed.filter((s:unknown)=>typeof s==='string'))
      }
    }catch{setError('Local storage is unavailable or could not be read.')}
    setReady(true)
    void pull()
    const timer=setInterval(()=>{void pull()},POLL_MS)
    return()=>clearInterval(timer)
  },[pull])

  // Keep view preferences on this device only.
  useEffect(()=>{if(ready&&!error)try{localStorage.setItem(key,JSON.stringify({tasks,grouped,closed}))}catch{}},[tasks,grouped,closed,ready,error])
  useEffect(()=>{if(!notice)return;const t=setTimeout(()=>setNotice(''),2200);return()=>clearTimeout(t)},[notice])

  const categories=[...new Set(tasks.map(t=>t.category))],sections=grouped?categories:['']
  const active=tasks.find(t=>t.id===editing)

  async function insert(task:Task){
    writing.current++
    const {error:err}=await supabase.from('tasks').insert({...toRow(task),created_at:Date.now()})
    writing.current--
    if(err)setError('Could not sync — change saved on this device.')
    else setError('')
  }
  async function remove(id:string){
    writing.current++
    const {error:err}=await supabase.from('tasks').delete().eq('id',id)
    writing.current--
    if(err)setError('Could not sync — change saved on this device.')
    else setError('')
  }
  async function update(task:Task){
    writing.current++
    const {error:err}=await supabase.from('tasks').update(toRow(task)).eq('id',task.id)
    writing.current--
    if(err)setError('Could not sync — change saved on this device.')
    else setError('')
  }

  function complete(id:string){setTasks(ts=>ts.filter(t=>t.id!==id));setEditing(null);setNotice('Task completed');void remove(id)}
  function close(){const id=editing;setEditing(null);if(id)document.getElementById('task-'+id)?.focus({preventScroll:true})}

  return <main data-ready={ready} aria-label="Tasks">
    <form className="quick-entry" onSubmit={e=>{
      e.preventDefault()
      if(!ready||!text.trim())return
      const task:Task={id:crypto.randomUUID(),text:text.trim(),category:'',priority:''}
      setTasks(ts=>[task,...ts])
      setClosed(cs=>cs.filter(c=>c!==''))
      setText('')
      setNotice('Task added')
      input.current?.focus()
      void insert(task)
    }}>
      <Plus size={19} aria-hidden="true"/>
      <input ref={input} required maxLength={500} aria-label="New task" placeholder="Add a task…" value={text} onChange={e=>setText(e.target.value)} enterKeyHint="done" onKeyDown={e=>{if(e.key==='Enter'&&(e.nativeEvent.isComposing||e.keyCode===229))e.preventDefault()}}/>
      <button aria-label="Add task" disabled={!ready||!text.trim()}><ArrowUp size={19}/></button>
    </form>
    <div className="list-bar"><h1>Tasks <small>{tasks.length}</small></h1><button className="group" role="switch" aria-label="Group by category" aria-checked={grouped} onClick={()=>{setGrouped(!grouped);setEditing(null)}}><Layers2 size={15}/>Group<i className={grouped?'toggle on':'toggle'}/></button></div>
    <section aria-label="Task list">
      {!tasks.length&&<p className="empty">No tasks.</p>}
      {sections.map(s=>{
        const items=tasks.filter(t=>!grouped||t.category===s),collapsed=grouped&&closed.includes(s)
        return <div key={s}>
          {grouped&&<button className="group-title" aria-expanded={!collapsed} onClick={()=>{setEditing(null);setClosed(cs=>cs.includes(s)?cs.filter(c=>c!==s):[...cs,s])}}><ChevronRight size={14}/><strong>{s||'Uncategorized'}</strong><span>{items.length} {items.length===1?'task':'tasks'}</span></button>}
          {!collapsed&&<ul>{items.map(t=><li key={t.id} id={'task-'+t.id}><TaskRow task={t} onOpen={()=>setEditing(t.id)} onComplete={()=>complete(t.id)}/></li>)}</ul>}
        </div>
      })}
    </section>
    {error&&<p role="alert">{error}</p>}
    {active&&<TaskSheet name={active.text} values={{priority:active.priority,category:active.category}} groups={categories.filter(Boolean)} close={close} save={v=>{
      const next={...active,priority:v.priority,category:v.category}
      setTasks(ts=>ts.map(row=>row.id===active.id?next:row))
      setEditing(null)
      setNotice('Task updated')
      void update(next)
    }}/>}
    {notice&&<div className="toast" role="status" key={notice}><Check size={15} strokeWidth={2.6}/>{notice}</div>}
  </main>
}
