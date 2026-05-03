import { Module } from '@nestjs/common';
import { UnitConverterService } from './unit-converter.service';
import { MeasureParserService } from './measure-parser.service';

@Module({
  providers: [UnitConverterService, MeasureParserService],
  exports: [UnitConverterService, MeasureParserService],
})
export class UtilsModule {}
