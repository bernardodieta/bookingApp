import { PartialType } from '@nestjs/mapped-types';
import { CreateAvailabilityRuleDto } from './create-availability-rule.dto';

export class UpdateAvailabilityRuleDto extends PartialType(CreateAvailabilityRuleDto) {}
