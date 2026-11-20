import { Public } from '@crm/auth';
import { BadRequestException, Body, Controller, Get, HttpCode, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { WebsiteApplicationDto } from '../dto/website-application.dto';
import { isAcceptableCv } from '../lib/cv-file';
import { PublicApplicationsService } from '../service/public-applications.service';

@ApiTags('public')
@Controller('public')
export class PublicApplicationsController {
  constructor(private readonly service: PublicApplicationsService) {}

  @ApiOperation({
    summary: 'Submit an application from a public website',
    description:
      'Unauthenticated. Creates (or updates) a Candidate for the organisation named by `organisation`; it then appears in Candidates ranked by potential. See docs/api/public-applications.md.',
  })
  @Public()
  // Tight per-client limit: this is the one endpoint anyone on the internet can write through.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('applications')
  @HttpCode(201)
  @ApiConsumes('application/json', 'multipart/form-data')
  @UseInterceptors(FileInterceptor('cv', { limits: { fileSize: 5 * 1024 * 1024, files: 1 } }))
  submit(@Body() dto: WebsiteApplicationDto, @UploadedFile() cv?: Express.Multer.File) {
    if (cv && !isAcceptableCv(cv)) throw new BadRequestException('The CV must be a PDF or Word document (.pdf, .doc or .docx).');
    return this.service.submit(dto, cv);
  }

  @ApiOperation({
    summary: 'List the open jobs of an agency for its public careers page',
    description: 'Unauthenticated, read-only. Only OPEN jobs, and only fields meant for candidates.',
  })
  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get('jobs')
  listJobs(@Query('organisation') organisation: string) {
    return this.service.listOpenJobs(organisation);
  }
}
