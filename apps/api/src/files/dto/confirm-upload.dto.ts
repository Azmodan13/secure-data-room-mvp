import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class ConfirmUploadDto {
  @IsOptional()
  @IsUUID()
  folderId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  sizeBytes!: number;

  @IsString()
  mimeType!: string;
}
