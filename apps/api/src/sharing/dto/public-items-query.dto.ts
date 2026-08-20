import { IsOptional, IsUUID } from 'class-validator';

export class PublicItemsQueryDto {
  @IsOptional()
  @IsUUID()
  folderId?: string;
}
