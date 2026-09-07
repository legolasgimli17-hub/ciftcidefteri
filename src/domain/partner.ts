export interface FarmPartner {
  readonly id: string;
  readonly name: string;
}

export function createFarmPartner(input: { readonly id: string; readonly name: string }): FarmPartner {
  const id = input.id.trim();
  if (id.length < 8 || id.length > 80) {
    throw new Error("Ortak kimliği geçersiz.");
  }

  const name = input.name.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 80) {
    throw new Error("Ortak adı 2-80 karakter olmalı.");
  }

  return { id, name };
}
