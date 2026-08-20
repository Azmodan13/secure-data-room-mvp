import { IsEmail, IsIn, IsUUID, MaxLength } from 'class-validator';
import {
  SHARE_TARGET_TYPES,
  type ShareTargetType,
} from './resource-target.dto';

export class CreateShareGrantDto {
  @IsIn(SHARE_TARGET_TYPES)
  targetType!: ShareTargetType;

  @IsUUID()
  targetId!: string;

  @IsEmail()
  @MaxLength(320)
  email!: string;
}
