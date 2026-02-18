import { PartialType } from '@nestjs/mapped-types';
import { CreateAvailabilityExceptionDto } from './create-availability-exception.dto';

export class UpdateAvailabilityExceptionDto extends PartialType(CreateAvailabilityExceptionDto) {}
