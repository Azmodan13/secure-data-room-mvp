import { IsString, MaxLength, MinLength } from 'class-validator';

export class RenameFileDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;
}
