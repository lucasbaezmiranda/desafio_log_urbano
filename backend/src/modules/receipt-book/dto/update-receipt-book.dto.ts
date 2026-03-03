import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateReceiptBookDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  description?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
