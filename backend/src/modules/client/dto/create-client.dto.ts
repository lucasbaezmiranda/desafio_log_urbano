import { IsEmail, IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { TaxCondition } from '../../../common/enums';

export class CreateClientDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  businessName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(13)
  taxId: string;

  @IsEnum(TaxCondition)
  taxCondition: TaxCondition;

  @IsEmail()
  email: string;
}
