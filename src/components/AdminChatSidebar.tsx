import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Send, Loader2, X, Trash2 } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AdminChatSidebarProps {
  password: string;
  open: boolean;
  onClose: () => void;
}

function SimpleMarkdown({ content }: { content: string }) {
  // Very minimal markdown: bold, code blocks, tables, line breaks
  const lines = content.split("\n");
  const elements: JSX.Element[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      elements.push(
        <pre key={elements.length} className="bg-muted/50 rounded p-2 text-xs overflow-x-auto my-1 font-mono">
          {codeLines.join("\n")}
        </pre>
      );
      continue;
    }

    // Table detection (lines with |)
    if (line.includes("|") && line.trim().startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      // Parse table
      const rows = tableLines
        .filter((l) => !l.match(/^\|[\s-|]+\|$/)) // skip separator rows
        .map((l) =>
          l.split("|").filter((_, idx, arr) => idx > 0 && idx < arr.length - 1).map((c) => c.trim())
        );
      if (rows.length > 0) {
        elements.push(
          <div key={elements.length} className="overflow-x-auto my-1">
            <table className="text-xs border-collapse w-full">
              <thead>
                <tr>
                  {rows[0].map((cell, ci) => (
                    <th key={ci} className="border border-border/50 px-2 py-1 text-left font-medium bg-muted/30">
                      {cell}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(1).map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) => (
                      <td key={ci} className="border border-border/50 px-2 py-1">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      continue;
    }

    // Headers
    if (line.startsWith("### ")) {
      elements.push(<h4 key={elements.length} className="font-semibold text-sm mt-2">{line.slice(4)}</h4>);
      i++;
      continue;
    }
    if (line.startsWith("## ")) {
      elements.push(<h3 key={elements.length} className="font-bold text-sm mt-2">{line.slice(3)}</h3>);
      i++;
      continue;
    }

    // Regular line with inline formatting
    if (line.trim() === "") {
      elements.push(<br key={elements.length} />);
      i++;
      continue;
    }

    // Process inline bold and code
    const formatted = line
      .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
      .replace(/`(.*?)`/g, '<code class="bg-muted/50 rounded px-1 text-xs font-mono">$1</code>');

    elements.push(
      <p key={elements.length} className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: formatted }} />
    );
    i++;
  }

  return <div className="space-y-0.5">{elements}</div>;
}

export default function AdminChatSidebar({ password, open, onClose }: AdminChatSidebarProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    // Scroll to bottom on new messages
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg: Message = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("admin-chat", {
        body: {
          password,
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setMessages((prev) => [...prev, { role: "assistant", content: data.content }]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `❌ Errore: ${err.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed top-0 right-0 h-full w-[420px] max-w-full bg-card border-l border-border shadow-2xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <span className="font-display font-semibold text-sm">Assistente Admin</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => setMessages([])}
            title="Cancella chat"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-8 space-y-2">
            <Bot className="h-10 w-10 mx-auto opacity-30" />
            <p>Ciao! Sono l'assistente admin.</p>
            <p className="text-xs">Puoi chiedermi statistiche, cercare dati, modificare partecipanti, importare da Firestore e altro.</p>
            <div className="flex flex-wrap gap-1.5 justify-center mt-3">
              {[
                "Quanti partecipanti ci sono?",
                "Lista eventi attivi",
                "Iscrizioni ultimo mese",
                "Cerca Mario Rossi",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  className="text-xs px-2.5 py-1 rounded-full border border-border bg-muted/50 hover:bg-muted transition-colors"
                  onClick={() => {
                    setInput(suggestion);
                    setTimeout(() => inputRef.current?.focus(), 0);
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[90%] rounded-lg px-3 py-2 ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-foreground"
              }`}
            >
              {msg.role === "assistant" ? (
                <SimpleMarkdown content={msg.content} />
              ) : (
                <p className="text-sm">{msg.content}</p>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-muted/50 rounded-lg px-3 py-2 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Elaboro...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="flex gap-2"
        >
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Scrivi un messaggio..."
            disabled={loading}
            className="flex-1 text-sm"
          />
          <Button type="submit" size="sm" disabled={loading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
