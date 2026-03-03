import { IsDateString, IsNotEmpty, IsNumber, IsString, MaxLength, Min } from 'class-validator';

export class CreateServiceDto {
  @IsString()
  @IsNotEmpty()
  clientId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description: string;

  @IsDateString()
  serviceDate: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount: number;
}
