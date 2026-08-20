import { IsIn, IsUUID } from 'class-validator';

export const SHARE_TARGET_TYPES = ['dataRoom', 'folder', 'file'] as const;
export type ShareTargetType = (typeof SHARE_TARGET_TYPES)[number];

export class ResourceTargetDto {
  @IsIn(SHARE_TARGET_TYPES)
  targetType!: ShareTargetType;

  @IsUUID()
  targetId!: string;
}
