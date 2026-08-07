"use client";

import React, { useState, useEffect } from "react";
import { useToast } from "@/components/ui/Toast";
import { Settings, Save, Download, Upload, QrCode, Image as ImageIcon, Loader2 } from "lucide-react";

interface SettingFields {
  messName: string;
  address: string;
  contactNumber: string;
  logo?: string;
  upiId?: string;
  upiQrCode?: string;
}

export default function BusinessSettings() {
  const { success, error } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);

  // Form states
  const [messName, setMessName] = useState("Swami Samartha Mess");
  const [address, setAddress] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [upiId, setUpiId] = useState("");
  
  // Base64 representations
  const [logo, setLogo] = useState<string | undefined>("");
  const [upiQrCode, setUpiQrCode] = useState<string | undefined>("");

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/owner/settings");
      if (!res.ok) throw new Error("Could not retrieve setup");
      const data = await res.json();
      setMessName(data.messName);
      setAddress(data.address);
      setContactNumber(data.contactNumber);
      setUpiId(data.upiId || "");
      setLogo(data.logo);
      setUpiQrCode(data.upiQrCode);
    } catch (err: any) {
      error(err.message || "Failed to load settings configuration");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  // Helper to read file and convert to base64
  const handleImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: React.Dispatch<React.SetStateAction<string | undefined>>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024 * 2) {
      error("Image must be smaller than 2MB");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setter(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/owner/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messName,
          address,
          contactNumber,
          upiId,
          logo,
          upiQrCode,
        }),
      });

      if (!res.ok) throw new Error("Failed to save settings");
      success("Business configuration saved successfully!");
      
      // Force reload layout title
      window.location.reload();
    } catch (err: any) {
      error(err.message || "Error saving config parameters");
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadBackup = async () => {
    setBackupLoading(true);
    try {
      const res = await fetch("/api/owner/backup");
      if (!res.ok) throw new Error("Could not construct backup file");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `swami-samartha-mess-backup-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      success("Database backup JSON downloaded successfully!", "Backup Complete");
    } catch (err: any) {
      error(err.message || "Error generating backup file");
    } finally {
      setBackupLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="h-10 w-10 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground">Retrieving configuration settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl animate-in fade-in duration-300">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Business Settings</h2>
        <p className="text-sm text-muted-foreground">
          Configure business details, UPI payment parameters, and generate data backup records.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Settings Form */}
        <div className="md:col-span-2 bg-card border border-border p-6 rounded-2xl shadow-sm space-y-4">
          <h3 className="font-bold text-base flex items-center gap-2 mb-2">
            <Settings className="h-5 w-5 text-primary" />
            <span>Profile Configuration</span>
          </h3>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">
                Mess Name *
              </label>
              <input
                type="text"
                required
                value={messName}
                onChange={(e) => setMessName(e.target.value)}
                className="w-full px-3 py-2 bg-muted border border-transparent rounded-lg focus:border-primary/20 focus:bg-card focus:outline-none transition text-sm font-semibold"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">
                Mess Address *
              </label>
              <textarea
                required
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2 bg-muted border border-transparent rounded-lg focus:border-primary/20 focus:bg-card focus:outline-none transition text-sm font-semibold resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">
                  Contact Phone *
                </label>
                <input
                  type="text"
                  required
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  className="w-full px-3 py-2 bg-muted border border-transparent rounded-lg focus:border-primary/20 focus:bg-card focus:outline-none transition text-sm font-semibold"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">
                  UPI VPA Handle (for scanner QR generation)
                </label>
                <input
                  type="text"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  placeholder="e.g. pay@okaxis"
                  className="w-full px-3 py-2 bg-muted border border-transparent rounded-lg focus:border-primary/20 focus:bg-card focus:outline-none transition text-sm font-semibold"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 bg-primary hover:bg-primary/95 text-white font-semibold text-sm px-4 py-2.5 rounded-xl hover-lift shadow transition mt-2 cursor-pointer"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              <span>Save Configuration</span>
            </button>
          </form>
        </div>

        {/* UPI QR & logo uploaders + Backup card */}
        <div className="space-y-6">
          {/* Images Upload block */}
          <div className="bg-card border border-border p-6 rounded-2xl shadow-sm space-y-4">
            <h4 className="font-bold text-sm">Media configuration</h4>
            
            {/* Logo */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase block">Mess Logo</span>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-muted border border-border rounded-lg flex items-center justify-center text-muted-foreground overflow-hidden">
                  {logo ? (
                    <img src={logo} alt="Mess logo" className="h-full w-full object-cover" />
                  ) : (
                    <ImageIcon className="h-5 w-5" />
                  )}
                </div>
                <label className="px-3 py-1.5 border border-border bg-card hover:bg-muted text-xs font-bold rounded-lg cursor-pointer transition flex items-center gap-1">
                  <Upload className="h-3 w-3" />
                  <span>Upload Logo</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, setLogo)}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* UPI QR */}
            <div className="space-y-2 pt-2 border-t border-border">
              <span className="text-[10px] font-bold text-muted-foreground uppercase block">UPI QR Scanner</span>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-muted border border-border rounded-lg flex items-center justify-center text-muted-foreground overflow-hidden">
                  {upiQrCode ? (
                    <img src={upiQrCode} alt="UPI QR" className="h-full w-full object-contain" />
                  ) : (
                    <QrCode className="h-5 w-5" />
                  )}
                </div>
                <label className="px-3 py-1.5 border border-border bg-card hover:bg-muted text-xs font-bold rounded-lg cursor-pointer transition flex items-center gap-1">
                  <Upload className="h-3 w-3" />
                  <span>Upload QR</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, setUpiQrCode)}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Backup block */}
          <div className="bg-card border border-border p-6 rounded-2xl shadow-sm space-y-3">
            <h4 className="font-bold text-sm">Database Utility</h4>
            <p className="text-[11px] text-muted-foreground leading-normal">
              Download all database collection records (customers, settings, meals, invoices, payments) in a single JSON backup.
            </p>
            <button
              onClick={handleDownloadBackup}
              disabled={backupLoading}
              className="w-full inline-flex items-center justify-center gap-1.5 border border-border bg-card hover:bg-muted font-bold text-xs py-2.5 rounded-xl transition cursor-pointer"
            >
              {backupLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              <span>Download Database Backup</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
