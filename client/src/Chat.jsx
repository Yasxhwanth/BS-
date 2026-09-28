import { useState, useEffect, useRef } from 'react';
import { sendChat, getChatHistory } from './api';
import { Bot, SendAlt, Renew } from '@carbon/icons-react';

const SUGGESTIONS = [
  'What is the current production efficiency?',
  'Are there any maintenance issues?',
  'Show me sensor anomalies',
  'Which process has the most defects?',
  'What are the active alerts?',
  'Predict next machine failure',
];

export default function Chat({ user }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [convId, setConvId]     = useState(() => `conv_${Date.now()}`);
  const bottomRef = useRef(null);

  useEffect(() => {
    // Add welcome message
    setMessages([{
      _id: 'welcome',
      role: 'assistant',
      content: `Hello ${user?.name || 'there'}! I'm your Manufacturing AI Assistant. I have full context of your ontology, sensors, and plant data. Ask me anything about your manufacturing operations — maintenance, quality, production efficiency, or alerts.`,
      createdAt: new Date().toISOString(),
      meta: { intent: 'welcome', confidence: 100 },
    }]);
  }, [user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput('');

    const userMsg = { _id: Date.now(), role: 'user', content: msg, createdAt: new Date().toISOString() };
    setMessages(ms => [...ms, userMsg]);
    setLoading(true);

    try {
      const { data } = await sendChat({ message: msg, conversationId: convId });
      setConvId(data.data.conversationId);
      setMessages(ms => [...ms, {
        _id: data.data.message._id,
        role: 'assistant',
        content: data.data.content,
        createdAt: data.data.message.createdAt,
        meta: { intent: data.data.intent, confidence: data.data.confidence },
      }]);
    } catch {
      setMessages(ms => [...ms, {
        _id: Date.now() + 1,
        role: 'assistant',
        content: 'Error: Unable to process request. Please ensure the backend server is running.',
        createdAt: new Date().toISOString(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 48px)' }}>
      <div className="page-header">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Bot size={24} style={{ color: 'var(--teal-40)' }} />
          <span>AI Assistant</span>
          <div className="chat-ai-badge" style={{ fontSize: 13 }}>Ontology-Aware</div>
        </h1>
        <p>Ask questions about your manufacturing plant — powered by your knowledge graph</p>
      </div>

      {/* Suggestions */}
      <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
        <div className="chat-suggestions">
          {SUGGESTIONS.map(s => (
            <button key={s} className="suggestion-chip" onClick={() => send(s)}>{s}</button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="chat-messages" style={{ flex: 1 }}>
        {messages.map(msg => (
          <div key={msg._id} className={`chat-msg ${msg.role}`}>
            <div className={`chat-avatar ${msg.role === 'assistant' ? 'ai' : 'user'}`}>
              {msg.role === 'assistant' ? 'AI' : (user?.name?.[0] || 'U')}
            </div>
            <div>
              <div className="chat-bubble">{msg.content}</div>
              <div className="chat-meta">
                {msg.meta?.intent && msg.role === 'assistant' && (
                  <span style={{ color: 'var(--teal-40)', marginRight: 8 }}>
                    Intent: {msg.meta.intent} · {msg.meta.confidence}% confidence
                  </span>
                )}
                {new Date(msg.createdAt).toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="chat-msg assistant">
            <div className="chat-avatar ai">AI</div>
            <div>
              <div className="chat-bubble" style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--blue-40)', animation: `pulse 1s ${i * 0.2}s infinite` }} />
                  ))}
                </div>
                Analyzing your plant data…
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="chat-input-area">
        <input
          className="chat-input"
          placeholder="Ask about maintenance, quality, sensors, production efficiency…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          disabled={loading}
        />
        <button className="btn btn-primary" onClick={() => send()} disabled={loading || !input.trim()} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {loading ? <span className="spinner" style={{ width: 16, height: 16 }} /> : <><SendAlt size={16} /> Send</>}
        </button>
        <button className="btn btn-secondary btn-sm" title="New conversation"
          onClick={() => { setConvId(`conv_${Date.now()}`); setMessages([]); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Renew size={14} /> New
        </button>
      </div>
    </div>
  );
}
