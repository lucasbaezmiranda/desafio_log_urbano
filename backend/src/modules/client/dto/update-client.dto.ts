import { IsEmail, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { TaxCondition } from '../../../common/enums';

export class UpdateClientDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  businessName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(13)
  taxId?: string;

  @IsEnum(TaxCondition)
  @IsOptional()
  taxCondition?: TaxCondition;

  @IsEmail()
  @IsOptional()
  email?: string;
}
