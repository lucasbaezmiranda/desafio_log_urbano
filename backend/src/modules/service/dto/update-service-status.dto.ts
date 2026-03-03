import { IsEnum } from 'class-validator';
import { ServiceStatus } from '../../../common/enums';

export class UpdateServiceStatusDto {
  @IsEnum(ServiceStatus)
  status: ServiceStatus;
}
