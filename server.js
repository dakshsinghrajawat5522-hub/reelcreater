
import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "FloorReel backend is running!" });
});

app.post("/generate", upload.single("image"), async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "Gemini API key is missing in Render environment variables."
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: "Please upload a product image."
      });
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        error: "Upload a JPG, PNG or WebP image."
      });
    }

    const productType = req.body.productType || "Flooring";

    const scenes = [
      {
        name: "Luxury living hall",
        description: "A spectacular luxury living room with elegant furniture, premium lighting and sophisticated decor."
      },
      {
        name: "Luxury bedroom",
        description: "A beautiful premium bedroom with a designer bed, warm ambient lighting and elegant furniture."
      },
      {
        name: "Luxury bathroom",
        description: "A premium modern bathroom with refined fixtures, beautiful lighting and sophisticated design."
      }
    ];

    const images = [];

    for (const scene of scenes) {
      const prompt = `
Create a completely NEW photorealistic luxury interior photograph.

ROOM: ${scene.description}

PRODUCT TYPE: ${productType}.

Use the uploaded photograph as the visual reference for the product.
${productType === "Flooring"
  ? "The referenced material must appear naturally installed across the visible floor."
  : "The referenced PVC wall panel must appear naturally installed on a prominent wall."}

IMPORTANT:
- Generate the complete room from scratch.
- Never crop, cut out, paste or overlay the uploaded sample.
- Do not create a collage.
- Reproduce the reference colour, grain, texture and pattern as closely as possible.
- Make the product look naturally installed.
- Use realistic interior lighting, shadows and reflections.
- Premium architectural photography.
- Vertical 9:16 composition.
- No text, logo or watermark.
`;

      const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey
          },
          body: JSON.stringify({
            contents: [{
              parts: [
                {
                  inlineData: {
                    mimeType: req.file.mimetype,
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
          result.error?.message || `AI request failed: ${response.status}`
        );
      }

      const parts = result.candidates?.[0]?.content?.parts || [];
      const imagePart = parts.find(part => part.inlineData?.data);

      if (!imagePart) {
        throw new Error(
          `AI did not return an image for ${scene.name}.`
        );
      }

      images.push(
        `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`
      );
    }

    res.json({ images });

  } catch (error) {
    console.error("Generation error:", error);

    res.status(500).json({
      error: error.message || "Unexpected server error."
    });
  }
});

app.listen(process.env.PORT || 3000, "0.0.0.0", () => {
  console.log("FloorReel AI server started.");
});
