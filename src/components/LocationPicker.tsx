import { useEffect, useRef, useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MapPin, Loader2, Search } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface LocationPickerProps {
  lat: number | null;
  lng: number | null;
  address: string;
  label: string;
  onChangeLocation: (lat: number, lng: number, address: string) => void;
  onChangeLabel: (label: string) => void;
}

const LocationPicker = ({ lat, lng, address, label, onChangeLocation, onChangeLabel }: LocationPickerProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [reverseLoading, setReverseLoading] = useState(false);

  const reverseGeocode = useCallback(async (latitude: number, longitude: number) => {
    setReverseLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
        { headers: { "Accept-Language": "it" } }
      );
      const data = await res.json();
      const addr = data.display_name || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
      onChangeLocation(latitude, longitude, addr);
      // Auto-fill label if empty
      if (!label) {
        const parts = data.address;
        const shortLabel = parts?.road
          ? `${parts.road}${parts.house_number ? ` ${parts.house_number}` : ""}, ${parts.city || parts.town || parts.village || ""}`
          : addr.split(",").slice(0, 2).join(",");
        onChangeLabel(shortLabel.trim());
      }
    } catch {
      onChangeLocation(latitude, longitude, `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
    } finally {
      setReverseLoading(false);
    }
  }, [onChangeLocation, onChangeLabel, label]);

  const searchAddress = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`,
        { headers: { "Accept-Language": "it" } }
      );
      const data = await res.json();
      if (data && data.length > 0) {
        const { lat: rLat, lon: rLng } = data[0];
        const latitude = parseFloat(rLat);
        const longitude = parseFloat(rLng);
        
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([latitude, longitude], 16);
        }
        if (markerRef.current) {
          markerRef.current.setLatLng([latitude, longitude]);
        } else if (mapInstanceRef.current) {
          markerRef.current = L.marker([latitude, longitude], { draggable: true })
            .addTo(mapInstanceRef.current);
          markerRef.current.on("dragend", () => {
            const pos = markerRef.current!.getLatLng();
            reverseGeocode(pos.lat, pos.lng);
          });
        }
        reverseGeocode(latitude, longitude);
      }
    } catch {
      // silently fail
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const defaultLat = lat || 44.2856;
    const defaultLng = lng || 11.8798;
    const defaultZoom = lat ? 15 : 6;

    const map = L.map(mapRef.current).setView([defaultLat, defaultLng], defaultZoom);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    if (lat && lng) {
      markerRef.current = L.marker([lat, lng], { draggable: true }).addTo(map);
      markerRef.current.on("dragend", () => {
        const pos = markerRef.current!.getLatLng();
        reverseGeocode(pos.lat, pos.lng);
      });
    }

    map.on("click", (e: L.LeafletMouseEvent) => {
      const { lat: cLat, lng: cLng } = e.latlng;
      if (markerRef.current) {
        markerRef.current.setLatLng([cLat, cLng]);
      } else {
        markerRef.current = L.marker([cLat, cLng], { draggable: true }).addTo(map);
        markerRef.current.on("dragend", () => {
          const pos = markerRef.current!.getLatLng();
          reverseGeocode(pos.lat, pos.lng);
        });
      }
      reverseGeocode(cLat, cLng);
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
  }, []);

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca indirizzo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && searchAddress()}
            className="pl-9"
          />
        </div>
        <Button type="button" variant="outline" onClick={searchAddress} disabled={searching}>
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cerca"}
        </Button>
      </div>

      {/* Map */}
      <div
        ref={mapRef}
        className="w-full h-[300px] rounded-lg border border-border overflow-hidden z-0"
        style={{ position: "relative" }}
      />

      {/* Detected address */}
      {address && (
        <div className="bg-muted/50 border border-border rounded-lg p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            Indirizzo rilevato {reverseLoading && <Loader2 className="h-3 w-3 animate-spin" />}
          </div>
          <p className="text-sm text-foreground">{address}</p>
        </div>
      )}

      {/* Custom label */}
      <div className="space-y-1.5">
        <Label className="text-sm">Label personalizzata (visibile agli utenti)</Label>
        <Input
          placeholder="es. Piazza del Popolo, Faenza"
          value={label}
          onChange={(e) => onChangeLabel(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">Questo testo apparirà come link cliccabile verso Google Maps</p>
      </div>
    </div>
  );
};

export default LocationPicker;
