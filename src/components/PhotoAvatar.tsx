import { useState } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Download, ImageIcon } from "lucide-react";

interface PhotoAvatarProps {
  photoUrl: string | null;
  name: string;
  surname: string;
}

const SIZES = [
  { label: "Piccola (200px)", size: 200 },
  { label: "Media (400px)", size: 400 },
  { label: "Grande (800px)", size: 800 },
  { label: "Originale", size: 0 },
];

export default function PhotoAvatar({ photoUrl, name, surname }: PhotoAvatarProps) {
  const [downloading, setDownloading] = useState(false);
  const initials = `${name?.charAt(0) || ""}${surname?.charAt(0) || ""}`;

  const downloadResized = async (targetSize: number) => {
    if (!photoUrl) return;
    setDownloading(true);
    try {
      const res = await fetch(photoUrl);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();

      if (targetSize === 0) {
        // Original size - direct download
        const url = URL.createObjectURL(blob);
        triggerDownload(url, `${name}_${surname}_originale`);
        URL.revokeObjectURL(url);
        return;
      }

      // Resize using canvas
      const img = new Image();
      const objectUrl = URL.createObjectURL(blob);
      
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = objectUrl;
      });

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;

      // Calculate dimensions maintaining aspect ratio
      const scale = targetSize / Math.max(img.width, img.height);
      if (scale >= 1) {
        // Image already smaller, download original
        triggerDownload(objectUrl, `${name}_${surname}_${targetSize}`);
        URL.revokeObjectURL(objectUrl);
        return;
      }

      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      URL.revokeObjectURL(objectUrl);

      canvas.toBlob((resizedBlob) => {
        if (!resizedBlob) return;
        const url = URL.createObjectURL(resizedBlob);
        triggerDownload(url, `${name}_${surname}_${targetSize}`);
        URL.revokeObjectURL(url);
      }, "image/jpeg", 0.85);
    } catch (err) {
      console.error("Download error:", err);
    } finally {
      setDownloading(false);
    }
  };

  const triggerDownload = (url: string, filename: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (!photoUrl) {
    return (
      <Avatar className="h-10 w-10">
        <AvatarFallback className="text-xs bg-muted">{initials}</AvatarFallback>
      </Avatar>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="rounded-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer">
          <Avatar className="h-10 w-10">
            <AvatarImage src={photoUrl} alt={`${name} ${surname}`} className="object-cover" />
            <AvatarFallback className="text-xs bg-muted">{initials}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuLabel className="flex items-center gap-2 text-xs">
          <ImageIcon className="h-3.5 w-3.5" />
          Scarica foto
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {SIZES.map(({ label, size }) => (
          <DropdownMenuItem
            key={size}
            onClick={() => downloadResized(size)}
            disabled={downloading}
            className="text-sm cursor-pointer"
          >
            <Download className="h-3.5 w-3.5 mr-2" />
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
