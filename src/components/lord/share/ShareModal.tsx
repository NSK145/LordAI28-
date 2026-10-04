import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Check, Copy, Link2, QrCode, ShieldOff, Globe, Loader2, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import {
  useShares,
  useCreateShare,
  useRevokeShare,
  getShareUrl,
  type ShareRecord,
} from "@/hooks/use-shares";
import { Capacitor } from "@capacitor/core";
import { mobileShare } from "@/lib/mobile-native";

interface ShareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  conversationId: string | null;
  conversationTitle: string;
}

export function ShareModal({
  open,
  onOpenChange,
  userId,
  conversationId,
  conversationTitle,
}: ShareModalProps) {
  const { data: shares } = useShares(userId);
  const createShare = useCreateShare(userId);
  const revokeShare = useRevokeShare(userId);

  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const current: ShareRecord | undefined = conversationId
    ? shares?.find((s) => s.conversation_id === conversationId)
    : undefined;
  const isShared = !!current;
  const shareUrl = current ? getShareUrl(current.share_token) : "";

  // Reset transient UI when the modal closes.
  useEffect(() => {
    if (!open) {
      setCopied(false);
      setShowQr(false);
    }
  }, [open]);

  const handleCreate = () => {
    if (!conversationId) return;
    createShare.mutate(conversationId, {
      onSuccess: (share) => {
        const url = getShareUrl(share.share_token);
        void navigator.clipboard?.writeText(url).catch(() => {});
        toast.success("Share link created & copied", {
          description: "Anyone with the link can view this conversation.",
        });
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
    });
  };

  const handleRevoke = () => {
    if (!current) return;
    revokeShare.mutate(current.share_token);
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy. Select and copy manually.");
    }
  };

  const busy = createShare.isPending || revokeShare.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-panel max-w-md border-border/50 bg-background/70 p-5 backdrop-blur-2xl sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-base tracking-wide">
            <Globe className="h-4 w-4 text-primary" />
            Share conversation
          </DialogTitle>
          <DialogDescription className="truncate text-xs text-muted-foreground">
            {conversationTitle || "Untitled conversation"}
          </DialogDescription>
        </DialogHeader>

        {!conversationId ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            Select a conversation to share.
          </p>
        ) : (
          <div className="space-y-4">
            {/* Status badge */}
            <div
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition",
                isShared
                  ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                  : "border-border/40 bg-background/40 text-muted-foreground",
              )}
            >
              {isShared ? (
                <>
                  <Globe className="h-3.5 w-3.5" />
                  <span>Public link is active — anyone with the link can view (read-only).</span>
                </>
              ) : (
                <>
                  <ShieldOff className="h-3.5 w-3.5" />
                  <span>This conversation is private.</span>
                </>
              )}
            </div>

            {/* Link row */}
            <div className="flex items-center gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border/50 bg-background/40 px-3 py-2">
                <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate text-xs text-foreground/80">
                  {isShared ? shareUrl : "No link yet"}
                </span>
              </div>
              {isShared && (
                <button
                  onClick={handleCopy}
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition",
                    copied
                      ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-300"
                      : "border-border/50 bg-background/40 text-muted-foreground hover:text-primary",
                  )}
                  aria-label="Copy link"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              )}
              <button
                onClick={() => setShowQr((v) => !v)}
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition",
                  showQr
                    ? "border-primary/40 bg-primary/15 text-primary"
                    : "border-border/50 bg-background/40 text-muted-foreground hover:text-primary",
                )}
                aria-label="Toggle QR code"
                disabled={!isShared}
              >
                <QrCode className="h-4 w-4" />
              </button>
            </div>

            {/* QR code */}
            {showQr && isShared && (
              <div className="flex flex-col items-center gap-2 rounded-lg border border-border/40 bg-background/40 py-4">
                <div className="rounded-lg bg-white p-2">
                  <QRCodeSVG value={shareUrl} size={132} />
                </div>
                <p className="text-[10px] text-muted-foreground">Scan to open on mobile</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 pt-1">
              {!isShared ? (
                <button
                  onClick={handleCreate}
                  disabled={busy}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary/20 px-3 py-2 text-xs font-semibold text-primary transition hover:bg-primary/30 disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Globe className="h-4 w-4" />
                  )}
                  Generate public link
                </button>
              ) : (
                <>
                  <button
                    onClick={handleCopy}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-border/50 bg-background/40 px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-background/60"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-emerald-300" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    {copied ? "Copied" : "Copy link"}
                  </button>
                  {Capacitor.isNativePlatform() && (
                    <button
                      onClick={() =>
                        void mobileShare
                          .shareText(
                            conversationTitle || "LORD AI conversation",
                            conversationTitle || "LORD AI conversation",
                            shareUrl,
                          )
                          .catch(() => toast.error("Could not open Android sharing."))
                      }
                      aria-label="Share conversation link"
                      title="Share with another app"
                      className="flex items-center justify-center gap-2 rounded-lg border border-border/50 bg-background/40 px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-background/60"
                    >
                      <Share2 className="h-4 w-4" /> Share
                    </button>
                  )}
                  <button
                    onClick={handleRevoke}
                    disabled={busy}
                    className="flex items-center justify-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive transition hover:bg-destructive/20 disabled:opacity-50"
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ShieldOff className="h-4 w-4" />
                    )}
                    Revoke
                  </button>
                </>
              )}
            </div>

            <p className="text-center text-[10px] leading-relaxed text-muted-foreground/70">
              Revoking instantly disables the link. Shared views are read-only and never reveal your
              identity.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
