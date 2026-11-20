import { CurrentTenant, CurrentUser, Permissions } from '@crm/auth';
import type { TokenPayload } from '@crm/auth';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { PERMISSIONS } from '../../../common/constants/permissions.constants';
import { ParseCuidPipe } from '../../../common/pipes/parse-cuid.pipe';
import { CreateJobDto, ListJobsQueryDto, UpdateJobDto } from '../dto';
import { ReleasePlacesDto } from '../dto/release-places.dto';
import { ReplaceCandidateDto } from '../dto/replace-candidate.dto';
import { JobsService } from '../service/jobs.service';

@ApiTags('jobs')
@ApiBearerAuth()
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get()
  @Permissions(PERMISSIONS.JOB.READ)
  list(@CurrentTenant() organisationId: string, @Query() query: ListJobsQueryDto) {
    return this.jobsService.list(organisationId, query);
  }

  @Get('distance-range')
  @Permissions(PERMISSIONS.JOB.READ)
  distanceRange(@CurrentTenant() organisationId: string, @Query() query: ListJobsQueryDto) {
    return this.jobsService.distanceRange(organisationId, query);
  }

  @Get(':id')
  @Permissions(PERMISSIONS.JOB.READ)
  getById(@CurrentTenant() organisationId: string, @Param('id', ParseCuidPipe) id: string) {
    return this.jobsService.getById(organisationId, id);
  }

  @Post()
  @Permissions(PERMISSIONS.JOB.CREATE)
  create(
    @CurrentTenant() organisationId: string,
    @CurrentUser() user: TokenPayload,
    @Body() dto: CreateJobDto,
  ) {
    return this.jobsService.create(organisationId, user.sub, dto);
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.JOB.UPDATE)
  update(
    @CurrentTenant() organisationId: string,
    @CurrentUser() user: TokenPayload,
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: UpdateJobDto,
  ) {
    return this.jobsService.update(organisationId, user.sub, id, dto);
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @Permissions(PERMISSIONS.JOB.UPDATE)
  publish(@CurrentTenant() organisationId: string, @CurrentUser() user: TokenPayload, @Param('id', ParseCuidPipe) id: string) {
    return this.jobsService.setPublication(organisationId, user.sub, id, 'PUBLISH');
  }

  @Post(':id/unpublish')
  @HttpCode(HttpStatus.OK)
  @Permissions(PERMISSIONS.JOB.UPDATE)
  unpublish(@CurrentTenant() organisationId: string, @CurrentUser() user: TokenPayload, @Param('id', ParseCuidPipe) id: string) {
    return this.jobsService.setPublication(organisationId, user.sub, id, 'UNPUBLISH');
  }

  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  @Permissions(PERMISSIONS.JOB.UPDATE)
  close(@CurrentTenant() organisationId: string, @CurrentUser() user: TokenPayload, @Param('id', ParseCuidPipe) id: string) {
    return this.jobsService.setPublication(organisationId, user.sub, id, 'CLOSE');
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  @Permissions(PERMISSIONS.JOB.UPDATE)
  archive(@CurrentTenant() organisationId: string, @CurrentUser() user: TokenPayload, @Param('id', ParseCuidPipe) id: string) {
    return this.jobsService.setPublication(organisationId, user.sub, id, 'ARCHIVE');
  }

  @Get(':id/candidate-history')
  @Permissions(PERMISSIONS.JOB.READ)
  candidateHistory(@CurrentTenant() organisationId: string, @Param('id', ParseCuidPipe) id: string) {
    return this.jobsService.candidateHistory(organisationId, id);
  }

  @Post(':id/release-places')
  @HttpCode(HttpStatus.OK)
  @Permissions(PERMISSIONS.JOB.UPDATE)
  releasePlaces(
    @CurrentTenant() organisationId: string,
    @CurrentUser() user: TokenPayload,
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: ReleasePlacesDto,
  ) {
    return this.jobsService.releasePlaces(organisationId, user.sub, id, dto);
  }

  @Post(':id/replace-candidate')
  @HttpCode(HttpStatus.OK)
  @Permissions(PERMISSIONS.JOB.UPDATE)
  replaceCandidate(
    @CurrentTenant() organisationId: string,
    @CurrentUser() user: TokenPayload,
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: ReplaceCandidateDto,
  ) {
    return this.jobsService.replaceCandidate(organisationId, user.sub, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions(PERMISSIONS.JOB.DELETE)
  remove(
    @CurrentTenant() organisationId: string,
    @CurrentUser() user: TokenPayload,
    @Param('id', ParseCuidPipe) id: string,
  ) {
    return this.jobsService.remove(organisationId, user.sub, id);
  }
}
