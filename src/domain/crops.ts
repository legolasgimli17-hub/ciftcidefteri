export const cropCodes = [
  "cotton",
  "corn",
  "wheat",
  "hazelnut",
  "tobacco",
  "vegetable",
  "other"
] as const;

export type CropCode = (typeof cropCodes)[number];

export interface CropTemplate {
  readonly code: CropCode;
  readonly label: string;
  readonly expenseSuggestions: readonly string[];
}

export const cropTemplates: Readonly<Record<CropCode, CropTemplate>> = {
  cotton: {
    code: "cotton",
    label: "Pamuk",
    expenseSuggestions: [
      "Tohum",
      "Gübre",
      "İlaç",
      "Sulama",
      "Çapa işçiliği",
      "Hasat işçiliği",
      "Çırçır masrafı"
    ]
  },
  corn: {
    code: "corn",
    label: "Mısır",
    expenseSuggestions: ["Hibrit tohum", "Azotlu gübre", "Sulama", "İlaç", "Biçerdöver kirası"]
  },
  wheat: {
    code: "wheat",
    label: "Buğday",
    expenseSuggestions: ["Tohumluk", "Gübre", "Yabancı ot ilacı", "Mazot", "Biçerdöver kirası"]
  },
  hazelnut: {
    code: "hazelnut",
    label: "Fındık",
    expenseSuggestions: ["Gübre", "İlaç", "Budama işçiliği", "Hasat işçiliği", "Kurutma"]
  },
  tobacco: {
    code: "tobacco",
    label: "Tütün",
    expenseSuggestions: ["Fide", "Gübre", "İlaç", "Sulama", "Kırma/dizme işçiliği", "Kurutma"]
  },
  vegetable: {
    code: "vegetable",
    label: "Sebze",
    expenseSuggestions: ["Fide/tohum", "Gübre", "İlaç", "Sulama", "Hasat işçiliği", "Hal/komisyon kesintisi"]
  },
  other: {
    code: "other",
    label: "Diğer",
    expenseSuggestions: []
  }
};

export function expenseSuggestionsFor(crop: CropCode): readonly string[] {
  return cropTemplates[crop].expenseSuggestions;
}

export function parseCropCode(value: string): CropCode {
  if (!(cropCodes as readonly string[]).includes(value)) {
    throw new Error("Yerel veride tanınmayan ürün bulundu.");
  }
  return value as CropCode;
}
