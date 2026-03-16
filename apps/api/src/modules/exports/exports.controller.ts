import { Controller, Get } from '@nestjs/common';

@Controller('exports')
export class ExportsController {
  @Get('formats')
  formats() {
    return ['csv', 'pdf', 'ics', 'xlsx'];
  }
}
