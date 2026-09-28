import { useState, useEffect, useRef } from 'react';
import { sendChat, getChatStatus, saveGeminiConfig } from './api';
import { Bot, SendAlt, Renew, Settings, Checkmark, Close, Flash, WarningAlt } from '@carbon/icons-react';

const SUGGESTIONS = [
  'Analyze overall plant OEE and bottlenecks',
  'Assess vibration sensor anomaly risk',
  'How to optimize Assembly Process throughput?',
  'Predict failure probability for critical machines',
  'Correlate worker shifts with defect rates',
];

function FormattedMessage({ content }) {
  if (!content) return null;
  const lines = content.split('\n');
  const out = [];
  let listItems = [];
  let k = 0;

  const flushList = () => {
    if (!listItems.length) return;
    out.push(
      <ul key={`ul-${k++}`} style={{ margin:'4px 0 10px 16px', paddingLeft:0 }}>
        {listItems.map((li, i) => <li key={i} style={{ marginBottom:3, lineHeight:1.5 }}>{inline(li)}</li>)}
      </ul>
    );
    listItems = [];
  };

  const inline = (str) => {
    const parts = [];
    const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
    let last = 0, m, i = 0;
    while ((m = re.exec(str)) !== null) {
      if (m.index > last) parts.push(str.slice(last, m.index));
      const t = m[0];
      if (t.startsWith('**')) parts.push(<strong key={i++} style={{ color:'var(--blue-40)' }}>{t.slice(2,-2)}</strong>);
      else parts.push(<code key={i++} style={{ background:'var(--bg-tertiary)', padding:'1px 5px', fontSize:'0.9em', color:'var(--teal-40)' }}>{t.slice(1,-1)}</code>);
      last = m.index + t.length;
    }
    if (last < str.length) parts.push(str.slice(last));
    return parts.length ? parts : str;
  };

  for (const line of lines) {
    const t = line.trim();
    if (!t) { flushList(); continue; }
    if (t.startsWith('* ') || t.startsWith('- ') || t.startsWith('• ') || /^\d+\.\s/.test(t)) {
      listItems.push(t.replace(/^(\*|-|•|\d+\.)\s+/, ''));
      continue;
    }
    flushList();
    if (t.startsWith('### ')) out.push(<h4 key={k++} style={{ margin:'12px 0 4px', fontSize:13, fontWeight:600, color:'var(--text-primary)', textTransform:'uppercase', letterSpacing:'0.5px' }}>{inline(t.slice(4))}</h4>);
    else if (t.startsWith('## ') || t.startsWith('# ')) out.push(<h3 key={k++} style={{ margin:'12px 0 6px', fontSize:14, fontWeight:600, color:'var(--text-primary)' }}>{inline(t.replace(/^#+\s/,''))}</h3>);
    else out.push(<p key={k++} style={{ margin:'0 0 6px', lineHeight:1.6 }}>{inline(t)}</p>);
  }
  flushList();
  return <div>{out}</div>;
}

// --- Carbon: strict component styles ---
const C = {
  headerBar: {
    padding: '0 32px', height: 48, display:'flex', alignItems:'center', justifyContent:'space-between',
    background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0,
  },
  label: {
    fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.8px', color:'var(--text-helper)',
  },
  tile: {
    background:'var(--bg-secondary)', border:'1px solid var(--border-subtle)', borderRadius:0,
  },
  tag: (color) => ({
    display:'inline-flex', alignItems:'center', gap:4, padding:'2px 8px',
    fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.5px',
    background:`${color}18`, border:`1px solid ${color}55`, color,
  }),
};

export default function Chat({ user }) {
  const [messages, setMessages]   = useState([]);
  const [input, setInput]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [convId, setConvId]       = useState(() => `conv_${Date.now()}`);
  const [aiStatus, setAiStatus]   = useState({ configured: false, model:'gemini-1.5-flash' });
  const [showCfg, setShowCfg]     = useState(false);
  const [apiKey, setApiKey]       = useState('');
  const [model, setModel]         = useState('gemini-1.5-flash');
  const [cfgSaving, setCfgSaving] = useState(false);
  const [cfgMsg, setCfgMsg]       = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    getChatStatus().then(r => { if (r.data?.success) { setAiStatus(r.data.data); if (r.data.data.model) setModel(r.data.data.model); } }).catch(() => {});
  }, []);

  useEffect(() => {
    setMessages([{
      _id: 'welcome', role:'assistant',
      content: `Hello ${user?.name||'there'}! I'm your Manufacturing AI Copilot — grounded in your live Knowledge Graph, sensor telemetry, and plant alerts.\n\nAsk me about maintenance schedules, sensor anomalies, OEE optimization, or workforce management.`,
      createdAt: new Date().toISOString(),
      meta: { intent:'welcome', confidence:100, model: aiStatus.configured?(aiStatus.model||'gemini-1.5-flash'):'simulated-engine', source: aiStatus.configured?'gemini':'simulation' },
    }]);
  }, [user, aiStatus.configured]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:'smooth' }); }, [messages]);

  const send = async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput('');
    setMessages(ms => [...ms, { _id:Date.now(), role:'user', content:msg, createdAt:new Date().toISOString() }]);
    setLoading(true);
    try {
      const { data } = await sendChat({ message:msg, conversationId:convId });
      setConvId(data.data.conversationId);
      setMessages(ms => [...ms, { _id:data.data.message._id, role:'assistant', content:data.data.content, createdAt:data.data.message.createdAt, meta:{ intent:data.data.intent, confidence:data.data.confidence, model:data.data.model, source:data.data.source } }]);
    } catch {
      setMessages(ms => [...ms, { _id:Date.now()+1, role:'assistant', content:'Error: Unable to reach AI service. Check that the backend server is running.', createdAt:new Date().toISOString() }]);
    } finally { setLoading(false); }
  };

  const saveCfg = async (e) => {
    e.preventDefault();
    if (!apiKey.trim()) return;
    setCfgSaving(true); setCfgMsg(null);
    try {
      const r = await saveGeminiConfig({ apiKey:apiKey.trim(), model });
      if (r.data?.success) { setAiStatus(r.data.data); setCfgMsg({ ok:true, text:'Gemini API key saved.' }); setTimeout(() => { setShowCfg(false); setCfgMsg(null); }, 1400); }
    } catch (err) { setCfgMsg({ ok:false, text:err.response?.data?.message||'Failed to save config.' }); }
    finally { setCfgSaving(false); }
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'calc(100vh - 48px)', background:'var(--bg-primary)' }}>

      {/* ── Carbon Header bar ── */}
      <div style={C.headerBar}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <Bot size={20} style={{ color:'var(--blue-40)' }}/>
          <div>
            <div style={{ fontSize:14, fontWeight:600, color:'var(--text-primary)', lineHeight:1.2 }}>AI Assistant</div>
            <div style={{ ...C.label, fontSize:10 }}>Manufacturing Intelligence Copilot</div>
          </div>
          {aiStatus.configured
            ? <div onClick={() => setShowCfg(true)} title="Click to configure" role="button" style={{ ...C.tag('var(--teal-40)'), cursor:'pointer' }}>
                <Flash size={11}/> Gemini · {aiStatus.model||'Flash'}
              </div>
            : <div style={C.tag('var(--support-warning)')}>
                <WarningAlt size={11}/> Simulated Engine
              </div>
          }
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowCfg(true)}
            style={{ display:'inline-flex', alignItems:'center', gap:6, borderRadius:0 }}>
            <Settings size={14}/> {aiStatus.configured ? 'Gemini Config' : 'Connect Gemini'}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => { setConvId(`conv_${Date.now()}`); setMessages([]); }}
            style={{ display:'inline-flex', alignItems:'center', gap:6, borderRadius:0 }}>
            <Renew size={14}/> New Chat
          </button>
        </div>
      </div>

      {/* ── Suggestion chips (Carbon tag row) ── */}
      <div style={{ display:'flex', gap:4, flexWrap:'wrap', padding:'8px 32px', background:'var(--bg-secondary)', borderBottom:'1px solid var(--border-subtle)', flexShrink:0 }}>
        <span style={{ ...C.label, alignSelf:'center', marginRight:4, whiteSpace:'nowrap' }}>Try:</span>
        {SUGGESTIONS.map(s => (
          <button key={s} onClick={() => send(s)}
            style={{ background:'var(--bg-primary)', border:'1px solid var(--border-subtle)', color:'var(--text-secondary)', fontSize:12, padding:'4px 10px', cursor:'pointer', borderRadius:0, transition:'all 0.15s', whiteSpace:'nowrap' }}
            onMouseEnter={e => { e.target.style.borderColor='var(--blue-60)'; e.target.style.color='var(--blue-40)'; }}
            onMouseLeave={e => { e.target.style.borderColor='var(--border-subtle)'; e.target.style.color='var(--text-secondary)'; }}
          >{s}</button>
        ))}
      </div>

      {/* ── Messages ── */}
      <div style={{ flex:1, overflowY:'auto', padding:'24px 32px', display:'flex', flexDirection:'column', gap:0 }}>
        {messages.map(msg => {
          const isAI = msg.role === 'assistant';
          return (
            <div key={msg._id} style={{ display:'flex', gap:12, marginBottom:24, flexDirection:isAI?'row':'row-reverse' }}>
              {/* Avatar — Carbon style square */}
              <div style={{
                width:32, height:32, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center',
                background: isAI ? (msg.meta?.source==='gemini'?'var(--teal-60)':'var(--blue-60)') : 'var(--bg-tertiary)',
                color:'#fff', fontSize:12, fontWeight:700, fontFamily:'IBM Plex Mono,monospace',
                border:'1px solid var(--border-strong)',
              }}>
                {isAI ? (msg.meta?.source==='gemini'?'G':'AI') : (user?.name?.[0]?.toUpperCase()||'U')}
              </div>

              <div style={{ flex:1, maxWidth:'78%' }}>
                {/* Bubble — flat Carbon tile */}
                <div style={{
                  ...C.tile,
                  padding:'12px 16px',
                  background: isAI ? 'var(--bg-secondary)' : 'var(--bg-tertiary)',
                  borderLeft: isAI ? '2px solid var(--blue-60)' : 'none',
                  fontSize:13, lineHeight:1.6, color:'var(--text-primary)',
                }}>
                  {isAI ? <FormattedMessage content={msg.content}/> : msg.content}
                </div>
                {/* Meta row */}
                <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:4, padding:'0 2px' }}>
                  {isAI && msg.meta?.source && (
                    <span style={{ ...C.label, fontSize:10, color: msg.meta.source==='gemini'?'var(--teal-40)':'var(--blue-40)' }}>
                      {msg.meta.source==='gemini' ? (msg.meta.model||'Gemini') : 'Simulated'}
                    </span>
                  )}
                  {isAI && msg.meta?.intent && msg.meta.intent !== 'welcome' && (
                    <span style={{ fontSize:10, color:'var(--text-helper)' }}>· {msg.meta.intent} ({msg.meta.confidence||95}%)</span>
                  )}
                  <span style={{ fontSize:10, color:'var(--text-helper)', marginLeft:'auto' }}>
                    {new Date(msg.createdAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        {/* Thinking indicator */}
        {loading && (
          <div style={{ display:'flex', gap:12, marginBottom:24 }}>
            <div style={{ width:32, height:32, flexShrink:0, background:'var(--teal-60)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:12, fontWeight:700, border:'1px solid var(--border-strong)' }}>G</div>
            <div style={{ ...C.tile, padding:'12px 16px', display:'flex', alignItems:'center', gap:10, fontSize:13, color:'var(--text-helper)' }}>
              <div style={{ display:'flex', gap:4 }}>
                {[0,1,2].map(i => <div key={i} style={{ width:5, height:5, borderRadius:'50%', background:'var(--blue-40)', animation:`pulse 1s ${i*0.2}s infinite` }}/>)}
              </div>
              Analyzing your ontology and telemetry…
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {/* ── Input area — Carbon text input style ── */}
      <div style={{ flexShrink:0, borderTop:'2px solid var(--blue-60)', background:'var(--bg-secondary)', padding:'12px 32px', display:'flex', gap:0 }}>
        <input
          value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key==='Enter' && !e.shiftKey && send()}
          placeholder="Ask about maintenance, OEE, sensors, quality, bottlenecks…"
          disabled={loading}
          style={{
            flex:1, background:'var(--bg-primary)', border:'none', borderBottom:'none',
            padding:'12px 16px', fontSize:14, color:'var(--text-primary)',
            fontFamily:'IBM Plex Sans,sans-serif', outline:'none',
            borderRight:'1px solid var(--border-strong)',
          }}
        />
        <button className="btn btn-primary" onClick={() => send()} disabled={loading || !input.trim()}
          style={{ borderRadius:0, padding:'12px 20px', display:'inline-flex', alignItems:'center', gap:6 }}>
          {loading ? <span className="spinner" style={{width:14,height:14}}/> : <><SendAlt size={16}/> Send</>}
        </button>
      </div>

      {/* ── Gemini Config Modal — Carbon Modal style ── */}
      {showCfg && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}
          onClick={() => setShowCfg(false)}>
          <div style={{ ...C.tile, width:'100%', maxWidth:480, boxShadow:'0 16px 48px rgba(0,0,0,0.7)', overflow:'hidden' }}
            onClick={e => e.stopPropagation()}>
            {/* Modal header — Carbon pattern */}
            <div style={{ background:'var(--bg-tertiary)', padding:'16px 20px', borderBottom:'1px solid var(--border-subtle)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <Flash size={18} style={{ color:'var(--teal-40)' }}/>
                <span style={{ fontSize:14, fontWeight:600, color:'var(--text-primary)' }}>Configure Google Gemini AI</span>
              </div>
              <button onClick={() => setShowCfg(false)} style={{ background:'none', border:'none', color:'var(--text-secondary)', cursor:'pointer', display:'flex', padding:4 }}
                onMouseEnter={e => e.currentTarget.style.background='var(--bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background='none'}>
                <Close size={18}/>
              </button>
            </div>

            <div style={{ padding:20 }}>
              <p style={{ fontSize:13, color:'var(--text-secondary)', marginBottom:20, lineHeight:1.5 }}>
                Connect a Gemini API key to enable contextual AI responses grounded in your plant's knowledge graph and live sensor data.
              </p>

              <form onSubmit={saveCfg}>
                <div style={{ marginBottom:16 }}>
                  <label style={{ display:'block', ...C.label, marginBottom:6 }}>Gemini API Key</label>
                  <input type="password" className="form-input" placeholder="AIzaSy…"
                    value={apiKey} onChange={e => setApiKey(e.target.value)} autoFocus/>
                  <p style={{ fontSize:11, color:'var(--text-helper)', marginTop:4 }}>
                    Get a free key at{' '}
                    <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" style={{ color:'var(--blue-40)' }}>Google AI Studio</a>
                  </p>
                </div>

                <div style={{ marginBottom:20 }}>
                  <label style={{ display:'block', ...C.label, marginBottom:6 }}>Model</label>
                  <select className="form-select" value={model} onChange={e => setModel(e.target.value)}>
                    <option value="gemini-3.8-flash">gemini-3.8-flash (Recommended)</option>
                    <option value="gemini-flash-latest">gemini-flash-latest (Auto-update)</option>
                    <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                    <option value="gemini-3.1-pro-preview">gemini-3.1-pro-preview (Deep reasoning)</option>
                  </select>
                </div>

                {cfgMsg && (
                  <div style={{ padding:'10px 14px', marginBottom:16, borderLeft:`3px solid ${cfgMsg.ok?'var(--support-success)':'var(--support-error)'}`, background:'var(--bg-primary)', border:`1px solid ${cfgMsg.ok?'var(--support-success)':'var(--support-error)'}`, display:'flex', alignItems:'center', gap:8, fontSize:13, color:cfgMsg.ok?'var(--support-success)':'var(--support-error)' }}>
                    {cfgMsg.ok ? <Checkmark size={14}/> : <Close size={14}/>}
                    {cfgMsg.text}
                  </div>
                )}

                {/* Carbon Modal footer */}
                <div style={{ display:'flex', justifyContent:'flex-end', gap:0, borderTop:'1px solid var(--border-subtle)', paddingTop:16, marginTop:4 }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowCfg(false)} style={{ borderRadius:0 }}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={cfgSaving || !apiKey.trim()} style={{ borderRadius:0, display:'inline-flex', alignItems:'center', gap:6, marginLeft:1 }}>
                    {cfgSaving ? <span className="spinner" style={{width:12,height:12}}/> : <Checkmark size={14}/>} Save & Connect
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
