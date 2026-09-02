import { AIChatBox, Message } from "@/components/AIChatBox";
import { trpc } from "@/lib/trpc";
import { Bot, ChevronDown, MessageCircle, X } from "lucide-react";
import { useState } from "react";

type Section = "overview" | "vault" | "requests" | "prescriptions" | "audit";
type Role = "patient" | "doctor" | "pharmacy";

type NavigationAssistantProps = {
  section: Section;
  role: Role;
  patientName: string;
  pendingAccess: number;
  activeAccess: number;
  onNavigate: (section: Section) => void;
  onRoleChange: (role: Role) => void;
  onRunAnalysis: () => void;
  onLoadQrSample: () => void;
};

export function NavigationAssistant({
  section,
  role,
  patientName,
  pendingAccess,
  activeAccess,
  onNavigate,
  onRoleChange,
  onRunAnalysis,
  onLoadQrSample,
}: NavigationAssistantProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hi JP. Ask me to open your vault, show requests, switch role, or run a safety check.",
    },
  ]);

  const chatMutation = trpc.assistant.chat.useMutation({
    onSuccess: response => {
      setMessages(previous => [...previous, { role: "assistant", content: response.reply }]);
      if (!response.action) return;
      if (response.action.type === "navigate") onNavigate(response.action.section);
      if (response.action.type === "set_role") onRoleChange(response.action.role);
      if (response.action.type === "run_analysis") {
        onNavigate("prescriptions");
        onRunAnalysis();
      }
      if (response.action.type === "load_qr_sample") {
        onNavigate("prescriptions");
        onLoadQrSample();
      }
    },
    onError: error => {
      setMessages(previous => [
        ...previous,
        { role: "assistant", content: error.message || "I could not reach the assistant. Please try again." },
      ]);
    },
  });

  const sendMessage = (content: string) => {
    const nextMessages: Message[] = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    chatMutation.mutate({
      messages: nextMessages.flatMap(message =>
        message.role === "system"
          ? []
          : [{ role: message.role as "user" | "assistant", content: message.content }]
      ),
      context: { section, role, patientName, pendingAccess, activeAccess },
    });
  };

  return (
    <div className="assistant-shell">
      {open && (
        <section className="assistant-panel" aria-label="imalionbot navigation assistant">
          <div className="assistant-panel-head">
            <div className="assistant-title">
              <div className="assistant-avatar"><Bot size={17} /></div>
              <div>
                <strong>imalionbot assistant</strong>
                <span>Navigate by asking in plain words</span>
              </div>
            </div>
            <button className="assistant-close" type="button" aria-label="Close assistant" onClick={() => setOpen(false)}>
              <X size={17} />
            </button>
          </div>
          <AIChatBox
            messages={messages}
            onSendMessage={sendMessage}
            isLoading={chatMutation.isPending}
            height="440px"
            className="assistant-chat"
            placeholder="Ask imalionbot…"
            emptyStateMessage="Ask me to move around imalionbot"
            suggestedPrompts={["Open my health vault", "Show access requests", "Run a safety check"]}
          />
        </section>
      )}
      <button
        type="button"
        className={`assistant-launcher ${open ? "assistant-launcher-open" : ""}`}
        aria-expanded={open}
        aria-label={open ? "Close imalionbot assistant" : "Open imalionbot assistant"}
        onClick={() => setOpen(previous => !previous)}
      >
        {open ? <ChevronDown size={17} /> : <MessageCircle size={17} />}
        <span>{open ? "Close" : "Ask imalionbot"}</span>
      </button>
    </div>
  );
}
