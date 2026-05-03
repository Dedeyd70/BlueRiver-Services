import { useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Star, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import PageMeta from "@/components/PageMeta";

const LeaveReview = () => {
  const { bookingId } = useParams();
  const [params] = useSearchParams();
  const email = params.get("email") ?? "";
  const { toast } = useToast();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingId || !email) {
      toast({ title: "Invalid review link.", variant: "destructive" });
      return;
    }
    if (rating < 1) {
      toast({ title: "Please pick a star rating.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await (supabase as any).rpc("submit_review", {
        p_booking_id: bookingId,
        p_email: email,
        p_rating: rating,
        p_comment: comment,
        p_name: name,
      });
      if (error) throw error;
      setDone(true);
    } catch (err: any) {
      const msg = String(err?.message ?? err);
      toast({
        title: "Could not submit review",
        description: msg.includes("EMAIL_MISMATCH")
          ? "Email doesn't match this booking."
          : msg.includes("NOT_COMPLETED")
          ? "This booking isn't completed yet."
          : msg.includes("NOT_FOUND")
          ? "Booking not found."
          : msg,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center px-4 py-16">
      <PageMeta title="Leave a Review" description="Share your BlueRiver Services experience." />
      <div className="w-full max-w-md bg-card border border-border rounded-2xl p-8 shadow-sm">
        {done ? (
          <div className="text-center py-8">
            <CheckCircle className="w-14 h-14 text-primary mx-auto mb-4" />
            <h1 className="text-2xl font-display font-bold mb-2">Thank you!</h1>
            <p className="text-muted-foreground text-sm">
              Your feedback helps us keep raising the bar.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            <div className="text-center">
              <h1 className="text-2xl font-display font-bold mb-1">Leave a Review</h1>
              <p className="text-sm text-muted-foreground">
                How was your BlueRiver Services experience?
              </p>
            </div>

            <div className="flex justify-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  onMouseEnter={() => setHover(n)}
                  onMouseLeave={() => setHover(0)}
                  className="p-1"
                  aria-label={`${n} star${n > 1 ? "s" : ""}`}
                >
                  <Star
                    className={`w-9 h-9 transition ${
                      n <= (hover || rating)
                        ? "fill-amber-400 stroke-amber-400"
                        : "stroke-muted-foreground"
                    }`}
                  />
                </button>
              ))}
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Your name (optional)</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="How should we credit you?" />
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Comment (optional)</label>
              <Textarea
                rows={4}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="What stood out? Anything we could improve?"
              />
            </div>

            <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
              {loading ? "Submitting..." : "Submit Review"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Reviews are moderated before appearing publicly.
            </p>
          </form>
        )}
      </div>
    </div>
  );
};

export default LeaveReview;
