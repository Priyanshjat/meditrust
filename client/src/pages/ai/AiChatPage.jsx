import React, { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Sparkles,
  Send,
  Paperclip,
  Mic,
  Bot,
  User,
  RotateCcw,
  Stethoscope,
  AlertTriangle,
} from 'lucide-react';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import useNavigateById from '../../hooks/useNavigateById';
import aiService from '../../services/aiService';

const PROMPT_SUGGESTIONS = [
  'Explain my elevated fasting blood sugar (115 mg/dL)',
  'Can I take ibuprofen with amoxicillin?',
  'Safe home remedies for persistent dry cough',
  'When should I see an urgent care doctor for migraine?',
];

const now = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const WELCOME_MESSAGE = {
  id: 1,
  sender: 'ai',
  text: "Hello! I am MediTrust's Clinical AI Assistant. I can help interpret laboratory numbers, explain what your prescription instructions mean, or give general guidance on mild symptoms. I can't diagnose conditions or replace a real doctor.",
  time: now(),
};

export default function AiChatPage() {
  const onNavigate = useNavigateById();
  const { user } = useSelector((state) => state.auth);

  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');

  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isSending]);

  const appendMessage = (msg) => setMessages((prev) => [...prev, msg]);

  const handleSendMessage = async () => {
    const text = inputText.trim();
    if (!text || isSending) return;

    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text,
      time: now(),
    };

    appendMessage(userMsg);
    setInputText('');
    setError('');
    setIsSending(true);

    try {
      if (!user?.token) {
        throw new Error('Please log in to chat with MediTrust AI.');
      }

      const data = await aiService.chatWithAi({ text, token: user.token });

      appendMessage({
        id: Date.now() + 1,
        sender: 'ai',
        text: data.reply || "I couldn't generate a response. Please try rephrasing your question.",
        time: now(),
      });
    } catch (err) {
      setError(
        err?.response?.data?.details ||
          err?.response?.data?.error ||
          err?.message ||
          'MediTrust AI is unavailable right now. Please try again.'
      );
    } finally {
      setIsSending(false);
    }
  };

  const handleSelectPrompt = (prompt) => {
    setInputText(prompt);
  };

  const handleReset = () => {
    setMessages([{ ...WELCOME_MESSAGE, time: now() }]);
    setError('');
    setInputText('');
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

      {/* Top Header Card */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900">MediTrust AI Clinical Companion</h1>
              <Badge variant="purple" size="sm" dot>
                Online
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              General health guidance • Not a substitute for a doctor
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate('doctors')}
            icon={Stethoscope}
          >
            Connect with Real Doctor
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            icon={RotateCcw}
          >
            New Chat
          </Button>
        </div>
      </div>

      {/* Suggested Prompt Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        <span className="text-xs font-semibold text-slate-400 shrink-0">Try asking:</span>
        {PROMPT_SUGGESTIONS.map((prompt, i) => (
          <button
            key={i}
            onClick={() => handleSelectPrompt(prompt)}
            className="px-3 py-1.5 rounded-xl border border-indigo-100 bg-indigo-50/60 hover:bg-indigo-100 text-indigo-800 text-xs font-medium whitespace-nowrap transition-colors"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Chat Messages Container */}
      <Card className="p-4 sm:p-6 min-h-[480px] max-h-[600px] overflow-y-auto space-y-5 bg-slate-50/50">

        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          return (
            <div
              key={msg.id}
              className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {/* Avatar */}
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  isUser
                    ? 'bg-teal-600 text-white'
                    : 'bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-xs'
                }`}
              >
                {isUser ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
              </div>

              {/* Message Bubble */}
              <div className={`max-w-xl space-y-1.5 ${isUser ? 'items-end text-right' : 'items-start text-left'}`}>

                <div
                  className={`p-4 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-xs ${
                    isUser
                      ? 'bg-teal-600 text-white rounded-tr-none'
                      : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none space-y-2'
                  }`}
                >
                  <div className="whitespace-pre-line">{msg.text}</div>
                </div>

                <div className="text-[10px] text-slate-400 px-1">
                  {msg.time}
                </div>
              </div>
            </div>
          );
        })}

        {/* Typing Indicator Animation */}
        {isSending && (
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Bot className="w-5 h-5" />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none p-3.5 shadow-xs flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '300ms' }} />
              <span className="text-xs text-slate-400 font-medium ml-1.5">MediTrust AI is formulating medical guidance...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />

      </Card>

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 flex items-start gap-2 text-xs text-rose-800">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Input Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-2.5 shadow-sm flex items-center gap-2">
        <button
          type="button"
          onClick={() => onNavigate('ai-prescription')}
          className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          title="Attach prescription or lab report"
        >
          <Paperclip className="w-5 h-5" />
        </button>

        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder="Ask MediTrust AI about medicines, symptoms, or test results..."
          className="flex-1 bg-transparent border-0 text-sm text-slate-800 placeholder-slate-400 focus:outline-none px-2"
        />

        <button
          type="button"
          className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          title="Voice input"
        >
          <Mic className="w-5 h-5" />
        </button>

        <Button
          variant="ai"
          size="sm"
          onClick={handleSendMessage}
          disabled={isSending || !inputText.trim()}
          icon={isSending ? Sparkles : Send}
          className="shadow-xs"
        >
          {isSending ? 'Sending...' : 'Send'}
        </Button>
      </div>

    </div>
  );
}
