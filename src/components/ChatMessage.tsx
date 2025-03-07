import React from 'react';
import './ChatMessage.css';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  isLoading?: boolean;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ role, content, isLoading }) => {
  return (
    <div className={`chat-message ${isLoading ? 'assistant' : role}`}>
      <div className="avatar">
        {isLoading ? '🤖' : role === 'user' ? '👤' : '🤖'}
      </div>
      <div className="message-content">
        {isLoading ? (
          <div className="message-text">
            Thinking
            <span className="dot dot1">.</span>
            <span className="dot dot2">.</span>
            <span className="dot dot3">.</span>
          </div>
        ) : (
          <div className="message-text">{content}</div>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;