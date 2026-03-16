import { Controller, ForbiddenException, Get, Param } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { BackgroundJobsService } from './background-jobs.service';

@Controller('jobs')
export class JobsController {
  constructor(private readonly backgroundJobsService: BackgroundJobsService) {}

  @Get()
  list(@CurrentUser() user: { sub: string }) {
    return this.backgroundJobsService.listForUser(user.sub);
  }

  @Get(':jobId')
  async get(@Param('jobId') jobId: string, @CurrentUser() user: { sub: string }) {
    const job = await this.backgroundJobsService.findById(jobId);
    if (job.userId && job.userId !== user.sub) {
      throw new ForbiddenException('Accesso negato al job richiesto');
    }
    return job;
  }
}
