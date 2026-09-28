import React, { useState, useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { MessageSquare, X, Send, Compass, Eye, ChevronRight, Volume2, VolumeX } from 'lucide-react';
import { ProcedureStep } from '../engine/core/types';
import { backendService } from '../services/backendService';
import './LabAssistant.css';

/** Action the AI agent can emit */
export interface AgentAction {
  type: 'highlight_tray' | 'highlight_canvas' | 'set_control' | 'place_apparatus'
    | 'start_simulation' | 'stop_simulation' | 'record_data' | 'open_drawer';
  target?: string;
  value?: number;
}

/** Current state of the lab, passed from VirtualLab */
export interface LabState {
  placedComponents: string[];
  controlValues: Record<string, number>;
  dataCount: number;
  isRunning: boolean;
}

interface LabAssistantProps {
  experimentCode: string;
  procedure: ProcedureStep[];
  labState?: LabState;
  onExecuteAction?: (action: AgentAction) => void;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  actions?: AgentAction[];
  awaitAction?: boolean;
}

export interface LabAssistantHandle {
  /** Opens the assistant and auto-sends a question about an apparatus item */
  askAbout: (apparatusName: string) => void;
}

export const LabAssistant = forwardRef<LabAssistantHandle, LabAssistantProps>(
  ({ experimentCode, procedure, labState, onExecuteAction }, ref) => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([
      { role: 'assistant', content: `Hello! I'm Dr. Vance. I can guide you step-by-step through this experiment or demonstrate it for you. Click "Guide Me" or "Show Me" to begin, or just ask me anything!` }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [awaitingStep, setAwaitingStep] = useState(false);
    const [actionQueue, setActionQueue] = useState<AgentAction[]>([]);
    const [isMuted, setIsMuted] = useState(true);
    const chatEndRef = useRef<HTMLDivElement>(null);

    const speak = useCallback((text: string) => {
      if (isMuted || !window.speechSynthesis) return;
      window.speechSynthesis.cancel(); // Stop current speech
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Try to find a female English voice
      const voices = window.speechSynthesis.getVoices();
      const femaleVoice = voices.find(v => 
        v.lang.startsWith('en') && 
        (v.name.includes('Female') || v.name.includes('Samantha') || v.name.includes('Victoria'))
      );
      if (femaleVoice) {
        utterance.voice = femaleVoice;
      }
      
      utterance.rate = 1.05;
      utterance.pitch = 1.1;
      window.speechSynthesis.speak(utterance);
    }, [isMuted]);

    // Auto-scroll to bottom of chat
    useEffect(() => {
      if (chatEndRef.current) {
        chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }, [messages, isTyping]);

    const handleToggle = () => setIsOpen(!isOpen);

    // Execute a batch of actions with staggered timing
    const executeActions = useCallback((actions: AgentAction[]) => {
      if (!onExecuteAction || !actions.length) return;
      actions.forEach((action, i) => {
        setTimeout(() => {
          onExecuteAction(action);
        }, i * 800); // 800ms delay between each action for visual clarity
      });
    }, [onExecuteAction]);

    const sendMessage = useCallback(async (userMsg: string) => {
      const newUserMessage: ChatMessage = { role: 'user', content: userMsg };
      setMessages(prev => [...prev, newUserMessage]);
      setIsTyping(true);
      setAwaitingStep(false);

      try {
        const currentMessages = [...messages, newUserMessage];
        const chatHistory = currentMessages.map(m => ({ role: m.role, content: m.content }));

        const result = await backendService.chatWithAssistant(
          experimentCode,
          userMsg,
          chatHistory,
          labState,
        );

        // result is now structured: { reply, actions, awaitAction }
        const reply = typeof result === 'string' ? result : result.reply;
        const actions: AgentAction[] = typeof result === 'string' ? [] : (result.actions || []);
        const awaitAction = typeof result === 'string' ? false : (result.awaitAction || false);

        const assistantMsg: ChatMessage = {
          role: 'assistant',
          content: reply,
          actions,
          awaitAction,
        };

        setMessages(prev => [...prev, assistantMsg]);
        speak(reply);

        // Execute actions immediately
        if (actions.length > 0) {
          executeActions(actions);
        }

        // If awaiting user action, show the "Next Step" button
        if (awaitAction) {
          setAwaitingStep(true);
        }

      } catch (error) {
        console.error(error);
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
        }]);
      } finally {
        setIsTyping(false);
      }
    }, [experimentCode, messages, labState, executeActions]);

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

    const handleNextStep = () => {
      setAwaitingStep(false);
      sendMessage("I've completed this step. What's next?");
    };

    const handleGuideMe = () => {
      sendMessage("Guide me through setting up and running this experiment step by step.");
    };

    const handleShowMe = () => {
      sendMessage("Show me how to run the entire experiment. Demonstrate it for me.");
    };

    // Expose askAbout to parent via ref
    useImperativeHandle(ref, () => ({
      askAbout: (apparatusName: string) => {
        setIsOpen(true);
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
          title={isOpen ? "Close Assistant" : "Summon Dr. Vance"}
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

          {/* Right Panel: Chat */}
          <div className="wb-assistant-chat-panel glass-panel">
            <div className="wb-chat-header">
              <span className="wb-chat-title">Dr. Vance (AI Agent)</span>
              <div className="wb-chat-header-actions">
                <button 
                  className="wb-mute-btn" 
                  onClick={() => {
                    setIsMuted(!isMuted);
                    if (!isMuted) window.speechSynthesis?.cancel();
                  }}
                  title={isMuted ? "Unmute Voice" : "Mute Voice"}
                  aria-label={isMuted ? "Unmute Voice" : "Mute Voice"}
                >
                  {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>
                <button
                  className="wb-close-chat-btn"
                  onClick={() => setIsOpen(false)}
                  title="Close Assistant"
                  aria-label="Close Assistant"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="wb-agent-quick-actions">
              <button className="wb-agent-btn wb-agent-btn--guide" onClick={handleGuideMe} disabled={isTyping}>
                <Compass size={14} />
                Guide Me
              </button>
              <button className="wb-agent-btn wb-agent-btn--show" onClick={handleShowMe} disabled={isTyping}>
                <Eye size={14} />
                Show Me
              </button>
            </div>

            <div className="wb-chat-history">
              {messages.map((msg, idx) => (
                <div key={idx} className={`wb-chat-bubble ${msg.role}`}>
                  {msg.content}
                  {msg.actions && msg.actions.length > 0 && (
                    <div className="wb-action-indicators">
                      {msg.actions.map((action, aidx) => (
                        <span key={aidx} className="wb-action-badge">
                          {action.type === 'highlight_tray' && `🔍 ${action.target}`}
                          {action.type === 'highlight_canvas' && `✨ ${action.target}`}
                          {action.type === 'set_control' && `🎛 ${action.target}=${action.value}`}
                          {action.type === 'place_apparatus' && `📦 Place ${action.target}`}
                          {action.type === 'start_simulation' && '▶️ Play'}
                          {action.type === 'stop_simulation' && '⏸ Pause'}
                          {action.type === 'record_data' && '📊 Record'}
                          {action.type === 'open_drawer' && `📂 ${action.target}`}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {isTyping && <div className="wb-typing-indicator">Dr. Vance is thinking...</div>}
              <div ref={chatEndRef} />
            </div>

            {/* Next Step Button (shown when AI awaits user action) */}
            {awaitingStep && !isTyping && (
              <button className="wb-next-step-btn" onClick={handleNextStep}>
                <ChevronRight size={16} />
                Done — Next Step
              </button>
            )}

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
