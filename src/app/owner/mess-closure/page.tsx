"use client";

import React, { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { Loader2, CalendarRange, Send } from "lucide-react";

export default function MessClosurePage() {
  const { success, error } = useToast();

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [whatsappLink, setWhatsappLink] = useState<string | null>(null);
  const [draftMessage, setDraftMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) {
      error("Please select start and end dates");
      return;
    }

    setLoading(true);
    setWhatsappLink(null);
    setDraftMessage(null);

    try {
      const res = await fetch("/api/owner/mess-closure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate, endDate, notes }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to announce closure");

      success("Mess closure period has been officially registered!");
      setWhatsappLink(data.whatsappLink);
      setDraftMessage(data.draftMessage);

      // Reset form but leave the link
      setStartDate("");
      setEndDate("");
      setNotes("");
    } catch (err: any) {
      error(err.message || "Error setting mess closure");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl animate-in fade-in duration-300">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Announce Mess Closure</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Mark the mess as closed for a specific date range. This automatically exempts customers from being billed on these dates, and drafts a WhatsApp message for you to send to your group.
        </p>
      </div>

      <div className="bg-card border border-border p-6 rounded-2xl shadow-sm space-y-4">
        <h3 className="font-bold text-base flex items-center gap-2">
          <CalendarRange className="h-5 w-5 text-amber-500" />
          <span>Closure Details</span>
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">
                Start Date *
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-muted border border-transparent rounded-lg focus:border-primary/20 focus:bg-card focus:outline-none transition text-sm font-semibold"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">
                End Date (Inclusive) *
              </label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 bg-muted border border-transparent rounded-lg focus:border-primary/20 focus:bg-card focus:outline-none transition text-sm font-semibold"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">
              Internal Notes / Reason
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Diwali Holidays"
              className="w-full px-3 py-2 bg-muted border border-transparent rounded-lg focus:border-primary/20 focus:bg-card focus:outline-none transition text-sm font-semibold"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-1.5 bg-primary hover:bg-primary/95 text-white font-semibold text-sm px-4 py-2.5 rounded-xl hover-lift shadow transition mt-2 cursor-pointer"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            <span>Announce & Register Closure</span>
          </button>
        </form>
      </div>

      {whatsappLink && draftMessage && (
        <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 p-6 rounded-2xl shadow-sm space-y-4 animate-in slide-in-from-bottom-4 duration-300">
          <h3 className="font-bold text-emerald-800 dark:text-emerald-400 text-base flex items-center gap-2">
            <Send className="h-5 w-5" />
            <span>Success! Send Notification</span>
          </h3>
          <p className="text-sm text-emerald-700 dark:text-emerald-500">
            The closure has been recorded. You can now click the button below to open WhatsApp Web/App and share the announcement.
          </p>
          
          <div className="bg-white dark:bg-zinc-950 border border-emerald-100 dark:border-emerald-900 rounded-xl p-4 text-sm font-medium whitespace-pre-wrap text-emerald-900 dark:text-emerald-100">
            {draftMessage}
          </div>

          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#20b858] text-white font-bold text-sm px-5 py-2.5 rounded-xl shadow transition mt-2 cursor-pointer"
          >
            <Send className="h-4 w-4" />
            <span>Share via WhatsApp</span>
          </a>
        </div>
      )}
    </div>
  );
}
