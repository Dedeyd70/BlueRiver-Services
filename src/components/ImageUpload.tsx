import { useState } from "react";
import imageCompression from "browser-image-compression";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Upload, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  folder?: string;
}

const ImageUpload = ({ value, onChange, folder = "general" }: ImageUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Please select an image file", variant: "destructive" });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Image must be under 10MB", variant: "destructive" });
      return;
    }

    setUploading(true);

    try {
      // Compress and resize before uploading
      const compressed = await imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
      });

      const ext = file.name.split(".").pop();
      const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error } = await supabase.storage.from("site-images").upload(fileName, compressed);
      if (error) {
        toast({ title: "Upload failed", description: error.message, variant: "destructive" });
        setUploading(false);
        return;
      }

      const { data: urlData } = supabase.storage.from("site-images").getPublicUrl(fileName);
      onChange(urlData.publicUrl);
    } catch (err: any) {
      toast({ title: "Compression failed", description: err.message, variant: "destructive" });
    }
    setUploading(false);
  };

  return (
    <div className="space-y-2">
      {value && (
        <div className="relative inline-block">
          <img src={value} alt="Preview" className="w-32 h-32 object-cover rounded-lg border border-border" loading="lazy" />
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
      <div>
        <label className="cursor-pointer">
          <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
          <Button type="button" variant="outline" size="sm" disabled={uploading} asChild>
            <span><Upload className="w-4 h-4 mr-2" /> {uploading ? "Compressing & Uploading..." : "Upload Image"}</span>
          </Button>
        </label>
      </div>
    </div>
  );
};

export default ImageUpload;
