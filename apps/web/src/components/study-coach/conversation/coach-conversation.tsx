import React, { useState } from 'react';
import { Card, CardHeader, CardContent, CardTitle, CardFooter } from '../../ui/card';
import { MessageCircle, Send } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { ConversationMessage, ConversationState } from './conversation-model';
import { useStudyCoach } from '../study-coach-provider';

export const CoachConversation: React.FC = () => {
  const { domain } = useStudyCoach();
  const [state, setState] = useState<ConversationState>({
    messages: [
      {
        id: 'msg_1',
        role: 'coach',
        text: `Hi! Based on your plan, you have ${domain.plan?.reviewQueue.length} items to review. Would you like to start?`,
        timestamp: new Date().toISOString()
      }
    ],
    isTyping: false
  });
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim()) return;

    const newMsg: ConversationMessage = {
      id: `msg_${Date.now()}`,
      role: 'student',
      text: input,
      timestamp: new Date().toISOString()
    };

    setState(prev => ({
      ...prev,
      messages: [...prev.messages, newMsg]
    }));
    setInput('');
  };

  return (
    <Card className="flex flex-col h-[500px]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageCircle className="w-5 h-5" />
          Coach Chat
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto space-y-4">
        {state.messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'student' ? 'justify-end' : 'justify-start'}`}>
            <div className={`p-3 rounded-lg max-w-[80%] ${msg.role === 'student' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
              <p className="text-sm">{msg.text}</p>
            </div>
          </div>
        ))}
      </CardContent>
      <CardFooter className="pt-4 border-t">
        <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex w-full gap-2">
          <Input 
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            placeholder="Ask your coach..." 
            className="flex-1"
          />
          <Button type="submit" size="icon">
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
};
