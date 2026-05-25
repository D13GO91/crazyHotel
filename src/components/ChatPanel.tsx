import React, { useState, useEffect, useRef } from 'react';
import type { Message } from '../types';
import { Send } from 'lucide-react';

interface ChatPanelProps {
  messages: Message[];
  onSendMessage?: (content: string) => void;
  currentUserId?: string | null;
  readOnly?: boolean;
}

export default function ChatPanel({
  messages,
  onSendMessage,
  currentUserId,
  readOnly = false,
}: ChatPanelProps) {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Rolagem automática para a mensagem mais recente
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || readOnly || !onSendMessage) return;
    onSendMessage(inputText);
    setInputText('');
  };

  return (
    <div 
      style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        height: '100%', 
        background: 'var(--bg-glass)', 
        backdropFilter: 'blur(16px)', 
        borderRadius: '1rem', 
        border: '1px solid var(--border-glass)',
        overflow: 'hidden'
      }}
    >
      {/* Header */}
      <div 
        style={{ 
          padding: '0.75rem 1rem', 
          borderBottom: '1px solid var(--border-glass)', 
          background: 'rgba(255, 255, 255, 0.02)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-light)', letterSpacing: '0.05em' }}>
          CHAT DE DISCUSSÃO
        </span>
        {readOnly && (
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '0.1rem 0.4rem', borderRadius: '0.25rem' }}>
            Apenas Leitura
          </span>
        )}
      </div>

      {/* Message List */}
      <div 
        style={{ 
          flex: 1, 
          padding: '1rem', 
          overflowY: 'auto', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '0.75rem' 
        }}
      >
        {messages.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '0 1rem' }}>
            Nenhuma mensagem enviada. <br /> Comece a discutir!
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = currentUserId && msg.player_id === currentUserId;
            
            return (
              <div 
                key={msg.id} 
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: isMe ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  alignSelf: isMe ? 'flex-end' : 'flex-start'
                }}
              >
                {/* Nome do remetente */}
                {!isMe && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--accent-light)', marginBottom: '0.15rem', marginLeft: '0.25rem', fontWeight: 600 }}>
                    {msg.player_name}
                  </span>
                )}
                
                {/* Balão da mensagem */}
                <div 
                  style={{ 
                    padding: '0.6rem 0.85rem', 
                    borderRadius: '0.75rem', 
                    borderTopRightRadius: isMe ? '0.15rem' : '0.75rem',
                    borderTopLeftRadius: !isMe ? '0.15rem' : '0.75rem',
                    background: isMe 
                      ? 'linear-gradient(135deg, rgba(var(--accent-rgb), 0.25) 0%, rgba(var(--accent-rgb), 0.1) 100%)' 
                      : 'rgba(255, 255, 255, 0.05)',
                    border: `1px solid ${isMe ? 'rgba(var(--accent-rgb), 0.3)' : 'rgba(255, 255, 255, 0.06)'}`,
                    color: 'var(--text-light)',
                    fontSize: '0.9rem',
                    wordBreak: 'break-word',
                    boxShadow: isMe ? '0 4px 12px rgba(var(--accent-rgb), 0.1)' : 'none'
                  }}
                >
                  {msg.content}
                </div>
                
                {/* Hora do envio */}
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.15rem', marginInline: '0.25rem' }}>
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form (Hidden in readOnly mode) */}
      {!readOnly && (
        <form 
          onSubmit={handleSubmit}
          style={{ 
            padding: '0.75rem', 
            borderTop: '1px solid var(--border-glass)', 
            background: 'rgba(0, 0, 0, 0.15)',
            display: 'flex',
            gap: '0.5rem'
          }}
        >
          <input
            type="text"
            placeholder="Digite sua mensagem..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value.slice(0, 200))}
            maxLength={200}
            style={{
              flex: 1,
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-glass)',
              borderRadius: '0.5rem',
              padding: '0.5rem 0.75rem',
              color: 'var(--text-light)',
              fontSize: '0.85rem',
              outline: 'none',
              transition: 'var(--transition-smooth)'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = 'var(--accent-light)';
              e.target.style.background = 'rgba(255, 255, 255, 0.05)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'var(--border-glass)';
              e.target.style.background = 'rgba(255, 255, 255, 0.03)';
            }}
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            style={{
              background: 'linear-gradient(135deg, var(--accent) 0%, #9a7611 100%)',
              border: 'none',
              borderRadius: '0.5rem',
              width: '2.25rem',
              height: '2.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--text-light)',
              transition: 'var(--transition-spring)',
              boxShadow: '0 2px 8px rgba(var(--accent-rgb), 0.2)'
            }}
            onMouseOver={(e) => {
              if (inputText.trim()) e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <Send size={16} />
          </button>
        </form>
      )}
    </div>
  );
}
