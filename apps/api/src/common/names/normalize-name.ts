import { BadRequestException } from '@nestjs/common';

export const MAX_NAME_LENGTH = 120;

export type NormalizedName = {
  name: string;
  normalizedName: string;
};

export function normalizeName(input: string): NormalizedName {
  const name = input.trim().normalize('NFC');

  if (!name || name === '.' || name === '..') {
    throw new BadRequestException('Name is not valid.');
  }

  if (name.length > MAX_NAME_LENGTH) {
    throw new BadRequestException(
      `Name must not exceed ${MAX_NAME_LENGTH} characters.`,
    );
  }

  return {
    name,
    normalizedName: name.toLowerCase(),
  };
}

export function addNumericSuffix(input: string, index: number): string {
  const suffix = ` (${index})`;
  const base = normalizeName(input).name;
  const availableLength = MAX_NAME_LENGTH - suffix.length;

  return `${base.slice(0, availableLength).trimEnd()}${suffix}`;
}
