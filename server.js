import express from "express";
import cors from "cors";
import multer from "multer";

const app = express();

app.use(cors());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

app.get("/", (req, res) => {
  res.send("FloorReel backend is running!");
});

app.post("/generate", upload.single("image"), async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "Gemini API key is missing." });
    }

    if (!req.file) {
      return res.status(400).json({ error: "Please upload a product image." });
    }

    const productType = req.body.productType || "Flooring";
    const mimeType = req.file.mimetype;

    if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
      return res.status(400).json({ error: "Use a JPG, PNG or WebP image." });
    }

    const scenes = [
      {
        name: "Luxury living hall",
        description: "A spacious luxury living room with elegant furniture, premium lighting and sophisticated decor."
      },
      {
        name: "Luxury bedroom",
        description: "A beautiful luxury bedroom with a designer bed, warm ambient lighting and elegant interior styling."
      },
      {
        name: "Luxury bathroom",
        description: "A premium modern bathroom with elegant fixtures, refined lighting and sophisticated interior design."
      }
    ];

    const images = [];

    for (const scene of scenes) {
      const prompt = `
Create a completely NEW, photorealistic luxury interior photograph.

ROOM: ${scene.description}

PRODUCT TYPE: ${productType}.

Use the uploaded image as a visual product reference.
${productType === "Flooring"
  ? "Apply the referenced flooring material naturally across the entire visible floor."
  : "Apply the referenced PVC wall panel material naturally to a prominent interior wall."}

IMPORTANT:
- Generate the entire room from scratch.
- Do NOT crop, paste, overlay, or cut out the uploaded image.
- Do NOT create a collage or show the uploaded sample as a separate object.
- Reproduce its visible colour, grain, texture and pattern as closely as possible.
- Make the material look naturally installed in the room.
- Keep the room realistic, premium and professionally photographed.
- Vertical 9:16 composition.
- No text, watermark or logo.
`;

      const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": process.env.GEMINI_API_KEY
          },
          body: JSON.stringify({
            contents: [{
              parts: [
                {
                  inlineData: {
                    mimeType,
                    data: req.file.buffer.toString("base64")
                  }
                },
                { text: prompt }
              ]
            }],
            generationConfig: {
              responseModalities: ["IMAGE", "TEXT"]
            }
          })
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error?.message || "Gemini image generation failed."
        );
      }

      const parts = result.candidates?.[0]?.content?.parts || [];
      const imagePart = parts.find(part => part.inlineData?.data);

      if (!imagePart) {
        throw new Error("Gemini did not return an image. Try again.");
      }

      images.push(
        `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`
      );
    }

    res.json({ images });

  } catch (error) {
    console.error("Generation error:", error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`FloorReel server running on port ${PORT}`);
});
