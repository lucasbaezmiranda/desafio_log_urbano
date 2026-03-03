import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateReceiptBookDto {
  @IsInt()
  @Min(1)
  pointOfSale: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  description: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
