import { useState, useEffect, useRef } from 'react';
import { sendChat, getChatStatus, saveGeminiConfig } from './api';
import { Bot, SendAlt, Renew, Settings, Checkmark, Close, Flash, WarningAlt } from '@carbon/icons-react';

const SUGGESTIONS = [
  'Analyze overall plant OEE and bottlenecks',
  'Assess vibration sensor anomaly risk on Process nodes',
  'How can we optimize Assembly Process throughput?',
  'Predict failure probability for critical machines',
  'Correlate worker shifts with defect rates',
  'Explain graph relationships between sensors and products',
];

// Lightweight Markdown & Inline Formatter for Gemini Responses
function FormattedMessage({ content }) {
  if (!content) return null;

  const lines = content.split('\n');
  const elements = [];
  let listItems = [];
  let key = 0;

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`ul-${key++}`} style={{ margin: '6px 0 10px 20px', paddingLeft: 0, listStyleType: 'disc' }}>
          {listItems.map((li, idx) => (
            <li key={idx} style={{ marginBottom: 4, lineHeight: 1.5 }}>{renderInline(li)}</li>
          ))}
        </ul>
      );
      listItems = [];
    }
  };

  const renderInline = (str) => {
    const parts = [];
    const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
    let match;
    let lastIndex = 0;
    let idx = 0;

    while ((match = regex.exec(str)) !== null) {
      if (match.index > lastIndex) {
        parts.push(str.substring(lastIndex, match.index));
      }
      const token = match[0];
      if (token.startsWith('**') && token.endsWith('**')) {
        parts.push(
          <strong key={idx++} style={{ color: 'var(--blue-40)', fontWeight: 600 }}>
            {token.slice(2, -2)}
          </strong>
        );
      } else if (token.startsWith('`') && token.endsWith('`')) {
        parts.push(
          <code
            key={idx++}
            style={{
              background: 'rgba(255,255,255,0.08)',
              padding: '2px 6px',
              borderRadius: 3,
              fontSize: '0.9em',
              color: 'var(--teal-40)',
            }}
          >
            {token.slice(1, -1)}
          </code>
        );
      }
      lastIndex = match.index + token.length;
    }
    if (lastIndex < str.length) {
      parts.push(str.substring(lastIndex));
    }
    return parts.length > 0 ? parts : str;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      flushList();
      continue;
    }

    // Bullet list items
    if (trimmed.startsWith('* ') || trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
      listItems.push(trimmed.replace(/^(\*|-|•)\s+/, ''));
      continue;
    }

    // Numbered list items
    if (/^\d+\.\s+/.test(trimmed)) {
      listItems.push(trimmed.replace(/^\d+\.\s+/, ''));
      continue;
    }

    flushList();

    // Headers
    if (trimmed.startsWith('### ')) {
      elements.push(
        <h4 key={key++} style={{ margin: '12px 0 6px 0', color: 'var(--text-primary)', fontSize: 14, fontWeight: 600 }}>
          {renderInline(trimmed.replace(/^###\s+/, ''))}
        </h4>
      );
    } else if (trimmed.startsWith('## ') || trimmed.startsWith('# ')) {
      elements.push(
        <h3 key={key++} style={{ margin: '14px 0 8px 0', color: 'var(--text-primary)', fontSize: 15, fontWeight: 600 }}>
          {renderInline(trimmed.replace(/^#+\s+/, ''))}
        </h3>
      );
    } else {
      elements.push(
        <p key={key++} style={{ margin: '0 0 8px 0', lineHeight: 1.6 }}>
          {renderInline(trimmed)}
        </p>
      );
    }
  }
  flushList();

  return <div>{elements}</div>;
}

export default function Chat({ user }) {
  const [messages, setMessages]       = useState([]);
  const [input, setInput]             = useState('');
  const [loading, setLoading]         = useState(false);
  const [convId, setConvId]           = useState(() => `conv_${Date.now()}`);
  const [aiStatus, setAiStatus]       = useState({ configured: false, model: 'gemini-1.5-flash' });
  const [showConfig, setShowConfig]   = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [modelSelect, setModelSelect] = useState('gemini-1.5-flash');
  const [configSaving, setConfigSaving] = useState(false);
  const [configMsg, setConfigMsg]     = useState(null);
  const bottomRef = useRef(null);

  // Load AI configuration status
  useEffect(() => {
    getChatStatus()
      .then(res => {
        if (res.data?.success) {
          setAiStatus(res.data.data);
          if (res.data.data.model) setModelSelect(res.data.data.model);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    // Welcome message
    const isGemini = aiStatus.configured;
    setMessages([{
      _id: 'welcome',
      role: 'assistant',
      content: `Hello ${user?.name || 'there'}! I'm your Manufacturing AI Copilot, powered by Google Gemini and grounded in your live Knowledge Graph (Ontology), telemetry, and plant alerts.\n\nAsk me anything about maintenance schedules, sensor anomalies, OEE optimization, or workforce management!`,
      createdAt: new Date().toISOString(),
      meta: {
        intent: 'welcome',
        confidence: 100,
        model: isGemini ? (aiStatus.model || 'gemini-1.5-flash') : 'simulated-engine',
        source: isGemini ? 'gemini' : 'simulation',
      },
    }]);
  }, [user, aiStatus.configured]);

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
        meta: {
          intent: data.data.intent,
          confidence: data.data.confidence,
          model: data.data.model,
          source: data.data.source,
        },
      }]);
    } catch {
      setMessages(ms => [...ms, {
        _id: Date.now() + 1,
        role: 'assistant',
        content: 'Error: Unable to reach AI service. Please verify that the backend server is running.',
        createdAt: new Date().toISOString(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    if (!apiKeyInput.trim()) return;
    setConfigSaving(true);
    setConfigMsg(null);

    try {
      const res = await saveGeminiConfig({ apiKey: apiKeyInput.trim(), model: modelSelect });
      if (res.data?.success) {
        setAiStatus(res.data.data);
        setConfigMsg({ type: 'success', text: 'Gemini API Key configured successfully!' });
        setTimeout(() => {
          setShowConfig(false);
          setConfigMsg(null);
        }, 1500);
      }
    } catch (err) {
      setConfigMsg({ type: 'error', text: err.response?.data?.message || 'Failed to update Gemini config' });
    } finally {
      setConfigSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 48px)' }}>
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Bot size={24} style={{ color: 'var(--teal-40)' }} />
            <span>AI Assistant</span>
            {aiStatus.configured ? (
              <div
                className="chat-ai-badge"
                style={{
                  fontSize: 12,
                  background: 'rgba(0, 166, 126, 0.15)',
                  border: '1px solid var(--teal-40)',
                  padding: '3px 8px',
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
                onClick={() => setShowConfig(true)}
                title="Click to view Gemini settings"
              >
                <Flash size={13} style={{ color: 'var(--teal-40)' }} />
                <span>Google Gemini ({aiStatus.model || 'gemini-1.5-flash'})</span>
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12,
                  background: 'rgba(241, 194, 27, 0.12)',
                  border: '1px solid rgba(241, 194, 27, 0.4)',
                  color: '#f1c21b',
                  padding: '3px 8px',
                  borderRadius: 4,
                }}
              >
                <WarningAlt size={13} />
                <span>Simulated Mode (Add Gemini Key)</span>
              </div>
            )}
          </h1>
          <p>Industrial intelligence grounded in your plant's Knowledge Graph, live sensors, and alerts</p>
        </div>

        {/* Gemini Settings Button */}
        <div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowConfig(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Settings size={14} />
            <span>{aiStatus.configured ? 'Gemini Config' : 'Connect Gemini API'}</span>
          </button>
        </div>
      </div>

      {/* Suggestions */}
      <div style={{ padding: '10px 24px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
        <div className="chat-suggestions" style={{ marginBottom: 0 }}>
          {SUGGESTIONS.map(s => (
            <button key={s} className="suggestion-chip" onClick={() => send(s)}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Messages Feed */}
      <div className="chat-messages" style={{ flex: 1 }}>
        {messages.map(msg => (
          <div key={msg._id} className={`chat-msg ${msg.role}`}>
            <div className={`chat-avatar ${msg.role === 'assistant' ? 'ai' : 'user'}`} style={msg.role === 'assistant' && msg.meta?.source === 'gemini' ? { background: 'var(--teal-60)' } : {}}>
              {msg.role === 'assistant' ? (msg.meta?.source === 'gemini' ? 'G' : 'AI') : (user?.name?.[0] || 'U')}
            </div>
            <div style={{ maxWidth: '85%' }}>
              <div className="chat-bubble">
                {msg.role === 'assistant' ? <FormattedMessage content={msg.content} /> : msg.content}
              </div>
              <div className="chat-meta" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                {msg.role === 'assistant' && (
                  <>
                    <span
                      style={{
                        padding: '1px 6px',
                        borderRadius: 3,
                        background: msg.meta?.source === 'gemini' ? 'rgba(0, 166, 126, 0.2)' : 'rgba(15, 98, 254, 0.2)',
                        color: msg.meta?.source === 'gemini' ? 'var(--teal-40)' : 'var(--blue-40)',
                        fontSize: 10,
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                      }}
                    >
                      {msg.meta?.source === 'gemini' ? `✨ ${msg.meta?.model || 'Gemini'}` : '🤖 Simulated Engine'}
                    </span>
                    {msg.meta?.intent && (
                      <span style={{ color: 'var(--text-helper)' }}>
                        Intent: {msg.meta.intent} ({msg.meta.confidence || 95}%)
                      </span>
                    )}
                  </>
                )}
                <span style={{ marginLeft: 'auto', color: 'var(--text-helper)' }}>
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="chat-msg assistant">
            <div className="chat-avatar ai" style={{ background: 'var(--teal-60)' }}>G</div>
            <div>
              <div className="chat-bubble" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[0, 1, 2].map(i => (
                    <div
                      key={i}
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: 'var(--teal-40)',
                        animation: `pulse 1s ${i * 0.2}s infinite`,
                      }}
                    />
                  ))}
                </div>
                <span>Gemini is analyzing your ontology and live telemetry…</span>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input Area */}
      <div className="chat-input-area">
        <input
          className="chat-input"
          placeholder="Ask Gemini about maintenance, quality, sensors, OEE, bottlenecks…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          disabled={loading}
        />
        <button
          className="btn btn-primary"
          onClick={() => send()}
          disabled={loading || !input.trim()}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          {loading ? <span className="spinner" style={{ width: 16, height: 16 }} /> : <><SendAlt size={16} /> Send</>}
        </button>
        <button
          className="btn btn-secondary btn-sm"
          title="New conversation"
          onClick={() => {
            setConvId(`conv_${Date.now()}`);
            setMessages([]);
          }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <Renew size={14} /> New
        </button>
      </div>

      {/* Gemini Settings Modal */}
      {showConfig && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
          onClick={() => setShowConfig(false)}
        >
          <div
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 4,
              width: '100%',
              maxWidth: 520,
              padding: 24,
              boxShadow: '0 12px 32px rgba(0, 0, 0, 0.6)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Flash size={20} style={{ color: 'var(--teal-40)' }} />
                <h2 style={{ fontSize: 18, margin: 0 }}>Configure Google Gemini AI</h2>
              </div>
              <button
                className="btn btn-secondary btn-sm btn-icon"
                onClick={() => setShowConfig(false)}
                style={{ padding: 4 }}
              >
                <Close size={16} />
              </button>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20, lineHeight: 1.5 }}>
              ManufactureAIP uses Google Gemini to answer questions with full contextual awareness of your plant's Knowledge Graph, live sensor data, and active alerts.
            </p>

            <form onSubmit={handleSaveConfig}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Gemini API Key
                </label>
                <input
                  type="password"
                  className="chat-input"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  placeholder="AIzaSy..."
                  value={apiKeyInput}
                  onChange={e => setApiKeyInput(e.target.value)}
                  autoFocus
                />
                <div style={{ fontSize: 12, color: 'var(--text-helper)', marginTop: 6 }}>
                  Need a key? Get one for free at{' '}
                  <a
                    href="https://aistudio.google.com/apikey"
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: 'var(--blue-40)', textDecoration: 'underline' }}
                  >
                    Google AI Studio
                  </a>
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Gemini Model
                </label>
                <select
                  className="chat-input"
                  style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg-primary)' }}
                  value={modelSelect}
                  onChange={e => setModelSelect(e.target.value)}
                >
                  <option value="gemini-3.8-flash">gemini-3.8-flash (Latest Flash - Recommended)</option>
                  <option value="gemini-flash-latest">gemini-flash-latest (Auto-Updating Flash)</option>
                  <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                  <option value="gemini-3.1-pro-preview">gemini-3.1-pro-preview (Deep Reasoning)</option>
                </select>
              </div>

              {configMsg && (
                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: 4,
                    fontSize: 13,
                    marginBottom: 16,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: configMsg.type === 'success' ? 'rgba(0, 166, 126, 0.15)' : 'rgba(218, 30, 40, 0.15)',
                    color: configMsg.type === 'success' ? 'var(--teal-40)' : 'var(--red-40)',
                    border: `1px solid ${configMsg.type === 'success' ? 'var(--teal-40)' : 'var(--red-40)'}`,
                  }}
                >
                  {configMsg.type === 'success' ? <Checkmark size={16} /> : <Close size={16} />}
                  <span>{configMsg.text}</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowConfig(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={configSaving || !apiKeyInput.trim()}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  {configSaving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <Checkmark size={14} />}
                  <span>Save & Connect</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
