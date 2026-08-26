import { IsString, IsOptional, IsInt, Min, Max, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class PaginationDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  @Type(() => Number)
  limit: number = 50;
}

export class AncestorsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  @Type(() => Number)
  depthLimit: number = 10;
}

export class ExpandContextDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  before: number = 10;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  after: number = 10;
}
