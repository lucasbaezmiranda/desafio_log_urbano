import { IsNotEmpty, IsString } from 'class-validator';

export class ProcessBillingDto {
  @IsString()
  @IsNotEmpty()
  receiptBookId: string;
}
