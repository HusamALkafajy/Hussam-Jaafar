'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, ArrowLeft, Send } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export default function TutorPage() {
  const params = useParams();
  const documentId = params.documentId as string;
  const router = useRouter();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadHistory();
  }, [documentId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const loadHistory = async () => {
    try {
      const res = await api.get<{messages: Message[]}>(`/documents/${documentId}/tutor/history`);
      if (res?.messages) {
        setMessages(res.messages);
      }
    } catch (error) {
      toast.error('Failed to load tutor history');
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await api.post<Message>(`/documents/${documentId}/tutor/chat`, {
        question: userMessage.content,
      });

      if (res) {
        setMessages((prev) => [...prev, res]);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to send message');
      setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="flex items-center gap-4 px-6 py-4 bg-card border-b border-border">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">Pedagogical AI Tutor</h1>
          <p className="text-sm text-muted-foreground">Learn from your material</p>
        </div>
      </header>

      <div className="flex-1 overflow-hidden relative">
        <ScrollArea className="h-full px-4 py-6" ref={scrollRef}>
          <div className="max-w-3xl mx-auto space-y-6 pb-20">
            {messages.length === 0 ? (
              <div className="text-center text-muted-foreground mt-20">
                <p>Hello! I am your Pedagogical Tutor.</p>
                <p>Ask me any question about your document to begin learning.</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <Card
                    className={`max-w-[80%] p-4 ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-card border border-border shadow-sm'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  </Card>
                </div>
              ))
            )}
            {isLoading && (
              <div className="flex justify-start">
                <Card className="max-w-[80%] p-4 bg-card border border-border shadow-sm">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>The tutor is thinking...</span>
                  </div>
                </Card>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="absolute bottom-0 left-0 right-0 bg-card border-t border-border p-4">
          <div className="max-w-3xl mx-auto flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Ask a question..."
              className="flex-1"
              disabled={isLoading}
            />
            <Button onClick={sendMessage} disabled={isLoading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
