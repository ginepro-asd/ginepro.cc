import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Simple JPEG resize using canvas-like approach with imagescript
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { password } = await req.json();

    const adminPassword = Deno.env.get("ADMIN_PASSWORD");
    if (!password || password !== adminPassword) {
      return new Response(JSON.stringify({ error: "Password non valida" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all registrations that have photoUrl in custom_data but no photoUrlThumb
    const { data: registrations, error: fetchError } = await supabase
      .from("registrations")
      .select("id, custom_data")
      .not("custom_data", "is", null);

    if (fetchError) throw fetchError;

    const toProcess = (registrations || []).filter((r: any) => {
      const cd = r.custom_data;
      return cd?.photoUrl && !cd?.photoUrlThumb;
    });

    console.log(`Found ${toProcess.length} registrations to process`);

    let processed = 0;
    let errors = 0;

    for (const reg of toProcess) {
      try {
        const photoUrl = reg.custom_data.photoUrl;

        // Download the image from Firebase Storage
        const imgRes = await fetch(photoUrl);
        if (!imgRes.ok) {
          console.error(`Failed to download ${photoUrl}: ${imgRes.status}`);
          errors++;
          continue;
        }

        const imgBuffer = new Uint8Array(await imgRes.arrayBuffer());

        // Decode and resize using imagescript
        let image: any;
        try {
          image = await Image.decode(imgBuffer);
        } catch (decodeErr) {
          console.error(`Failed to decode image for reg ${reg.id}: ${decodeErr}`);
          errors++;
          continue;
        }

        // Resize to 100x100 (2x for retina), maintaining aspect ratio and cropping to square
        const size = 100;
        const minDim = Math.min(image.width, image.height);
        const scale = size / minDim;
        image = image.resize(
          Math.round(image.width * scale),
          Math.round(image.height * scale)
        );
        // Crop to center square
        const cropX = Math.round((image.width - size) / 2);
        const cropY = Math.round((image.height - size) / 2);
        image = image.crop(cropX, cropY, size, size);

        // Encode as PNG (imagescript outputs PNG)
        const thumbBuffer = await image.encode();

        // Upload to Supabase Storage
        const fileName = `${reg.id}.png`;
        const { error: uploadError } = await supabase.storage
          .from("photo-thumbs")
          .upload(fileName, thumbBuffer, {
            contentType: "image/png",
            upsert: true,
          });

        if (uploadError) {
          console.error(`Upload error for ${reg.id}: ${uploadError.message}`);
          errors++;
          continue;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from("photo-thumbs")
          .getPublicUrl(fileName);

        // Update custom_data with thumbnail URL
        const updatedCustomData = {
          ...reg.custom_data,
          photoUrlThumb: urlData.publicUrl,
        };

        const { error: updateError } = await supabase
          .from("registrations")
          .update({ custom_data: updatedCustomData })
          .eq("id", reg.id);

        if (updateError) {
          console.error(`Update error for ${reg.id}: ${updateError.message}`);
          errors++;
          continue;
        }

        processed++;
        console.log(`Processed ${processed}/${toProcess.length}: ${reg.id}`);
      } catch (err) {
        console.error(`Error processing ${reg.id}:`, err);
        errors++;
      }
    }

    return new Response(
      JSON.stringify({
        total: toProcess.length,
        processed,
        errors,
        message: `Processati ${processed} thumbnail, ${errors} errori.`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

function serve(handler: (req: Request) => Promise<Response>) {
  Deno.serve(handler);
}
