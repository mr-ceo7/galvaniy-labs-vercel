import React, { useState, useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { MessageSquare, X, Send } from 'lucide-react';
import { ProcedureStep } from '../engine/core/types';
import { backendService } from '../services/backendService';
import './LabAssistant.css';

interface LabAssistantProps {
  experimentCode: string;
  procedure: ProcedureStep[];
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LabAssistantHandle {
  /** Opens the assistant and auto-sends a question about an apparatus item */
  askAbout: (apparatusName: string) => void;
}

export const LabAssistant = forwardRef<LabAssistantHandle, LabAssistantProps>(
  ({ experimentCode, procedure }, ref) => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([
      { role: 'assistant', content: `Hello! I'm Dr. Vance. I'm here to assist you with the ${experimentCode} experiment. What would you like to know?` }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom of chat
    useEffect(() => {
      if (chatEndRef.current) {
        chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }, [messages, isTyping]);

    const handleToggle = () => setIsOpen(!isOpen);

    const sendMessage = useCallback(async (userMsg: string) => {
      setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
      setIsTyping(true);

      try {
        // Pass current messages plus the new user message for full context
        const currentMessages = [...messages, { role: 'user' as const, content: userMsg }];
        const reply = await backendService.chatWithAssistant(experimentCode, userMsg, currentMessages);
        setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
      } catch (error) {
        console.error(error);
        setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }]);
      } finally {
        setIsTyping(false);
      }
    }, [experimentCode, messages]);

    const handleSendMessage = async () => {
      if (!inputValue.trim()) return;
      const userMsg = inputValue.trim();
      setInputValue('');
      await sendMessage(userMsg);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleSendMessage();
      }
    };

    // Expose askAbout to parent via ref
    useImperativeHandle(ref, () => ({
      askAbout: (apparatusName: string) => {
        setIsOpen(true);
        // Small delay so the panel animates open before the message appears
        setTimeout(() => {
          sendMessage(`Tell me about the ${apparatusName}. What is it used for in this experiment and how do I use it correctly?`);
        }, 300);
      },
    }), [sendMessage]);

    return (
      <>
        <button
          className={`wb-summon-assistant ${isOpen ? 'active' : ''}`}
          onClick={handleToggle}
          title={isOpen ? "Close Assistant" : "Summon Assistant"}
        >
          {isOpen ? <X size={24} /> : <MessageSquare size={24} />}
        </button>

        <div className={`wb-assistant-container ${isOpen ? 'active' : ''}`}>

          {/* Left Panel: Instructions */}
          <div className="wb-assistant-instructions glass-panel">
            <div className="wb-panel-header">Active Module: {experimentCode}</div>
            <div className="wb-procedure-list">
              {procedure.map((step, idx) => (
                <div key={idx} className="wb-procedure-item">
                  <input type="checkbox" id={`step-${idx}`} />
                  <label htmlFor={`step-${idx}`}>{step.instruction}</label>
                </div>
              ))}
            </div>
          </div>

          {/* Right Panel: Chat & Avatar */}
          <div className="wb-assistant-chat-panel glass-panel">
            <div className="wb-avatar-container">
              <img
                src="/assets/avatar/dr_vance.png"
                alt="Dr. Vance"
                className="wb-avatar-image"
              />
            </div>

            <div className="wb-chat-history">
              {messages.map((msg, idx) => (
                <div key={idx} className={`wb-chat-bubble ${msg.role}`}>
                  {msg.content}
                </div>
              ))}
              {isTyping && <div className="wb-typing-indicator">Dr. Vance is typing...</div>}
              <div ref={chatEndRef} />
            </div>

            <div className="wb-chat-input-area">
              <input
                type="text"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Dr. Vance..."
                disabled={isTyping}
              />
              <button onClick={handleSendMessage} disabled={isTyping || !inputValue.trim()}>
                <Send size={16} />
              </button>
            </div>
          </div>

        </div>
      </>
    );
  }
);
