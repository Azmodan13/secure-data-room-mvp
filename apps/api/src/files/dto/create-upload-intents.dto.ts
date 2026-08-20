import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export const MAX_UPLOAD_BATCH_SIZE = 10;
export const PDF_MIME_TYPE = 'application/pdf';

export class UploadFileDescriptorDto {
  @IsUUID()
  clientId!: string;

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

export class CreateUploadIntentsDto {
  @IsOptional()
  @IsUUID()
  folderId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_UPLOAD_BATCH_SIZE)
  @ValidateNested({ each: true })
  @Type(() => UploadFileDescriptorDto)
  files!: UploadFileDescriptorDto[];
}
