import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import PermissionGate from "@/components/PermissionGate";

interface Props {
  contactId: string;
  to: string;
  customerName: string;
  onSent: (subject: string, body: string) => void | Promise<void>;
}

const TEMPLATES: Record<string, { label: string; subject: string; body: (name: string) => string }> = {
  intro: {
    label: "Standard Intro",
    subject: "Re: Your inquiry to BlueRiver Services",
    body: (n) =>
      `Hi ${n || "there"},\n\nThank you for reaching out to BlueRiver Services. We received your message and would love to help. Could you share a bit more about your space and ideal timing so we can put together the right plan for you?\n\nLooking forward to hearing back.\n\n— The BlueRiver Team`,
  },
  visit: {
    label: "Schedule a Site Visit",
    subject: "Scheduling a quick site visit",
    body: (n) =>
      `Hi ${n || "there"},\n\nTo give you an accurate quote, we'd like to schedule a brief site visit. Please let us know two or three time windows that work for you this week and we'll confirm one.\n\n— The BlueRiver Team`,
  },
  commercial: {
    label: "Commercial Inquiry Follow-up",
    subject: "Follow-up on your commercial cleaning inquiry",
    body: (n) =>
      `Hi ${n || "there"},\n\nThanks for considering BlueRiver Services for your facility. To prepare a tailored proposal, could you share the property type, square footage, desired frequency, and any access requirements?\n\n— The BlueRiver Team`,
  },
  pricing: {
    label: "Pricing Follow-up",
    subject: "Your BlueRiver pricing details",
    body: (n) =>
      `Hi ${n || "there"},\n\nFollowing up on pricing — happy to walk you through our options. Let us know what's most important (frequency, scope, budget) and we'll match you to the best plan.\n\n— The BlueRiver Team`,
  },
  closing: {
    label: "Closing / Thank You",
    subject: "Thank you from BlueRiver Services",
    body: (n) =>
      `Hi ${n || "there"},\n\nJust a quick note to thank you for reaching out. If anything else comes up, we're one email away.\n\n— The BlueRiver Team`,
  },
};

const ContactReplyComposer = ({ contactId, to, customerName, onSent }: Props) => {
  const { toast } = useToast();
  const [subject, setSubject] = useState("Re: Your inquiry to BlueRiver Services");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const applyTemplate = (key: string) => {
    const t = TEMPLATES[key];
    if (!t) return;
    setSubject(t.subject);
    setBody(t.body(customerName));
  };

  const send = async () => {
    if (!body.trim() || !subject.trim()) {
      toast({ title: "Subject and message are required.", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const html = `
        <p>${body.trim().replace(/\n/g, "<br/>")}</p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0;"/>
        <p style="font-size:12px;color:#64748b;">Reply directly to this email or contact us at info@blueriverservices.co.</p>`;
      const { error } = await supabase.functions.invoke("send-transactional-email", {
        body: { type: "custom", to, subject: subject.trim(), html },
      });
      if (error) throw error;
      await (supabase as any).rpc("log_contact_activity", {
        p_contact_id: contactId,
        p_action: "reply_sent",
        p_notes: body.trim(),
        p_details: subject.trim(),
      });
      toast({ title: "Reply sent", description: `Email delivered to ${to}.` });
      await onSent(subject.trim(), body.trim());
      setBody("");
    } catch (e: any) {
      toast({ title: "Failed to send reply", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <PermissionGate permission="can_manage_messages">
      <div className="border-t border-border pt-3 space-y-2">
        <p className="text-sm font-semibold text-foreground">Reply to customer</p>
        <div className="grid sm:grid-cols-[200px_1fr] gap-2">
          <select
            className="flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm"
            defaultValue=""
            onChange={(e) => { if (e.target.value) applyTemplate(e.target.value); e.target.value = ""; }}
          >
            <option value="">Quick templates…</option>
            {Object.entries(TEMPLATES).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <Input
            placeholder="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>
        <Textarea
          rows={5}
          placeholder="Write your reply…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <div className="flex justify-between items-center">
          <p className="text-xs text-muted-foreground">
            Sent from <span className="font-medium">info@blueriverservices.co</span>. Replies route to the same inbox.
          </p>
          <Button size="sm" onClick={send} disabled={sending || !body.trim()}>
            <Send className="w-4 h-4 mr-1" /> {sending ? "Sending…" : "Send Reply"}
          </Button>
        </div>
      </div>
    </PermissionGate>
  );
};

export default ContactReplyComposer;
