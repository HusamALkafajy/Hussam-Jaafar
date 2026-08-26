import { Module } from '@nestjs/common';
import { DocumentReadController } from './document-read.controller';
import { DocumentReadService } from './document-read.service';

@Module({
  controllers: [DocumentReadController],
  providers: [DocumentReadService],
  exports: [DocumentReadService],
})
export class DocumentReadModule {}
