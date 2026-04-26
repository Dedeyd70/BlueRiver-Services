import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Save, ImageIcon } from "lucide-react";
import ImageUpload from "@/components/ImageUpload";

const HomepageImagesAdmin = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [images, setImages] = useState<Record<string, string>>({});

  const { data: sections, isLoading } = useQuery({
    queryKey: ["admin-homepage-images"],
    queryFn: async () => {
      const { data, error } = await supabase.from("homepage_images").select("*").order("section_key");
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (sections) {
      const map: Record<string, string> = {};
      sections.forEach((s: any) => (map[s.section_key] = s.image_url || ""));
      setImages(map);
    }
  }, [sections]);

  const save = useMutation({
    mutationFn: async () => {
      for (const section of sections ?? []) {
        const newUrl = images[section.section_key] ?? "";
        if (newUrl !== section.image_url) {
          const { data, error } = await supabase
            .from("homepage_images")
            .update({ image_url: newUrl })
            .eq("id", section.id)
            .select("id")
            .maybeSingle();
          if (error) throw error;
          if (!data) throw new Error("Update blocked by permissions or RLS");
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-homepage-images"] });
      qc.invalidateQueries({ queryKey: ["public-homepage-images"] });
      toast({ title: "Homepage images saved" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-display font-bold text-foreground">Homepage Images</h1>
        </div>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          <Save className="w-4 h-4 mr-2" /> Save
        </Button>
      </div>

      <div className="space-y-6">
        {(sections ?? []).map((s: any) => (
          <div key={s.id} className="bg-card border border-border rounded-xl p-4 sm:p-6">
            <label className="text-sm font-medium text-foreground mb-1.5 block">{s.label || s.section_key}</label>
            <p className="text-xs text-muted-foreground mb-3">Upload or replace the image for the "{s.section_key}" section.</p>
            <ImageUpload
              value={images[s.section_key] || ""}
              onChange={(url) => setImages((prev) => ({ ...prev, [s.section_key]: url }))}
              folder="homepage"
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default HomepageImagesAdmin;
