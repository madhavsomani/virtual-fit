export type GarmentCategory = "tshirt" | "jacket" | "pants" | "dress" | "hoodie" | "shorts" | "skirt";

export type AnchorMode = "torso" | "legs" | "full-body" | "footwear";

export type Garment = {
  id: string;
  name: string;
  category: GarmentCategory;
  anchor: AnchorMode;
  assetUrl: string;
  previewGradient: [string, string];
  sizes: string[];
  createdAt: string;
};

export type GarmentLibrary = readonly Garment[];
